// ============================================================================
// Projectiles: spawned by moves, simulated by the engine.
// ============================================================================

import type { ProjectileDef, Box, HitDef } from '../game/types';
import { Fighter } from '../fighters/Fighter';

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: Fighter;
  def: ProjectileDef;
  dead = false;
  age = 0;
  facing: 1 | -1;

  constructor(owner: Fighter, def: ProjectileDef) {
    this.owner = owner;
    this.def = def;
    this.facing = owner.facing;
    this.x = owner.x + owner.facing * def.ox;
    this.y = owner.y + def.oy;
    this.vx = owner.facing * def.vx;
    this.vy = def.vy;
    this.life = def.life;
  }

  get box(): Box {
    return {
      x: this.x - this.def.w / 2,
      y: this.y - this.def.h / 2,
      w: this.def.w,
      h: this.def.h,
    };
  }

  /** synthesise a HitDef so the shared damage path can be reused */
  get hit(): HitDef {
    const d = this.def;
    return {
      start: 0,
      end: 999,
      box: { x: 0, y: 0, w: d.w, h: d.h },
      damage: d.damage,
      hitstun: d.hitstun,
      blockstun: d.blockstun,
      hitstop: d.hitstop,
      height: d.height,
      kbx: d.kbx,
      kby: d.kby,
      pushback: 0,
      launcher: d.launcher,
      meter: d.meter,
      fx: d.style === 'shadow' ? 'shadow' : d.style === 'paint' ? 'energy' : 'energy',
      sfx: 'special',
    };
  }

  step(): void {
    this.age++;
    this.x += this.vx;
    this.y += this.vy;
    if (this.def.gravity) this.vy -= this.def.gravity;
    this.life--;
    if (this.life <= 0) this.dead = true;
    if (this.y < -20) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    const d = this.def;
    const w = d.w;
    const h = d.h;
    const t = this.age;
    const cols = STYLE_COLORS[d.style] ?? STYLE_COLORS.light;

    switch (d.style) {
      case 'ink': {
        // a leading dart with a trailing tail of dashes
        for (let i = 0; i < 5; i++) {
          const tx = sx - this.facing * i * 5;
          const alpha = 1 - i * 0.18;
          ctx.fillStyle = cols[Math.min(cols.length - 1, i)];
          ctx.globalAlpha = alpha;
          const hh = Math.max(2, h - i * 2);
          ctx.fillRect(Math.round(tx - w / 4), Math.round(sy - hh / 2), Math.round(w / 2.4), hh);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(sx + this.facing * (w / 3)), Math.round(sy - 1), 3, 2);
        break;
      }
      case 'light': {
        const pulse = 1 + Math.sin(t * 0.4) * 0.14;
        for (let k = 3; k >= 0; k--) {
          ctx.fillStyle = cols[k];
          const rw = (w / 2) * pulse * (1 - k * 0.18);
          const rh = (h / 2) * pulse * (1 - k * 0.18);
          // diamond made of rows
          for (let yy = -rh; yy <= rh; yy++) {
            const frac = 1 - Math.abs(yy) / (rh + 0.001);
            const rowW = Math.round(rw * frac);
            ctx.fillRect(Math.round(sx - rowW), Math.round(sy + yy), rowW * 2, 1);
          }
        }
        break;
      }
      case 'shadow': {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = cols[i];
          const iw = w * (1 - i * 0.2);
          const ih = h * (1 - i * 0.18);
          const wobble = Math.sin(t * 0.5 + i) * 2;
          ctx.fillRect(
            Math.round(sx - iw / 2 - this.facing * i * 3),
            Math.round(sy - ih / 2 + wobble),
            Math.round(iw),
            Math.round(ih),
          );
        }
        // trailing wisps
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = cols[3];
          ctx.fillRect(
            Math.round(sx - this.facing * (w / 2 + i * 6)),
            Math.round(sy + Math.sin(t * 0.4 + i * 1.6) * 4),
            2,
            2,
          );
        }
        break;
      }
      case 'paint': {
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = cols[i % cols.length];
          const a = t * 0.3 + i * 1.3;
          const rr = w * 0.3;
          ctx.fillRect(
            Math.round(sx + Math.cos(a) * rr),
            Math.round(sy + Math.sin(a) * rr * 0.7),
            3,
            3,
          );
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 4);
        break;
      }
      default: {
        ctx.fillStyle = cols[1];
        ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h / 2), w, h);
        ctx.fillStyle = cols[0];
        ctx.fillRect(Math.round(sx - w / 4), Math.round(sy - h / 4), w / 2, h / 2);
        break;
      }
    }
  }
}

const STYLE_COLORS: Record<string, string[]> = {
  ink: ['#ffffff', '#c8d8f0', '#7088c0', '#2a3a68'],
  light: ['#ffffff', '#fff0b0', '#ffc850', '#e08820'],
  shadow: ['#e8d0ff', '#b070e8', '#7030b0', '#3a1060'],
  wind: ['#ffffff', '#d8f4ff', '#80c8e8', '#3878a0'],
  paint: ['#ff6a3c', '#ffd070', '#70c8ff', '#c060e0'],
  spark: ['#ffffff', '#ffe080', '#ff9030', '#c04010'],
};
