// ============================================================================
// SpriteForge: bakes (fighter, animation, frame) -> a pixel canvas.
// ----------------------------------------------------------------------------
// Frames are generated lazily on first use and cached forever. Generation is a
// few hundred microseconds per frame, so a whole roster is affordable, and the
// game never ships binary sprite sheets.
// ============================================================================

import { Raster, hex, shade, mix, type RGBA } from '../Raster';
import { BODY_PLANS, PALETTES, type BodyPlan, type Palette } from '../BodyPlans';
import { BASE_ANIMS, bake, type Pose, type AnimDef } from '../PoseLib';
import { ramps, type Ramps } from './ramps';
import { solve, angleOf, type Skeleton } from './geometry';
import { drawHead } from './head';
import { drawBackLimbs, drawFrontLimbs, drawTorso } from './body';
import { drawSkirt, drawCape, drawSashTails } from './cloth';
import { drawWeapon, drawOffhand } from './weapons';

const R = Math.PI / 180;

/** Canvas padding around the figure so weapons and capes never clip. */
const PAD_X = 46;
const PAD_TOP = 34;
const PAD_BOT = 12;

export interface Frame {
  canvas: HTMLCanvasElement;
  /** pixel offset from the sprite's origin (feet centre) to canvas top-left */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

interface Baked {
  poses: Pose[];
  frames: Array<Frame | null>;
}

export class SpriteForge {
  private cache = new Map<string, Baked>();
  private animCache = new Map<string, Pose[]>();
  /** custom per-fighter animation overrides */
  private overrides = new Map<string, Record<string, AnimDef>>();

  registerOverrides(planKey: string, defs: Record<string, AnimDef>): void {
    this.overrides.set(planKey, defs);
  }

  private posesFor(planKey: string, anim: string): Pose[] {
    const key = `${planKey}:${anim}`;
    let ps = this.animCache.get(key);
    if (ps) return ps;
    const ov = this.overrides.get(planKey);
    const def = (ov && ov[anim]) || BASE_ANIMS[anim] || BASE_ANIMS.idle;
    ps = bake(def);
    this.animCache.set(key, ps);
    return ps;
  }

  frameCount(planKey: string, anim: string): number {
    return this.posesFor(planKey, anim).length;
  }

  /** Get (and lazily bake) one frame. */
  get(planKey: string, paletteKey: string, anim: string, frame: number): Frame {
    const key = `${planKey}|${paletteKey}|${anim}`;
    let b = this.cache.get(key);
    if (!b) {
      const poses = this.posesFor(planKey, anim);
      b = { poses, frames: new Array(poses.length).fill(null) };
      this.cache.set(key, b);
    }
    const n = b.poses.length;
    const i = ((frame % n) + n) % n;
    let f = b.frames[i];
    if (!f) {
      f = this.render(planKey, paletteKey, b.poses[i]);
      b.frames[i] = f;
    }
    return f;
  }

  /** Render a specific pose (used by the character-select big sprite too). */
  render(planKey: string, paletteKey: string, p: Pose): Frame {
    const plan = BODY_PLANS[planKey] ?? BODY_PLANS.capitanBlade;
    const pal = PALETTES[paletteKey] ?? PALETTES.diego;
    const ra = ramps(pal);

    const w = Math.round(plan.height * 0.72) + PAD_X * 2;
    const h = plan.height + PAD_TOP + PAD_BOT;
    const r = new Raster(w, h);
    const originX = Math.round(w / 2);
    const floorY = h - PAD_BOT;

    const sk = solve(plan, p, originX, floorY);

    // ---- draw order -------------------------------------------------------
    if (p.glow > 0.02) drawAura(r, sk, plan, ra, p.glow);
    drawCape(r, plan, p, sk, ra);
    drawSkirt(r, plan, p, sk, ra, true);
    drawSashTails(r, plan, p, sk, ra);
    drawOffhand(r, plan, p, sk, ra, true);
    drawBackLimbs(r, plan, p, sk, ra);
    drawTorso(r, plan, p, sk, ra);
    drawSkirt(r, plan, p, sk, ra, false);
    drawHead(r, plan, p, sk, ra);
    if (p.trail) drawTrail(r, sk, p, ra);
    drawWeapon(r, plan, p, sk, ra);
    drawFrontLimbs(r, plan, p, sk, ra);
    drawOffhand(r, plan, p, sk, ra, false);

    // ---- finishing passes -------------------------------------------------
    r.outline(ra.outline, true);
    r.contactShade(ra.outline, 2);
    if (p.glow > 0.4) rimLight(r, ra.aura, p.glow);

    return {
      canvas: r.toCanvas(),
      ox: -originX,
      oy: -floorY,
      w,
      h,
    };
  }

