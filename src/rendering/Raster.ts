// ============================================================================
// Raster - a tiny integer software rasteriser.
// ----------------------------------------------------------------------------
// Everything the sprite forge draws goes through here. We never use canvas
// path filling for characters, because canvas antialiases paths and this game
// must stay pixel-perfect (no AA anywhere on a sprite edge).
//
// Buffer format is Uint32 0xAABBGGRR (little-endian RGBA), matching ImageData.
// ============================================================================

export type RGBA = number;

export function rgba(r: number, g: number, b: number, a = 255): RGBA {
  return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

export function hex(color: string): RGBA {
  let s = color.trim();
  if (s[0] === '#') s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return rgba(r, g, b, a);
}

export function unpack(c: RGBA): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255];
}

export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const [ar, ag, ab, aa] = unpack(a);
  const [br, bg, bb, ba] = unpack(b);
  return rgba(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
    Math.round(aa + (ba - aa) * t),
  );
}

export function shade(c: RGBA, amount: number): RGBA {
  const [r, g, b, a] = unpack(c);
  if (amount >= 0) {
    return rgba(
      Math.round(r + (255 - r) * amount),
      Math.round(g + (255 - g) * amount),
      Math.round(b + (255 - b) * amount),
      a,
    );
  }
  const k = 1 + amount;
  return rgba(Math.round(r * k), Math.round(g * k), Math.round(b * k), a);
}

/** Build a 5-step shading ramp (darkest .. lightest) from a base colour. */
export function ramp5(base: string, spread = 1): RGBA[] {
  const b = hex(base);
  return [
    shade(b, -0.55 * spread),
    shade(b, -0.3 * spread),
    b,
    shade(b, 0.18 * spread),
    shade(b, 0.4 * spread),
  ];
}

export function rampFrom(colors: string[]): RGBA[] {
  return colors.map(hex);
}

export interface LimbOpts {
  /** 0..1 - shifts which ramp index the lit edge lands on */
  light?: number;
  /** flip which side is lit */
  flip?: boolean;
  /** flatten shading (for cloth / flat panels) */
  flat?: boolean;
  /** draw only if pixel is currently empty */
  behind?: boolean;
}

export class Raster {
  readonly w: number;
  readonly h: number;
  data: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  clear(): void {
    this.data.fill(0);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): RGBA {
    if (!this.inside(x, y)) return 0;
    return this.data[y * this.w + x];
  }

