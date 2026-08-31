// ============================================================================
// StageRenderer: bakes each parallax layer to an offscreen pixel canvas once,
// then scrolls/animates them per frame. Layers are drawn with the same Raster
// rasteriser as the fighters so the whole scene shares one pixel grid.
// ============================================================================

import { Raster, hex, shade, mix, type RGBA } from './Raster';
import type { StageDef, StageLayerDef } from '../game/types';

const LAYER_H = 300;

interface BakedLayer {
  def: StageLayerDef;
  canvas: HTMLCanvasElement;
  /** tile width for horizontal repeat */
  tileW: number;
  /** animated overlay drawn per-frame instead of baked */
  dynamic: boolean;
}

export class StageRenderer {
  private stage: StageDef | null = null;
  private layers: BakedLayer[] = [];
  private skyCanvas: HTMLCanvasElement | null = null;
  private groundCanvas: HTMLCanvasElement | null = null;
  private rng = mulberry(1234);

  load(stage: StageDef): void {
    if (this.stage?.id === stage.id) return;
    this.stage = stage;
    this.layers = [];
    this.rng = mulberry(hashStr(stage.id));
    for (const l of stage.layers) {
      if (l.kind === 'sky') {
        this.skyCanvas = this.bakeSky(l, stage);
        continue;
      }
      this.layers.push(this.bakeLayer(l, stage));
    }
    this.groundCanvas = this.bakeGround(stage);
  }

  // ---- baking -----------------------------------------------------------

  private bakeSky(l: StageLayerDef, stage: StageDef): HTMLCanvasElement {
    const w = 8;
    const h = LAYER_H;
    const r = new Raster(w, h);
    const cols = l.colors.map(hex);
    for (let y = 0; y < h; y++) {
      const t = y / (h * 0.86);
      const idx = Math.min(cols.length - 1, Math.floor(t * (cols.length - 1)));
      const nextIdx = Math.min(cols.length - 1, idx + 1);
      const local = t * (cols.length - 1) - idx;
      // ordered dithering between bands keeps it pixel-art, not a smooth ramp
      for (let x = 0; x < w; x++) {
        const d = BAYER4[(y & 3) * 4 + (x & 3)] / 16;
        r.px(x, y, local > d ? cols[nextIdx] : cols[idx]);
      }
    }
    return r.toCanvas();
  }

