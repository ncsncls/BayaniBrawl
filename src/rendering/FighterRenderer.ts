// ============================================================================
// FighterRenderer: maps a Fighter's state to a forge animation + frame, and
// blits it. Also draws shadows, spirit aura, and (in debug) hit/hurtboxes.
// ============================================================================

import { forge, type Frame } from './forge/SpriteForge';
import { Fighter } from '../fighters/Fighter';
import { PALETTES } from './BodyPlans';
import type { Box } from '../game/types';

export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  /** world -> screen */
  toX: (x: number) => number;
  toY: (y: number) => number;
  groundY: number;
  frame: number;
  hitFlash: boolean;
  showBoxes: boolean;
}

export class FighterRenderer {
  /** which animation to show for the fighter's current state */
  animFor(f: Fighter): { anim: string; frame: number; hold: boolean } {
    const plan = f.def.art.plan;

    if (f.state === 'attack' && f.move) {
      const anim = f.move.anim;
      const total = forge.frameCount(plan, anim);
      const len = f.move.startup + f.move.active + f.move.recovery;
      // map move progress onto the animation, but hold the impact frame
      // during the active window so hits read clearly
      const m = f.move;
      let t: number;
      if (f.moveFrame < m.startup) {
        t = (f.moveFrame / Math.max(1, m.startup)) * 0.42;
      } else if (f.moveFrame < m.startup + m.active) {
        const k = (f.moveFrame - m.startup) / Math.max(1, m.active);
        t = 0.42 + k * 0.3;
      } else {
        const k = (f.moveFrame - m.startup - m.active) / Math.max(1, m.recovery);
        t = 0.72 + k * 0.28;
      }
      const fr = Math.min(total - 1, Math.floor(t * total));
      return { anim, frame: fr, hold: true };
    }

    const anim = f.anim;
    const total = forge.frameCount(plan, anim);
    let fr = f.animFrame;
    const looping = LOOPING.has(anim);
    if (looping) fr = fr % total;
    else fr = Math.min(total - 1, fr);
    return { anim, frame: fr, hold: !looping };
  }

  getFrame(f: Fighter): Frame {
    const { anim, frame } = this.animFor(f);
    return forge.get(f.def.art.plan, f.def.art.palette, anim, frame);
  }

  /** ground shadow: an ellipse that shrinks with height */
  drawShadow(d: DrawCtx, f: Fighter): void {
    const { ctx } = d;
    const sx = d.toX(f.x);
    const sy = d.groundY;
    const h = f.y;
    const shrink = Math.max(0.3, 1 - h / 190);
    const w = 26 * shrink;
    ctx.save();
    ctx.globalAlpha = 0.32 * shrink;
    ctx.fillStyle = '#000000';
    // pixel ellipse via rows
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const frac = 1 - r / rows;
      const rw = Math.round(w * frac);
      ctx.fillRect(Math.round(sx - rw), Math.round(sy + r - 2), rw * 2, 1);
    }
    ctx.restore();
  }

  draw(d: DrawCtx, f: Fighter): void {
    const { ctx } = d;
    const fr = this.getFrame(f);
    const sx = Math.round(d.toX(f.x));
    const sy = Math.round(d.toY(f.y));
    const flip = f.facing === -1;

    // spirit aura behind the sprite
    if (f.spirit) {
      const pal = PALETTES[f.def.art.palette];
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(d.frame * 0.14) * 0.06;
      ctx.fillStyle = pal?.aura ?? '#ffd24c';
      const h = fr.h;
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const w = 40 - i * 4;
        ctx.fillRect(
          Math.round(sx - w / 2),
          Math.round(sy - h * (0.2 + t * 0.72)),
          w,
          2,
        );
      }
      ctx.restore();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(sx, sy);
      ctx.scale(-1, 1);
      ctx.translate(-sx, -sy);
    }
    const dx = sx + fr.ox;
    const dy = sy + fr.oy;

    // hit flash: draw the sprite, then a white silhouette on top
    ctx.drawImage(fr.canvas, dx, dy);
    if (f.flash > 0 && d.hitFlash) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(0.85, f.flash / 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, fr.w, fr.h);
      ctx.restore();
    }
    ctx.restore();

    // invulnerability shimmer
    if (f.invulnFrames > 0 && d.frame % 4 < 2) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#8fd0ff';
      ctx.fillRect(Math.round(sx - 16), Math.round(sy - fr.h * 0.8), 32, 2);
      ctx.restore();
    }
  }

  /** Debug boxes: hurtbox (blue), pushbox (green), hitboxes (red). */
  drawBoxes(d: DrawCtx, f: Fighter): void {
    const { ctx } = d;
    const box = (b: Box, color: string) => {
      const x0 = d.toX(b.x);
      const y1 = d.toY(b.y);
      const y0 = d.toY(b.y + b.h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(x0) + 0.5,
        Math.round(y0) + 0.5,
        Math.round(b.w),
        Math.round(y1 - y0),
      );
    };
    box(f.pushbox, 'rgba(80,255,120,0.75)');
    box(f.hurtbox, 'rgba(80,160,255,0.85)');
    if (f.state === 'attack' && f.move) {
      for (const h of f.move.hits) {
        if (f.moveFrame < h.start || f.moveFrame > h.end) continue;
        box(f.worldBox(h.box), 'rgba(255,70,70,0.95)');
      }
      // startup / active / recovery marker
      const m = f.move;
      const ph =
        f.moveFrame < m.startup
          ? 'STARTUP'
          : f.moveFrame < m.startup + m.active
            ? 'ACTIVE'
            : 'RECOVERY';
      ctx.fillStyle =
        ph === 'ACTIVE' ? '#ff4a4a' : ph === 'STARTUP' ? '#ffd83c' : '#7fd4ff';
      ctx.font = '8px "BayaniPixel", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${m.id.toUpperCase()} ${ph} ${f.moveFrame}/${m.startup + m.active + m.recovery}`,
        d.toX(f.x),
        d.toY(f.y) - 118,
      );
    }
  }
}

const LOOPING = new Set([
  'idle',
  'walkF',
  'walkB',
  'dash',
  'air',
  'crouch',
  'block',
  'blockCrouch',
  'juggle',
  'grabbed',
  'stance',
  'victory',
]);