  px(x: number, y: number, c: RGBA): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if ((c >>> 24) === 0) return;
    this.data[y * this.w + x] = c;
  }

  /** only writes where the buffer is still transparent */
  pxBehind(x: number, y: number, c: RGBA): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.data[i] >>> 24) return;
    this.data[i] = c;
  }

  /** only writes where the buffer already has a pixel (shading pass) */
  pxOver(x: number, y: number, c: RGBA): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (!(this.data[i] >>> 24)) return;
    this.data[i] = c;
  }

  hline(x0: number, x1: number, y: number, c: RGBA): void {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = x0 | 0; x <= (x1 | 0); x++) this.px(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: RGBA): void {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = y0 | 0; y <= (y1 | 0); y++) this.px(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) this.hline(x, x + w - 1, y + j, c);
  }

  rectOutline(x: number, y: number, w: number, h: number, c: RGBA): void {
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
  }

  /** Bresenham line, 1px, no AA. */
  line(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Thick line built from stacked 1px lines - stays aliased. */
  thickLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    c: RGBA,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = (width - 1) / 2;
    for (let o = -half; o <= half; o += 0.5) {
      this.line(
        Math.round(x0 + nx * o),
        Math.round(y0 + ny * o),
        Math.round(x1 + nx * o),
        Math.round(y1 + ny * o),
        c,
      );
    }
  }

  /**
   * Tapered, cylinder-shaded limb: the workhorse of the sprite forge.
   * Shades across the limb's width using `ramp` so arms and legs read as
   * rounded volumes instead of flat bars. No AA: every pixel snaps to a ramp
   * entry.
   */
  limb(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    wa: number,
    wb: number,
    ramp: RGBA[],
    opts: LimbOpts = {},
  ): void {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.6) {
      this.blob(ax, ay, wa / 2, wa / 2, ramp, opts);
      return;
    }
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const maxW = Math.max(wa, wb) / 2 + 2;
    const minX = Math.floor(Math.min(ax, bx) - maxW);
    const maxX = Math.ceil(Math.max(ax, bx) + maxW);
    const minY = Math.floor(Math.min(ay, by) - maxW);
    const maxY = Math.ceil(Math.max(ay, by) + maxW);
    const n = ramp.length;
    const flip = opts.flip ? -1 : 1;
    const bias = (opts.light ?? 0.5) - 0.5;
    // light from upper-left of the sprite
    const lit = Math.sign(nx * -0.6 + ny * -0.8) || 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const rx = x - ax;
        const ry = y - ay;
        let t = (rx * ux + ry * uy) / len;
        if (t < -0.06 || t > 1.06) continue;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const halfW = (wa + (wb - wa) * t) / 2;
        if (halfW <= 0.25) continue;
        const perp = rx * nx + ry * ny;
        if (Math.abs(perp) > halfW + 0.4) continue;
        let u = (perp / halfW) * lit * flip; // -1 lit .. +1 shadow
        if (opts.flat) u *= 0.4;
        let idx = Math.round(((1 - u) / 2 + bias * 0.6) * (n - 1));
        if (Math.abs(u) > 0.78) idx -= 1;
        idx = idx < 0 ? 0 : idx > n - 1 ? n - 1 : idx;
        const col = ramp[idx];
        if (opts.behind) this.pxBehind(x, y, col);
        else this.px(x, y, col);
      }
    }
  }

  /** Shaded ellipse - heads, shoulders, pommels, shield bosses. */
  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: RGBA[],
    opts: LimbOpts = {},
  ): void {
    const n = ramp.length;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x - cx) / (rx + 0.0001);
        const ny = (y - cy) / (ry + 0.0001);
        const d = nx * nx + ny * ny;
        if (d > 1.04) continue;
        // light from upper-left
        const lit = (-nx * 0.62 - ny * 0.78 + 1) / 2;
        const spec = opts.flat ? 0.5 + (lit - 0.5) * 0.4 : lit;
        let idx = Math.round(spec * (n - 1));
        if (d > 0.86) idx = Math.max(0, idx - 1);
        const col = ramp[Math.max(0, Math.min(n - 1, idx))];
        if (opts.behind) this.pxBehind(x, y, col);
        else this.px(x, y, col);
      }
    }
  }

  /** Convex/concave polygon scanline fill (integer, no AA). */
  poly(pts: Array<[number, number]>, c: RGBA, behind = false): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0;
      const sy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (a[1] === b[1]) continue;
        if ((sy >= a[1] && sy < b[1]) || (sy >= b[1] && sy < a[1])) {
          const t = (sy - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + (b[0] - a[0]) * t);
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]);
        const xb = Math.round(xs[i + 1]);
        for (let x = xa; x <= xb; x++) {
          if (behind) this.pxBehind(x, y, c);
          else this.px(x, y, c);
        }
      }
    }
  }

  /** Polygon whose fill colour varies with a shading direction. */
  polyShaded(
    pts: Array<[number, number]>,
    ramp: RGBA[],
    dirX = -0.6,
    dirY = -0.8,
    behind = false,
  ): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY) / 2 + 0.001;
    const n = ramp.length;
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0;
      const sy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (a[1] === b[1]) continue;
        if ((sy >= a[1] && sy < b[1]) || (sy >= b[1] && sy < a[1])) {
          const t = (sy - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + (b[0] - a[0]) * t);
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]);
        const xb = Math.round(xs[i + 1]);
        for (let x = xa; x <= xb; x++) {
          const proj = ((x - cx) * dirX + (y - cy) * dirY) / span;
          const idx = Math.round(((proj + 1) / 2) * (n - 1));
          const col = ramp[Math.max(0, Math.min(n - 1, idx))];
          if (behind) this.pxBehind(x, y, col);
          else this.px(x, y, col);
        }
      }
    }
  }

  /** Replace every non-empty pixel matching `from` with `to`. */
  swapColor(from: RGBA, to: RGBA): void {
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (d[i] === from) d[i] = to;
  }

  /** Add a 1px outer outline around the silhouette. */
  outline(c: RGBA, corners = true): void {
    const { w, h, data } = this;
    const add: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (data[i] >>> 24) continue;
        let touch = false;
        for (let k = 0; k < 8; k++) {
          if (!corners && k >= 4) break;
          const ox = [1, -1, 0, 0, 1, 1, -1, -1][k];
          const oy = [0, 0, 1, -1, 1, -1, 1, -1][k];
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const v = data[ny * w + nx];
          if ((v >>> 24) && v !== c) {
            touch = true;
            break;
          }
        }
        if (touch) add.push(i);
      }
    }
    for (const i of add) data[i] = c;
  }

  /** Darken the bottom edge of the silhouette to fake occlusion contact. */
  contactShade(c: RGBA, rows = 2): void {
    const { w, h, data } = this;
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) {
        const i = y * w + x;
        if (!(data[i] >>> 24)) continue;
        for (let k = 0; k < rows; k++) {
          const j = (y - k) * w + x;
          if (j >= 0 && data[j] >>> 24) data[j] = mix(data[j], c, 0.35);
        }
        break;
      }
    }
  }

  /** Multiply every opaque pixel toward a tint (used for shadow clones). */
  tint(c: RGBA, t: number): void {
    const d = this.data;
    for (let i = 0; i < d.length; i++) {
      if (d[i] >>> 24) d[i] = mix(d[i], c, t);
    }
  }

  toImageData(): ImageData {
    const id = new ImageData(this.w, this.h);
    new Uint32Array(id.data.buffer).set(this.data);
    return id;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    ctx.putImageData(this.toImageData(), 0, 0);
    return cv;
  }
}