  private bakeGround(stage: StageDef): HTMLCanvasElement {
    const w = 64;
    const h = 90;
    const r = new Raster(w, h);
    const cols = stage.ground.map(hex);
    const rng = mulberry(hashStr(stage.id + 'g'));
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const base = cols[Math.min(cols.length - 1, Math.floor(t * cols.length))];
      for (let x = 0; x < w; x++) {
        let c = base;
        // speckle texture
        const n = rng();
        if (n > 0.93) c = shade(base, 0.16);
        else if (n < 0.07) c = shade(base, -0.16);
        r.px(x, y, c);
      }
    }
    // top edge highlight line + a couple of horizontal cracks
    for (let x = 0; x < w; x++) r.px(x, 0, shade(cols[0], 0.3));
    for (let x = 0; x < w; x++) r.px(x, 1, shade(cols[0], 0.12));
    for (let i = 0; i < 3; i++) {
      const y = 8 + Math.floor(rng() * (h - 16));
      const x0 = Math.floor(rng() * w);
      const len = 6 + Math.floor(rng() * 18);
      for (let x = x0; x < x0 + len; x++) {
        r.px(x % w, y + ((x % 3) === 0 ? 1 : 0), shade(cols[cols.length - 1], -0.2));
      }
    }
    return r.toCanvas();
  }

  private bakeLayer(l: StageLayerDef, stage: StageDef): BakedLayer {
    const dynamic =
      l.kind === 'sea' ||
      l.kind === 'fire' ||
      l.kind === 'fog' ||
      l.kind === 'birds' ||
      l.kind === 'crowd' ||
      l.kind === 'flags' ||
      l.kind === 'bamboo' ||
      l.kind === 'trees' ||
      l.kind === 'lanterns' ||
      l.kind === 'shadowveil' ||
      l.kind === 'clouds';
    const tileW = dynamic ? 320 : 480;
    const r = new Raster(tileW, LAYER_H);
    if (!dynamic) this.paintLayer(r, l, tileW, 0);
    return { def: l, canvas: dynamic ? r.toCanvas() : r.toCanvas(), tileW, dynamic };
  }

  /** Static layer painting (also used as the base for dynamic layers). */
  private paintLayer(r: Raster, l: StageLayerDef, w: number, time: number): void {
    const c = l.colors.map(hex);
    const rng = mulberry(hashStr(l.kind + l.y + l.par));
    const baseY = l.y;

    switch (l.kind) {
      case 'mountains': {
        const n = l.density ?? 5;
        for (let i = 0; i < n; i++) {
          const px = (w / n) * i + rng() * 40 - 20;
          const height = 40 + rng() * 62;
          const halfW = 60 + rng() * 70;
          const shadeIdx = i % c.length;
          const pts: Array<[number, number]> = [
            [px - halfW, baseY],
            [px - halfW * 0.35, baseY - height * 0.72],
            [px, baseY - height],
            [px + halfW * 0.4, baseY - height * 0.66],
            [px + halfW, baseY],
          ];
          r.poly(pts, c[shadeIdx]);
          // ridge highlight
          r.line(px, baseY - height, px + halfW * 0.4, baseY - height * 0.66, shade(c[shadeIdx], 0.22));
          r.line(px - halfW * 0.35, baseY - height * 0.72, px, baseY - height, shade(c[shadeIdx], 0.3));
        }
        break;
      }
      case 'buildings': {
        const n = l.density ?? 5;
        for (let i = 0; i < n; i++) {
          const bw = 60 + rng() * 70;
          const bh = 58 + rng() * 66;
          const px = (w / n) * i + rng() * 24 - 12;
          const body = c[i % (c.length - 1)];
          r.rect(px, baseY - bh, bw, bh, body);
          r.hline(px, px + bw - 1, baseY - bh, shade(body, 0.26));
          r.vline(px, baseY - bh, baseY, shade(body, 0.18));
          r.vline(px + bw - 1, baseY - bh, baseY, c[c.length - 1]);
          // tiled roof
          r.poly(
            [
              [px - 6, baseY - bh],
              [px + bw + 6, baseY - bh],
              [px + bw - 4, baseY - bh - 12],
              [px + 4, baseY - bh - 12],
            ],
            c[c.length - 1],
          );
          r.hline(px - 6, px + bw + 6, baseY - bh - 1, shade(c[c.length - 1], 0.2));
          // windows in a grid
          const cols = Math.max(2, Math.floor(bw / 18));
          const rows = Math.max(2, Math.floor(bh / 20));
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              const wx = px + 8 + cx * ((bw - 14) / cols);
              const wy = baseY - bh + 12 + cy * ((bh - 18) / rows);
              const lit = rng() > 0.55;
              const wc = lit ? hex('#ffd070') : shade(body, -0.4);
              r.rect(wx, wy, 6, 8, wc);
              if (lit) r.px(wx + 1, wy + 1, hex('#fff0c0'));
              // shutter frame
              r.rectOutline(wx - 1, wy - 1, 8, 10, shade(body, -0.5));
            }
          }
        }
        break;
      }
      case 'wall': {
        const stone = c;
        const top = baseY - 74;
        r.rect(0, top, w, 74, stone[0]);
        // stone blocks
        let y = top;
        let row = 0;
        while (y < baseY) {
          const bh = 12;
          let x = row % 2 === 0 ? 0 : -14;
          while (x < w) {
            const bw = 26 + Math.floor(rng() * 12);
            const col = stone[1 + Math.floor(rng() * (stone.length - 2))];
            r.rect(x + 1, y + 1, bw - 2, bh - 2, col);
            r.hline(x + 1, x + bw - 2, y + 1, shade(col, 0.2));
            r.hline(x + 1, x + bw - 2, y + bh - 2, shade(col, -0.22));
            x += bw;
          }
          y += bh;
          row++;
        }
        // crenellations
        for (let x = 0; x < w; x += 34) {
          r.rect(x, top - 12, 20, 12, stone[2]);
          r.hline(x, x + 19, top - 12, shade(stone[2], 0.25));
        }
        break;
      }
      case 'ruins': {
        const n = l.density ?? 5;
        for (let i = 0; i < n; i++) {
          const px = (w / n) * i + rng() * 30;
          const h = 40 + rng() * 70;
          const bw = 18 + rng() * 16;
          const col = c[i % (c.length - 1)];
          // broken pillar
          r.rect(px, baseY - h, bw, h, col);
          r.vline(px, baseY - h, baseY, shade(col, 0.2));
          r.vline(px + bw - 1, baseY - h, baseY, shade(col, -0.25));
          // jagged top
          for (let x = 0; x < bw; x++) {
            const notch = Math.floor(rng() * 5);
            for (let k = 0; k < notch; k++) r.px(px + x, baseY - h + k, 0);
          }
          // carved bands
          for (let k = 1; k < 4; k++) {
            const yy = baseY - (h * k) / 4;
            r.hline(px, px + bw - 1, yy, shade(col, -0.3));
            r.hline(px, px + bw - 1, yy - 1, shade(col, 0.12));
          }
        }
        break;
      }
      case 'torii': {
        const n = l.density ?? 3;
        for (let i = 0; i < n; i++) {
          const px = (w / n) * i + 40 + rng() * 30;
          const h = 70 + rng() * 30;
          const span = 46 + rng() * 20;
          const col = c[i % (c.length - 1)];
          r.rect(px, baseY - h, 7, h, col);
          r.rect(px + span, baseY - h, 7, h, shade(col, -0.14));
          r.rect(px - 8, baseY - h - 8, span + 24, 7, shade(col, 0.16));
          r.rect(px - 3, baseY - h + 14, span + 14, 5, col);
          r.hline(px - 8, px + span + 16, baseY - h - 9, shade(col, 0.3));
        }
        break;
      }
      case 'tents': {
        const n = l.density ?? 4;
        for (let i = 0; i < n; i++) {
          const px = (w / n) * i + rng() * 40;
          const th = 34 + rng() * 20;
          const tw = 52 + rng() * 26;
          const col = c[i % (c.length - 1)];
          r.polyShaded(
            [
              [px, baseY],
              [px + tw / 2, baseY - th],
              [px + tw, baseY],
            ],
            [shade(col, -0.3), col, shade(col, 0.2)],
            -0.6,
            -0.5,
          );
          // entrance flap
          r.poly(
            [
              [px + tw / 2 - 7, baseY],
              [px + tw / 2, baseY - th * 0.55],
              [px + tw / 2 + 7, baseY],
            ],
            c[c.length - 1],
          );
          r.line(px, baseY, px + tw / 2, baseY - th, shade(col, 0.34));
          // guy ropes
          r.line(px + tw / 2, baseY - th, px + tw + 10, baseY, shade(col, -0.4));
        }
        break;
      }
      case 'ships': {
        const n = l.density ?? 3;
        for (let i = 0; i < n; i++) {
          const px = (w / n) * i + rng() * 50;
          const hullW = 70 + rng() * 50;
          const hullH = 16 + rng() * 8;
          const wood = c[0];
          const wood2 = c[1];
          const sail = c[2];
          // hull
          r.polyShaded(
            [
              [px, baseY - hullH],
              [px + hullW, baseY - hullH],
              [px + hullW - 8, baseY],
              [px + 6, baseY],
            ],
            [shade(wood, -0.3), wood, wood2],
            -0.4,
            -0.9,
          );
          r.hline(px, px + hullW, baseY - hullH, shade(wood2, 0.3));
          // mast + sail
          const mx = px + hullW * 0.44;
          const mh = 34 + rng() * 26;
          r.vline(mx, baseY - hullH - mh, baseY - hullH, wood2);
          r.polyShaded(
            [
              [mx + 1, baseY - hullH - mh + 4],
              [mx + 20 + rng() * 10, baseY - hullH - mh * 0.5],
              [mx + 1, baseY - hullH - 4],
            ],
            [shade(sail, -0.2), sail, shade(sail, 0.24)],
            -0.7,
            -0.4,
          );
          // outrigger arms
          r.line(px + 8, baseY - hullH + 3, px - 8, baseY - 2, wood2);
          r.line(px + hullW - 8, baseY - hullH + 3, px + hullW + 8, baseY - 2, wood2);
        }
        break;
      }
      case 'rubble': {
        const n = l.density ?? 10;
        for (let i = 0; i < n; i++) {
          const px = rng() * w;
          const size = 4 + rng() * 12;
          const col = c[Math.floor(rng() * c.length)];
          r.polyShaded(
            [
              [px, baseY],
              [px + size * 0.3, baseY - size * 0.8],
              [px + size, baseY - size * 0.3],
              [px + size * 1.1, baseY],
            ],
            [shade(col, -0.3), col, shade(col, 0.22)],
            -0.6,
            -0.8,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  // ---- per-frame drawing -------------------------------------------------

  /**
   * Draw the stage.
   * @param camX  camera x in world units (world x of the left screen edge)
   * @param viewW logical width of the view
   * @param viewH logical height of the view
   * @param groundY screen y of the floor line
   * @param t     frame counter
   */
  draw(
    ctx: CanvasRenderingContext2D,
    camX: number,
    viewW: number,
    viewH: number,
    groundY: number,
    t: number,
  ): void {
    const stage = this.stage;
    if (!stage) return;

    // sky fills everything above the floor
    if (this.skyCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.skyCanvas, 0, 0, this.skyCanvas.width, LAYER_H, 0, 0, viewW, groundY + 4);
    }

    for (const l of this.layers) {
      const off = -camX * l.def.par;
      if (l.dynamic) {
        this.drawDynamic(ctx, l, off, viewW, groundY, t);
      } else {
        this.tile(ctx, l.canvas, off, groundY, viewW, l.tileW);
      }
    }

    // ground
    if (this.groundCanvas) {
      const g = this.groundCanvas;
      const off = -(camX * 1) % g.width;
      for (let x = off - g.width; x < viewW + g.width; x += g.width) {
        ctx.drawImage(g, Math.round(x), groundY, g.width, viewH - groundY + 4);
      }
      // contact shadow line
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, groundY, viewW, 1);
    }

    // ambient tint
    if (stage.tint && stage.tintAlpha) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = stage.tintAlpha;
      ctx.fillStyle = stage.tint;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }
  }

  private tile(
    ctx: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    offset: number,
    groundY: number,
    viewW: number,
    tileW: number,
  ): void {
    const y = groundY - LAYER_H;
    let x = offset % tileW;
    if (x > 0) x -= tileW;
    for (; x < viewW + tileW; x += tileW) {
      ctx.drawImage(cv, Math.round(x), Math.round(y));
    }
  }

  /** Animated layers are drawn directly each frame (cheap primitives only). */
  private drawDynamic(
    ctx: CanvasRenderingContext2D,
    l: BakedLayer,
    offset: number,
    viewW: number,
    groundY: number,
    t: number,
  ): void {
    const d = l.def;
    const cols = d.colors;
    const y0 = groundY - LAYER_H + d.y;
    const spd = d.speed ?? 0.3;
    const rng = mulberry(hashStr(d.kind + d.y));

    switch (d.kind) {
      case 'clouds': {
        const n = d.density ?? 6;
        for (let i = 0; i < n; i++) {
          const baseX = rng() * 1200;
          const yy = y0 - rng() * 40;
          const scale = 0.7 + rng() * 0.9;
          const x = wrap(baseX + offset - t * spd, viewW + 200) - 100;
          drawCloud(ctx, x, yy, scale, cols);
        }
        break;
      }
      case 'birds': {
        const n = d.density ?? 5;
        for (let i = 0; i < n; i++) {
          const yy = y0 - rng() * 46;
          const x = wrap(rng() * 1000 + offset + t * spd, viewW + 80) - 40;
          const flap = Math.sin(t * 0.22 + i) > 0 ? 1 : -1;
          ctx.fillStyle = cols[0];
          ctx.fillRect(Math.round(x), Math.round(yy), 2, 1);
          ctx.fillRect(Math.round(x - 2), Math.round(yy - flap), 2, 1);
          ctx.fillRect(Math.round(x + 2), Math.round(yy - flap), 2, 1);
        }
        break;
      }
      case 'sea': {
        const amp = d.amp ?? 3;
        const top = y0;
        const h = groundY - top;
        // banded water with animated crest rows
        for (let row = 0; row < h; row += 3) {
          const t01 = row / h;
          const ci = Math.min(cols.length - 1, Math.floor(t01 * cols.length));
          ctx.fillStyle = cols[ci];
          ctx.fillRect(0, Math.round(top + row), viewW, 3);
        }
        for (let k = 0; k < 5; k++) {
          const yy = top + 4 + k * 7;
          ctx.fillStyle = cols[cols.length - 1];
          for (let x = 0; x < viewW; x += 6) {
            const ph = Math.sin((x + offset) * 0.06 + t * 0.09 * spd + k) * amp;
            if (ph > amp * 0.4) ctx.fillRect(x, Math.round(yy + ph * 0.4), 4, 1);
          }
        }
        break;
      }
      case 'fog': {
        const n = d.density ?? 5;
        ctx.save();
        ctx.globalAlpha = 0.16;
        for (let i = 0; i < n; i++) {
          const yy = y0 + rng() * 40;
          const x = wrap(rng() * 900 + offset - t * spd * 6, viewW + 300) - 150;
          const wSeg = 120 + rng() * 160;
          ctx.fillStyle = cols[i % cols.length];
          // banded fog: horizontal strips only, keeps it pixel-ish
          for (let s = 0; s < 4; s++) {
            ctx.fillRect(Math.round(x - s * 8), Math.round(yy + s * 3), wSeg + s * 12, 3);
          }
        }
        ctx.restore();
        break;
      }
      case 'shadowveil': {
        const n = d.density ?? 4;
        ctx.save();
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < n; i++) {
          const x = wrap(rng() * 900 + offset - t * spd * 4, viewW + 260) - 130;
          const yy = y0 + rng() * 90;
          ctx.fillStyle = cols[i % cols.length];
          const hh = 30 + rng() * 60;
          for (let s = 0; s < 6; s++) {
            const ww = 40 + Math.sin(t * 0.05 + i + s) * 18 + s * 6;
            ctx.fillRect(Math.round(x + s * 3), Math.round(yy + (hh / 6) * s), ww, 3);
          }
        }
        ctx.restore();
        break;
      }
      case 'trees': {
        const n = d.density ?? 7;
        for (let i = 0; i < n; i++) {
          const bx = (1200 / n) * i + rng() * 60;
          const x = wrapWorld(bx + offset, 1200);
          if (x < -80 || x > viewW + 80) continue;
          const th = 60 + rng() * 50;
          const sway = Math.sin(t * 0.03 * (d.speed ?? 0.5) + i) * 3;
          drawPalm(ctx, x, y0, th, sway, cols);
        }
        break;
      }
      case 'bamboo': {
        const n = d.density ?? 12;
        for (let i = 0; i < n; i++) {
          const bx = (1200 / n) * i + rng() * 40;
          const x = wrapWorld(bx + offset, 1200);
          if (x < -20 || x > viewW + 20) continue;
          const th = 130 + rng() * 130;
          const sway = Math.sin(t * 0.028 * (d.speed ?? 0.5) + i * 0.7) * 4;
          drawBamboo(ctx, x, y0, th, sway, cols, i);
        }
        break;
      }
      case 'crowd': {
        const n = d.density ?? 20;
        for (let i = 0; i < n; i++) {
          const bx = (1300 / n) * i + rng() * 24;
          const x = wrapWorld(bx + offset, 1300);
          if (x < -14 || x > viewW + 14) continue;
          const bob = Math.abs(Math.sin(t * 0.06 + i * 1.3)) * 3;
          const col = cols[i % cols.length];
          const hh = 22 + (i % 3) * 3;
          // body
          ctx.fillStyle = col;
          ctx.fillRect(Math.round(x), Math.round(y0 - hh + bob), 7, hh);
          // head
          ctx.fillStyle = shadeCss(col, 0.2);
          ctx.fillRect(Math.round(x + 1), Math.round(y0 - hh - 5 + bob), 5, 5);
          // raised arms occasionally
          if (i % 4 === 0) {
            ctx.fillStyle = col;
            const lift = Math.sin(t * 0.08 + i) > 0 ? 4 : 0;
            ctx.fillRect(Math.round(x - 2), Math.round(y0 - hh - 2 + bob - lift), 2, 7);
            ctx.fillRect(Math.round(x + 7), Math.round(y0 - hh - 2 + bob - lift), 2, 7);
          }
        }
        break;
      }
      case 'flags': {
        const n = d.density ?? 3;
        for (let i = 0; i < n; i++) {
          const bx = (900 / n) * i + rng() * 120;
          const x = wrapWorld(bx + offset, 900);
          if (x < -40 || x > viewW + 40) continue;
          const poleH = 70 + rng() * 30;
          drawFlag(ctx, x, y0, poleH, t * (d.speed ?? 0.7), cols, i);
        }
        break;
      }
      case 'lanterns': {
        const n = d.density ?? 5;
        for (let i = 0; i < n; i++) {
          const bx = (900 / n) * i + rng() * 80;
          const x = wrapWorld(bx + offset, 900);
          if (x < -20 || x > viewW + 20) continue;
          const sway = Math.sin(t * 0.04 + i) * 3;
          const yy = y0 + Math.sin(t * 0.05 + i) * 1;
          drawLantern(ctx, x + sway, yy, cols, t, i);
        }
        break;
      }
      case 'fire': {
        const n = d.density ?? 3;
        for (let i = 0; i < n; i++) {
          const bx = (900 / n) * i + rng() * 140;
          const x = wrapWorld(bx + offset, 900);
          if (x < -30 || x > viewW + 30) continue;
          drawFire(ctx, x, y0, cols, t, i);
        }
        break;
      }
      case 'stars': {
        const n = d.density ?? 24;
        for (let i = 0; i < n; i++) {
          const x = wrapWorld(rng() * 1200 + offset, 1200);
          const yy = y0 - rng() * 80;
          if (x < 0 || x > viewW) continue;
          const tw = Math.sin(t * 0.08 + i * 2.1);
          ctx.fillStyle = tw > 0.3 ? cols[0] : cols[1] ?? cols[0];
          ctx.fillRect(Math.round(x), Math.round(yy), 1, 1);
          if (tw > 0.9) {
            ctx.fillRect(Math.round(x) - 1, Math.round(yy), 3, 1);
            ctx.fillRect(Math.round(x), Math.round(yy) - 1, 1, 3);
          }
        }
        break;
      }
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// small pixel props drawn with fillRect only (keeps them aliased)
// ---------------------------------------------------------------------------

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  cols: string[],
): void {
  const w = Math.round(46 * s);
  const h = Math.round(11 * s);
  ctx.fillStyle = cols[0];
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
  ctx.fillRect(Math.round(x + w * 0.2), Math.round(y - h * 0.6), Math.round(w * 0.5), h);
  ctx.fillStyle = cols[1] ?? cols[0];
  ctx.fillRect(Math.round(x + 2), Math.round(y + h - 3), w - 6, 3);
  ctx.fillStyle = cols[2] ?? cols[1] ?? cols[0];
  ctx.fillRect(Math.round(x + 4), Math.round(y + h - 1), w - 12, 1);
}