  clear(): void {
    this.cache.clear();
    this.animCache.clear();
  }
}

// ---------------------------------------------------------------------------
// FX passes
// ---------------------------------------------------------------------------

function drawAura(
  r: Raster,
  sk: Skeleton,
  plan: BodyPlan,
  ra: Ramps,
  strength: number,
): void {
  const cx = sk.pelvis.x;
  const cy = sk.pelvis.y - plan.torsoLen * 0.3;
  const rr = plan.height * 0.42 * (0.8 + strength * 0.35);
  const steps = 3;
  for (let s = steps; s >= 1; s--) {
    const t = s / steps;
    const col = mix(ra.aura, ra.auraLite, 1 - t);
    const rad = rr * (0.7 + t * 0.55);
    // dotted ring, aliased on purpose
    const count = Math.round(26 + t * 18);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + t * 1.1;
      const x = cx + Math.cos(a) * rad * 0.62;
      const y = cy + Math.sin(a) * rad;
      if ((i + s) % 2 === 0) r.pxBehind(x, y, col);
    }
  }
  // rising sparks
  for (let i = 0; i < 8; i++) {
    const x = cx + ((i * 37) % 31) - 15;
    const y = cy + plan.torsoLen * 0.9 - ((i * 53) % 46);
    r.pxBehind(x, y, ra.auraLite);
  }
}

function drawTrail(r: Raster, sk: Skeleton, p: Pose, ra: Ramps): void {
  const t = p.trail!;
  const fore = angleOf(sk.elbowF, sk.handF);
  const cx = sk.handF.x;
  const cy = sk.handF.y;
  const steps = 16;
  const cols: RGBA[] = [
    hex('#ffffff'),
    shade(ra.aura, 0.65),
    ra.aura,
    shade(ra.aura, -0.25),
  ];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const a = (t.a0 + (t.a1 - t.a0) * k + fore * 0.15) * R;
    const ux = Math.sin(a);
    const uy = Math.cos(a);
    const inner = t.r0 * (0.7 + k * 0.3);
    const outer = t.r1;
    const wobble = Math.sin(k * Math.PI) ;
    const cIdx = k > 0.75 ? 0 : k > 0.4 ? 1 : 2;
    const col = cols[cIdx];
    const width = Math.max(1, t.width * wobble);
    for (let wI = 0; wI < width; wI++) {
      const rr0 = inner + wI * 0.9;
      const rr1 = outer - wI * 0.6;
      if (rr1 <= rr0) continue;
      const x0 = cx + ux * rr0;
      const y0 = cy + uy * rr0;
      const x1 = cx + ux * rr1;
      const y1 = cy + uy * rr1;
      // only paint where empty so the trail sits behind the fighter
      const dx = x1 - x0;
      const dy = y1 - y0;
      const n = Math.max(2, Math.round(Math.hypot(dx, dy)));
      for (let s = 0; s <= n; s++) {
        const f = s / n;
        if ((s + i) % 2 === 0 && k < 0.35) continue;
        r.pxBehind(x0 + dx * f, y0 + dy * f, col);
      }
    }
  }
}

function rimLight(r: Raster, aura: RGBA, strength: number): void {
  const w = r.w;
  const h = r.h;
  const data = r.data;
  const col = shade(aura, 0.4);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!(data[i] >>> 24)) continue;
      const left = data[i - 1] >>> 24;
      const up = data[i - w] >>> 24;
      if (!left || !up) {
        if ((x + y) % 2 === 0) data[i] = mix(data[i], col, 0.5 * strength);
      }
    }
  }
}

export const forge = new SpriteForge();
