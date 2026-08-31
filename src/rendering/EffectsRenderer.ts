// ============================================================================
// Particles, impact bursts, slash arcs, dust, damage numbers, projectiles FX.
// All shapes are drawn with fillRect so nothing antialiases.
// ============================================================================

import type { HitFx } from '../game/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  colors: string[];
  gravity: number;
  kind: 'spark' | 'dust' | 'shard' | 'ring' | 'streak' | 'ember';
  angle?: number;
  len?: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
  outline: string;
}

interface Burst {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  r: number;
  kind: HitFx | 'block' | 'counter' | 'super';
  angle: number;
  scale: number;
}

const PAL: Record<string, string[]> = {
  punch: ['#ffffff', '#ffe8a0', '#ffa040', '#e04c20'],
  blunt: ['#ffffff', '#fff0c0', '#ffc060', '#d08030'],
  kick: ['#ffffff', '#ffe0b0', '#ff9040', '#c05020'],
  slash: ['#ffffff', '#e8f8ff', '#80d8ff', '#3080d0'],
  heavy: ['#ffffff', '#ffe070', '#ff7030', '#a02010'],
  energy: ['#ffffff', '#d0f0ff', '#70b8ff', '#3050d0'],
  shadow: ['#ffffff', '#e0c0ff', '#a050e0', '#5010a0'],
  block: ['#ffffff', '#d8e8f8', '#8098c0', '#405070'],
  counter: ['#ffffff', '#fff080', '#ff4040', '#a01010'],
  super: ['#ffffff', '#fff0b0', '#ffa030', '#e02020'],
  dust: ['#e8dcc0', '#c8b898', '#a09070', '#786850'],
};

export class EffectsRenderer {
  private parts: Particle[] = [];
  private texts: FloatText[] = [];
  private bursts: Burst[] = [];
  reducedMotion = false;
  showDamage = true;

  clear(): void {
    this.parts.length = 0;
    this.texts.length = 0;
    this.bursts.length = 0;
  }

  get count(): number {
    return this.parts.length + this.bursts.length + this.texts.length;
  }

  // ---- spawners ---------------------------------------------------------