function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  sway: number,
  cols: string[],
): void {
  // trunk
  ctx.fillStyle = cols[0];
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const off = sway * t * t;
    ctx.fillRect(Math.round(x + off), Math.round(baseY - i), 4, 1);
  }
  ctx.fillStyle = cols[1];
  for (let i = 0; i < h; i += 4) {
    const t = i / h;
    ctx.fillRect(Math.round(x + sway * t * t), Math.round(baseY - i), 1, 2);
  }
  // fronds
  const tx = x + sway;
  const ty = baseY - h;
  for (let f = 0; f < 6; f++) {
    const a = -0.3 + f * 0.42;
    const len = 20 + (f % 2) * 8;
    const col = cols[2 + (f % 2)];
    ctx.fillStyle = col;
    for (let s = 0; s < len; s++) {
      const px = tx + Math.cos(a) * s;
      const py = ty + Math.sin(a) * s * 0.5 + (s * s) / 120;
      ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    }
  }
}

function drawBamboo(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  sway: number,
  cols: string[],
  seed: number,
): void {
  const w = 5 + (seed % 3);
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const off = sway * t * t;
    ctx.fillStyle = cols[1 + (Math.floor(i / 22) % 2)];
    ctx.fillRect(Math.round(x + off), Math.round(baseY - i), w, 1);
    ctx.fillStyle = cols[3] ?? cols[2];
    ctx.fillRect(Math.round(x + off), Math.round(baseY - i), 1, 1);
    ctx.fillStyle = cols[0];
    ctx.fillRect(Math.round(x + off + w - 1), Math.round(baseY - i), 1, 1);
    // node rings
    if (i % 22 === 0) {
      ctx.fillStyle = cols[0];
      ctx.fillRect(Math.round(x + off - 1), Math.round(baseY - i), w + 2, 2);
    }
  }
  // leaves near the top
  const tx = x + sway;
  const ty = baseY - h;
  ctx.fillStyle = cols[3] ?? cols[2];
  for (let f = 0; f < 5; f++) {
    const dir = f % 2 === 0 ? 1 : -1;
    const yy = ty + f * 9;
    for (let s = 0; s < 14; s++) {
      ctx.fillRect(Math.round(tx + dir * s), Math.round(yy + s * 0.5), 2, 1);
    }
  }
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  poleH: number,
  t: number,
  cols: string[],
  seed: number,
): void {
  ctx.fillStyle = '#4a3a28';
  ctx.fillRect(Math.round(x), Math.round(baseY - poleH), 2, poleH);
  ctx.fillStyle = '#d8c890';
  ctx.fillRect(Math.round(x - 1), Math.round(baseY - poleH - 2), 4, 2);
  const fw = 26;
  const fh = 16;
  for (let cx = 0; cx < fw; cx++) {
    const wave = Math.sin(t * 0.14 + cx * 0.4 + seed) * (cx / fw) * 4;
    for (let cy = 0; cy < fh; cy++) {
      const band = cy < fh / 2 ? 0 : 1;
      ctx.fillStyle = cols[(band + seed) % cols.length];
      if (cx > fw - 4 && cy > fh - 3) continue;
      ctx.fillRect(
        Math.round(x + 2 + cx),
        Math.round(baseY - poleH + 2 + cy + wave),
        1,
        1,
      );
    }
    // shaded trailing edge
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(x + 2 + cx), Math.round(baseY - poleH + 2 + fh - 1 + wave), 1, 1);
  }
}

function drawLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cols: string[],
  t: number,
  seed: number,
): void {
  const flick = Math.sin(t * 0.3 + seed * 3) * 0.5 + 0.5;
  ctx.fillStyle = cols[2];
  ctx.fillRect(Math.round(x + 3), Math.round(y - 10), 1, 10);
  ctx.fillStyle = cols[1];
  ctx.fillRect(Math.round(x), Math.round(y), 8, 11);
  ctx.fillStyle = cols[0];
  ctx.fillRect(Math.round(x + 1), Math.round(y + 2), 6, 7);
  ctx.fillStyle = flick > 0.4 ? '#fff4c0' : cols[0];
  ctx.fillRect(Math.round(x + 3), Math.round(y + 4), 2, 3);
  // glow
  ctx.save();
  ctx.globalAlpha = 0.1 + flick * 0.1;
  ctx.fillStyle = cols[0];
  ctx.fillRect(Math.round(x - 6), Math.round(y - 4), 20, 20);
  ctx.restore();
}

function drawFire(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  cols: string[],
  t: number,
  seed: number,
): void {
  // logs
  ctx.fillStyle = cols[3];
  ctx.fillRect(Math.round(x - 8), Math.round(baseY - 3), 18, 3);
  ctx.fillRect(Math.round(x - 5), Math.round(baseY - 5), 12, 2);
  const h = 16 + Math.sin(t * 0.24 + seed) * 4;
  for (let i = 0; i < h; i++) {
    const t01 = i / h;
    const w = Math.max(1, Math.round((1 - t01) * 9 + Math.sin(t * 0.4 + i * 0.7 + seed) * 1.5));
    const ci = t01 > 0.72 ? 0 : t01 > 0.4 ? 1 : 2;
    ctx.fillStyle = cols[ci];
    ctx.fillRect(Math.round(x - w / 2 + Math.sin(t * 0.3 + i * 0.5) * 1.5), Math.round(baseY - 4 - i), w, 1);
  }
  // embers
  for (let e = 0; e < 3; e++) {
    const ey = baseY - 18 - ((t * 0.7 + e * 13) % 26);
    ctx.fillStyle = cols[0];
    ctx.fillRect(Math.round(x + Math.sin(t * 0.1 + e * 2) * 6), Math.round(ey), 1, 1);
  }
  // ground glow
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = cols[1];
  ctx.fillRect(Math.round(x - 16), Math.round(baseY - 8), 34, 10);
  ctx.restore();
}

// ---------------------------------------------------------------------------

const BAYER4 = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];

function wrap(v: number, span: number): number {
  let x = v % span;
  if (x < 0) x += span;
  return x;
}

function wrapWorld(v: number, span: number): number {
  let x = v % span;
  if (x < -span / 2) x += span;
  if (x > span) x -= span;
  return x;
}

function shadeCss(css: string, amt: number): string {
  const c = hex(css);
  const s = shade(c, amt);
  const r = s & 255;
  const g = (s >>> 8) & 255;
  const b = (s >>> 16) & 255;
  return `rgb(${r},${g},${b})`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
