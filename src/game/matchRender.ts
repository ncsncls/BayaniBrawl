// ============================================================================
// matchRender: one frame of canvas drawing for an active match.
// ============================================================================

import type { GameEngine } from './GameEngine';

export function renderMatch(e: GameEngine): void {
  const { canvas, ctx } = e;
  const w = Math.max(1, canvas.width);
  const h = Math.max(1, canvas.height);
  const viewW = e.camera.viewW;
  const viewH = e.camera.viewH;
  const groundY = viewH - 54;
  const sx = w / viewW;
  const sy = h / viewH;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = e.stage.ambient;
  ctx.fillRect(0, 0, w, h);
  ctx.scale(sx, sy);

  e.stageR.draw(ctx, e.camera.offsetX, viewW, viewH, groundY, e.frame);

  const toX = (x: number) => x - e.camera.offsetX;
  const toY = (y: number) => groundY - y + e.camera.offsetY;

  e.fighterR.drawShadow({ ctx, toX, toY, groundY, frame: e.frame, hitFlash: e.settings.hitFlash, showBoxes: false }, e.f1);
  e.fighterR.drawShadow({ ctx, toX, toY, groundY, frame: e.frame, hitFlash: e.settings.hitFlash, showBoxes: false }, e.f2);

  drawProjectiles(e, toX, toY);
  drawEffects(e, toX, toY);

  const first = e.f1.x <= e.f2.x ? e.f1 : e.f2;
  const second = first === e.f1 ? e.f2 : e.f1;
  const drawCtx = {
    ctx,
    toX,
    toY,
    groundY,
    frame: e.frame,
    hitFlash: e.settings.hitFlash,
    showBoxes: e.settings.showHitboxes,
  };
  e.fighterR.draw(drawCtx, first);
  e.fighterR.draw(drawCtx, second);

  if (e.settings.showHitboxes || e.settings.debug) {
    e.fighterR.drawBoxes(drawCtx, e.f1);
    e.fighterR.drawBoxes(drawCtx, e.f2);
  }

  e.fx.drawText(ctx, (x, y) => [toX(x), toY(y)]);
  drawHud(e, viewW, viewH);
  drawAnnouncements(e, viewW, viewH);
  drawDebug(e, viewW);

  if (e.settings.scanlines) drawScanlines(ctx, viewW, viewH);
  if (e.settings.crt) drawCrt(ctx, viewW, viewH);
  ctx.restore();
}

function drawProjectiles(e: GameEngine, toX: (x: number) => number, toY: (y: number) => number): void {
  const { ctx } = e;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const p of e.projectiles) p.draw(ctx, toX(p.x), toY(p.y));
  ctx.restore();
}

function drawEffects(e: GameEngine, toX: (x: number) => number, toY: (y: number) => number): void {
  const { ctx } = e;
  ctx.save();
  const original = ctx.fillRect.bind(ctx);
  ctx.fillRect = ((x: number, y: number, w: number, h: number) => {
    original(Math.round(toX(x)), Math.round(toY(y)), w, h);
  }) as typeof ctx.fillRect;
  e.fx.draw(ctx);
  ctx.restore();
  ctx.fillRect = original;
}

function drawHud(e: GameEngine, w: number, h: number): void {
  const { ctx } = e;
  const p1 = e.f1;
  const p2 = e.f2;
  bar(ctx, 26, 18, w * 0.37, 14, p1.hp / p1.maxHp, '#ffd83c', false);
  bar(ctx, w - 26 - w * 0.37, 18, w * 0.37, 14, p2.hp / p2.maxHp, '#ff4c50', true);
  meter(ctx, 28, h - 25, w * 0.3, p1.meter / 300);
  meter(ctx, w - 28 - w * 0.3, h - 25, w * 0.3, p2.meter / 300);

  text(ctx, p1.def.name.toUpperCase(), 28, 13, 9, '#fff4d0', 'left');
  text(ctx, p2.def.name.toUpperCase(), w - 28, 13, 9, '#fff4d0', 'right');
  text(ctx, String(Math.max(0, e.timer)).padStart(2, '0'), w / 2, 28, 24, '#fff4d0', 'center');
  text(ctx, `R${e.round}`, w / 2, 52, 8, '#ffd83c', 'center');
  for (let i = 0; i < e.roundsToWin; i++) {
    pip(ctx, 30 + i * 10, 37, i < e.wins[0]);
    pip(ctx, w - 30 - i * 10, 37, i < e.wins[1]);
  }
  if (p1.spirit) text(ctx, 'BAYANI SPIRIT', 30, 54, 8, '#ffd83c', 'left');
  if (p2.spirit) text(ctx, 'BAYANI SPIRIT', w - 30, 54, 8, '#ffd83c', 'right');
  if (e.combo) {
    const x = e.combo.who === 0 ? w * 0.2 : w * 0.8;
    text(ctx, `${e.combo.hits} HIT COMBO!`, x, 84, 13, '#fff4d0', 'center');
  }
}

function drawAnnouncements(e: GameEngine, w: number, h: number): void {
  if (!e.announce) return;
  const a = e.announce;
  const alpha = Math.min(1, a.life / 10, (a.maxLife - a.life) / 8);
  const size = a.big ? 30 : 15;
  e.ctx.save();
  e.ctx.globalAlpha = Math.max(0, alpha);
  text(e.ctx, a.text, w / 2, h * 0.38, size, '#fff4d0', 'center', '#240812');
  if (a.sub) text(e.ctx, a.sub, w / 2, h * 0.38 + 22, 9, '#ffd83c', 'center', '#240812');
  e.ctx.restore();
}

function drawDebug(e: GameEngine, w: number): void {
  if (!e.settings.debug) return;
  let y = 72;
  for (const line of e.snapshot().debug) {
    text(e.ctx, line, w - 8, y, 7, '#9cd8ff', 'right');
    y += 9;
  }
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  reverse: boolean,
): void {
  ctx.fillStyle = '#1b1018';
  ctx.fillRect(Math.round(x - 2), y - 2, Math.round(w + 4), h + 4);
  ctx.fillStyle = '#5a2030';
  ctx.fillRect(Math.round(x), y, Math.round(w), h);
  const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(reverse ? x + w - fw : x), y, fw, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x), y, Math.round(w), 1);
}

function meter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number): void {
  ctx.fillStyle = '#130d18';
  ctx.fillRect(Math.round(x - 2), y - 2, Math.round(w + 4), 8);
  ctx.fillStyle = '#2c2850';
  ctx.fillRect(Math.round(x), y, Math.round(w), 4);
  ctx.fillStyle = '#70c8ff';
  ctx.fillRect(Math.round(x), y, Math.round(w * Math.max(0, Math.min(1, ratio))), 4);
  for (let i = 1; i < 3; i++) {
    ctx.fillStyle = '#fff4d0';
    ctx.fillRect(Math.round(x + (w / 3) * i), y - 1, 1, 6);
  }
}

function pip(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  ctx.fillStyle = on ? '#ffd83c' : '#3a2830';
  ctx.fillRect(Math.round(x), y, 6, 6);
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign,
  outline = '#0a0610',
): void {
  ctx.font = `700 ${size}px "BayaniPixel", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = outline;
  ctx.fillText(value, x - 1, y);
  ctx.fillText(value, x + 1, y);
  ctx.fillText(value, x, y - 1);
  ctx.fillText(value, x, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

function drawCrt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.restore();
}