  hit(
    x: number,
    y: number,
    fx: HitFx,
    heavy: boolean,
    dir: number,
    counter = false,
  ): void {
    const pal = PAL[counter ? 'counter' : fx] ?? PAL.blunt;
    const n = this.reducedMotion ? 4 : heavy ? 16 : 9;
    this.bursts.push({
      x,
      y,
      life: heavy ? 10 : 7,
      maxLife: heavy ? 10 : 7,
      r: heavy ? 22 : 13,
      kind: counter ? 'counter' : fx,
      angle: dir > 0 ? 0 : Math.PI,
      scale: heavy ? 1.3 : 1,
    });
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.4 + (dir > 0 ? -0.2 : Math.PI + 0.2);
      const sp = (heavy ? 3.4 : 2.2) * (0.4 + Math.random());
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.8,
        life: 12 + Math.random() * 10,
        maxLife: 22,
        size: Math.random() < 0.3 ? 2 : 1,
        colors: pal,
        gravity: 0.16,
        kind: Math.random() < 0.3 ? 'shard' : 'spark',
      });
    }
    if (fx === 'slash' && !this.reducedMotion) {
      this.parts.push({
        x,
        y,
        vx: dir * 1.2,
        vy: -0.4,
        life: 8,
        maxLife: 8,
        size: 1,
        colors: PAL.slash,
        gravity: 0,
        kind: 'streak',
        angle: -0.7 * dir,
        len: 26,
      });
    }
  }

  block(x: number, y: number, dir: number): void {
    this.bursts.push({
      x,
      y,
      life: 6,
      maxLife: 6,
      r: 11,
      kind: 'block',
      angle: dir > 0 ? 0 : Math.PI,
      scale: 1,
    });
    const n = this.reducedMotion ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 1.6 + (dir > 0 ? -0.4 : Math.PI + 0.4);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * 2.4,
        vy: Math.sin(a) * 2.4 - 0.6,
        life: 8 + Math.random() * 6,
        maxLife: 14,
        size: 1,
        colors: PAL.block,
        gravity: 0.14,
        kind: 'spark',
      });
    }
  }

  dust(x: number, y: number, dir: number, strength = 1): void {
    if (this.reducedMotion) return;
    const n = Math.round(4 * strength);
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: -dir * (0.4 + Math.random() * 1.4) * strength,
        vy: -(0.3 + Math.random() * 0.9),
        life: 14 + Math.random() * 10,
        maxLife: 24,
        size: Math.random() < 0.4 ? 2 : 1,
        colors: PAL.dust,
        gravity: 0.03,
        kind: 'dust',
      });
    }
  }

  land(x: number, y: number, hard: boolean): void {
    const n = this.reducedMotion ? 3 : hard ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.parts.push({
        x,
        y,
        vx: dir * (0.6 + Math.random() * 2.2),
        vy: -(0.4 + Math.random() * 1.2),
        life: 12 + Math.random() * 10,
        maxLife: 22,
        size: Math.random() < 0.3 ? 2 : 1,
        colors: PAL.dust,
        gravity: 0.06,
        kind: 'dust',
      });
    }
  }

  ring(x: number, y: number, kind: HitFx | 'super', scale = 1): void {
    this.bursts.push({
      x,
      y,
      life: 16,
      maxLife: 16,
      r: 20 * scale,
      kind,
      angle: 0,
      scale,
    });
  }

  superFlash(x: number, y: number, color: string): void {
    const n = this.reducedMotion ? 8 : 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 2.6 + Math.random() * 2.4;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 18 + Math.random() * 10,
        maxLife: 28,
        size: Math.random() < 0.4 ? 2 : 1,
        colors: ['#ffffff', color, color, '#000000'],
        gravity: -0.02,
        kind: 'spark',
      });
    }
    this.ring(x, y, 'super', 2.2);
  }

  spiritAura(x: number, y: number, color: string): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 3; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.8 + Math.random() * 0.9),
        life: 18 + Math.random() * 14,
        maxLife: 32,
        size: 1,
        colors: ['#ffffff', color, color],
        gravity: -0.01,
        kind: 'ember',
      });
    }
  }

  damage(x: number, y: number, amount: number, counter: boolean): void {
    if (!this.showDamage) return;
    this.texts.push({
      x,
      y,
      vy: -1.2,
      life: 34,
      maxLife: 34,
      text: String(amount),
      color: counter ? '#ffd83c' : '#ffffff',
      size: counter ? 12 : 10,
      outline: '#1a0f14',
    });
  }

  label(x: number, y: number, text: string, color: string, size = 12): void {
    this.texts.push({
      x,
      y,
      vy: -0.7,
      life: 40,
      maxLife: 40,
      text,
      color,
      size,
      outline: '#1a0f14',
    });
  }

  // ---- update / draw ----------------------------------------------------

  update(): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      if (p.kind === 'dust') p.vx *= 0.94;
      p.life--;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life--;
      if (b.life <= 0) this.bursts.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y += t.vy;
      t.vy *= 0.94;
      t.life--;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    // hard cap so a long super never floods the field
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  }

  /** Draw particles and bursts (world -> screen transform already applied). */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bursts) this.drawBurst(ctx, b);
    for (const p of this.parts) this.drawParticle(ctx, p);
  }

  /** Damage numbers and combo labels draw above everything. */
  drawText(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number]): void {
    for (const t of this.texts) {
      const [sx, sy] = toScreen(t.x, t.y);
      const alpha = Math.min(1, t.life / 12);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${t.size}px "BayaniPixel", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.outline;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        ctx.fillText(t.text, sx + ox, sy + oy);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);
      ctx.restore();
    }
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    const t = 1 - p.life / p.maxLife;
    const ci = Math.min(p.colors.length - 1, Math.floor(t * p.colors.length));
    ctx.fillStyle = p.colors[ci];
    const s = p.size;
    if (p.kind === 'streak' && p.angle !== undefined && p.len) {
      const len = p.len * (1 - t);
      const dx = Math.cos(p.angle);
      const dy = Math.sin(p.angle);
      for (let i = 0; i < len; i++) {
        ctx.fillRect(Math.round(p.x + dx * i), Math.round(p.y + dy * i), 1, 1);
      }
      return;
    }
    if (p.kind === 'shard') {
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s + 1, s);
      return;
    }
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }

  private drawBurst(ctx: CanvasRenderingContext2D, b: Burst): void {
    const t = 1 - b.life / b.maxLife;
    const pal = PAL[b.kind] ?? PAL.blunt;
    const r = b.r * (0.4 + t * 1.1);

    if (b.kind === 'block') {
      // shield arc: a bracket of pixels
      ctx.fillStyle = pal[Math.min(pal.length - 1, Math.floor(t * pal.length))];
      for (let a = -0.9; a <= 0.9; a += 0.14) {
        const ax = b.x + Math.cos(a + b.angle) * r;
        const ay = b.y + Math.sin(a + b.angle) * r;
        ctx.fillRect(Math.round(ax), Math.round(ay), 2, 2);
      }
      return;
    }

    if (b.kind === 'super' || b.kind === 'counter') {
      // expanding double ring
      for (let k = 0; k < 2; k++) {
        const rr = r * (1 - k * 0.3);
        ctx.fillStyle = pal[Math.min(pal.length - 1, Math.floor(t * pal.length) + k)];
        const steps = Math.max(10, Math.round(rr * 1.4));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          if (i % 2 === 0 && t > 0.4) continue;
          ctx.fillRect(
            Math.round(b.x + Math.cos(a) * rr),
            Math.round(b.y + Math.sin(a) * rr * 0.82),
            2,
            2,
          );
        }
      }
      // cross flare
      if (t < 0.5) {
        ctx.fillStyle = '#ffffff';
        const L = r * 1.7;
        ctx.fillRect(Math.round(b.x - L), Math.round(b.y - 1), L * 2, 2);
        ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - L * 0.6), 2, L * 1.2);
      }
      return;
    }

    // impact star: 4 long spokes + 4 short, classic arcade hit flash
    const ci = Math.min(pal.length - 1, Math.floor(t * pal.length));
    ctx.fillStyle = pal[ci];
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + b.angle * 0.2;
      const len = (i % 2 === 0 ? r : r * 0.55) * b.scale;
      for (let s = 2; s < len; s++) {
        const w = s > len * 0.7 ? 1 : 2;
        ctx.fillRect(
          Math.round(b.x + Math.cos(a) * s),
          Math.round(b.y + Math.sin(a) * s),
          w,
          w,
        );
      }
    }
    if (t < 0.4) {
      ctx.fillStyle = '#ffffff';
      const cr = Math.max(2, r * 0.35);
      ctx.fillRect(Math.round(b.x - cr), Math.round(b.y - cr), cr * 2, cr * 2);
    }
  }
}
