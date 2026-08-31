// ============================================================================
// Head, face, hair and headgear. This is where "32-bit" is won or lost: the
// face must read as a face at ~18px tall, so features are placed by hand
// relative to the head ellipse and the three-quarter turn amount.
// ============================================================================

import { Raster, mix, shade, type RGBA } from '../Raster';
import type { BodyPlan } from '../BodyPlans';
import type { Pose } from '../PoseLib';
import type { Ramps } from './ramps';
import type { Skeleton, Pt } from './geometry';

const R = Math.PI / 180;

export function drawHead(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  const h = sk.head;
  const rx = sk.headR;
  const ry = sk.headRy;
  const tilt = (p.lean * 0.35 + p.headTilt) * R;
  // face direction: forward is +x, tilted with the head
  const fx = Math.cos(tilt);
  const fy = Math.sin(tilt);

  // --- skull ---------------------------------------------------------------
  r.blob(h.x, h.y, rx, ry, ra.skin);
  // jaw: slightly narrower, pushed forward-down
  r.blob(h.x + fx * rx * 0.32, h.y + ry * 0.52, rx * 0.74, ry * 0.5, ra.skin);
  // cheek shadow on the back half
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const nx = x / rx;
      const ny = y / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (nx < -0.34) r.pxOver(h.x + x, h.y + y, ra.skin[Math.max(0, 1)]);
    }
  }

  const eyeY = h.y - ry * 0.1;
  const browY = eyeY - ry * 0.3;
  const turn = p.headTurn;
  const expr = p.expr;

  // --- brow ridge ----------------------------------------------------------
  const bx0 = h.x + fx * rx * 0.12;
  const browLift = expr === 'shout' ? -1 : expr === 'pain' ? 1 : 0;
  r.hline(bx0 - rx * 0.18, bx0 + rx * 0.86, browY + browLift, ra.skin[1]);

  // --- eyes ----------------------------------------------------------------
  const drawEye = (ex: number, ey: number, w: number) => {
    if (expr === 'ko') {
      // X eyes for KO
      r.line(ex - 1, ey - 1, ex + w, ey + 1, ra.outline);
      r.line(ex - 1, ey + 1, ex + w, ey - 1, ra.outline);
      return;
    }
    if (expr === 'pain' || expr === 'shout') {
      // squeezed shut / narrowed
      r.hline(ex, ex + w, ey, ra.outline);
      r.hline(ex, ex + w - 1, ey + 1, ra.eyeDark);
      return;
    }
    r.hline(ex, ex + w, ey, ra.eye);
    r.hline(ex, ex + w, ey + 1, ra.eye);
    // iris toward the facing direction
    const ix = ex + Math.max(1, Math.round(w * 0.55));
    r.px(ix, ey, ra.eyeDark);
    r.px(ix, ey + 1, ra.eyeDark);
    // upper lid line
    r.hline(ex - 1, ex + w, ey - 1, ra.outline);
  };

  const eyeW = Math.max(2, Math.round(rx * 0.34));
  const frontEyeX = h.x + fx * rx * 0.34;
  drawEye(frontEyeX, eyeY, eyeW);
  if (turn > 0.35) {
    const backEyeX = h.x - rx * 0.28;
    drawEye(backEyeX, eyeY + Math.round(fy * 1.2), Math.max(1, eyeW - 1));
  }

  // --- nose ----------------------------------------------------------------
  const noseX = h.x + fx * rx * 0.86;
  const noseY = eyeY + ry * 0.26;
  r.px(noseX, noseY, ra.skin[1]);
  r.px(noseX, noseY + 1, ra.skin[1]);
  r.px(noseX - 1, noseY + 1, ra.skin[2]);
  r.px(noseX + 1, noseY, ra.skin[4]);

  // --- mouth ---------------------------------------------------------------
  const mx = h.x + fx * rx * 0.5;
  const my = h.y + ry * 0.56;
  const mw = Math.max(2, Math.round(rx * 0.42));
  if (expr === 'shout') {
    r.rect(mx, my - 1, mw, 3, ra.mouth);
    r.hline(mx, mx + mw - 1, my - 2, ra.skin[1]);
    r.hline(mx, mx + mw - 1, my, shade(ra.mouth, 0.35));
  } else if (expr === 'pain' || expr === 'hurt') {
    r.hline(mx, mx + mw, my, ra.mouth);
    r.px(mx + mw, my - 1, ra.mouth);
  } else if (expr === 'smirk') {
    r.hline(mx, mx + mw - 1, my, ra.mouth);
    r.px(mx + mw, my - 1, ra.mouth);
  } else if (expr === 'ko') {
    r.rect(mx, my - 1, mw, 2, ra.mouth);
  } else {
    r.hline(mx, mx + mw - 1, my, ra.skin[1]);
  }

  // chin highlight + neck shadow under jaw
  r.px(h.x + fx * rx * 0.6, h.y + ry * 0.86, ra.skin[4]);

  drawFacialHair(r, plan, h, rx, ry, fx, ra);
  drawHair(r, plan, p, sk, ra, fx, fy);
  drawHeadgear(r, plan, p, sk, ra, fx, fy);
}

function drawFacialHair(
  r: Raster,
  plan: BodyPlan,
  h: Pt,
  rx: number,
  ry: number,
  fx: number,
  ra: Ramps,
): void {
  if (!plan.facialHair) return;
  const c = ra.hair[1];
  const cl = ra.hair[2];
  const mx = h.x + fx * rx * 0.42;
  const my = h.y + ry * 0.46;
  if (plan.facialHair === 1) {
    // moustache
    r.hline(mx - 1, mx + rx * 0.62, my, c);
    r.hline(mx, mx + rx * 0.5, my + 1, cl);
  } else if (plan.facialHair === 2) {
    // full beard: hugs the jaw line
    for (let y = 0; y <= ry * 0.95; y++) {
      const t = y / (ry * 0.95);
      const w = rx * (0.95 - t * 0.42);
      const cx = h.x + fx * rx * 0.2;
      r.hline(cx - w * 0.72, cx + w * 0.86, my - 1 + y, y > ry * 0.5 ? c : cl);
    }
    r.hline(mx - 1, mx + rx * 0.6, my - 1, c);
  } else {
    // goatee
    r.rect(mx, my + 1, Math.max(2, rx * 0.42), Math.max(3, ry * 0.4), c);
    r.hline(mx - 1, mx + rx * 0.55, my - 1, cl);
  }
}

function drawHair(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
  fx: number,
  fy: number,
): void {
  const h = sk.head;
  const rx = sk.headR;
  const ry = sk.headRy;
  const H = ra.hair;
  const sway = p.cloth * 3;

  const cap = (thick: number) => {
    // scalp shell: an ellipse arc hugging the top of the skull
    for (let y = -ry - thick; y <= ry * 0.2; y++) {
      for (let x = -rx - thick; x <= rx + thick; x++) {
        const nx = x / (rx + thick);
        const ny = y / (ry + thick);
        const d = nx * nx + ny * ny;
        if (d > 1.02) continue;
        const inner = (x / rx) * (x / rx) + (y / ry) * (y / ry);
        if (inner < 0.82 && y > -ry * 0.4) continue;
        // front hairline recedes toward the face
        if (x > rx * 0.5 && y > -ry * 0.25) continue;
        const idx = d > 0.72 ? 1 : y < -ry * 0.5 ? 3 : 2;
        r.px(h.x + x, h.y + y, H[idx]);
      }
    }
  };

  switch (plan.hair) {
    case 'warriorLong': {
      cap(2);
      // mane flowing behind
      for (let i = 0; i < 5; i++) {
        const a = 200 + i * 12;
        const len = 18 + i * 3;
        const x0 = h.x - rx * 0.6;
        const y0 = h.y - ry * 0.2 + i * 2;
        r.limb(
          x0,
          y0,
          x0 - len * 0.55 - sway,
          y0 + len * 0.8,
          5 - i * 0.4,
          2,
          H,
          { flat: true, behind: true },
        );
      }
      break;
    }
    case 'wildLong':
    case 'shadowMane': {
      cap(3);
      for (let i = 0; i < 7; i++) {
        const x0 = h.x - rx * 0.4 + (i % 2) * 2;
        const y0 = h.y - ry * 0.9 + i * 2.4;
        const len = 22 + (i % 3) * 6;
        r.limb(
          x0,
          y0,
          x0 - len * 0.7 - sway * 1.6,
          y0 + len * (0.4 + (i % 3) * 0.2),
          4,
          1,
          H,
          { flat: true, behind: true },
        );
      }
      break;
    }
    case 'parted': {
      cap(2);
      // side part: a lighter sweep across the forehead
      r.limb(
        h.x - rx * 0.4,
        h.y - ry * 0.86,
        h.x + rx * 0.92,
        h.y - ry * 0.42,
        4,
        2,
        [H[2], H[3], H[4]],
        { flat: true },
      );
      break;
    }
    case 'sweptBack': {
      cap(2);
      for (let i = 0; i < 3; i++) {
        r.limb(
          h.x + rx * 0.4,
          h.y - ry * (0.8 - i * 0.16),
          h.x - rx * (1.05 + i * 0.12) - sway,
          h.y - ry * (0.5 - i * 0.3),
          3.4,
          1.6,
          H,
          { flat: true, behind: i > 0 },
        );
      }
      break;
    }
    case 'militaryShort':
      cap(1.4);
      break;
    case 'bob': {
      cap(2);
      for (let i = 0; i < 4; i++) {
        const x0 = h.x - rx * (0.7 - i * 0.1);
        r.limb(x0, h.y - ry * 0.4, x0 - 1 - sway * 0.5, h.y + ry * (0.9 + i * 0.1), 4, 3, H, {
          flat: true,
          behind: true,
        });
      }
      break;
    }
    case 'braidLong': {
      cap(2);
      // braid: chain of small blobs curving down the back
      let bx = h.x - rx * 0.75;
      let by = h.y - ry * 0.1;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        bx -= 1.1 + sway * 0.35;
        by += 3.4;
        const rr = 3.2 - t * 1.4;
        r.blob(bx + Math.sin(i * 1.5) * 0.8, by, rr, rr * 0.9, H, { behind: true });
      }
      r.blob(bx, by + 2, 1.6, 2.4, ra.accent, { behind: true });
      break;
    }
    case 'tiedTail': {
      cap(2);
      let bx = h.x - rx * 0.8;
      let by = h.y - ry * 0.3;
      r.blob(bx, by, 2.6, 2.6, ra.accent);
      for (let i = 0; i < 6; i++) {
        bx -= 1.6 + sway * 0.4;
        by += 2.8;
        r.blob(bx, by, 3 - i * 0.3, 2.6 - i * 0.2, H, { behind: true });
      }
      break;
    }
    case 'elderBun': {
      cap(2);
      r.blob(h.x - rx * 0.85, h.y - ry * 0.45, 4.4, 4.0, H, { behind: true });
      r.blob(h.x - rx * 0.85, h.y - ry * 0.45, 2.2, 2.0, [H[3], H[4], H[4]], {
        behind: false,
      });
      break;
    }
    case 'crownWrap':
      cap(1.6);
      break;
    case 'artistWave': {
      cap(2);
      for (let i = 0; i < 4; i++) {
        const x0 = h.x - rx * 0.5 + i;
        r.limb(
          x0,
          h.y - ry * 0.8,
          x0 - 5 - i * 1.5 - sway,
          h.y + ry * (0.2 + i * 0.22),
          3.6,
          1.8,
          H,
          { flat: true, behind: true },
        );
      }
      break;
    }
    default:
      cap(2);
  }
}

function drawHeadgear(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
  fx: number,
  fy: number,
): void {
  const h = sk.head;
  const rx = sk.headR;
  const ry = sk.headRy;
  const sway = p.cloth * 3;

  switch (plan.headgear) {
    case 'putongRed': {
      // wrapped cloth headband with a trailing knot
      const A = ra.accent;
      const C = ra.cloth;
      for (let y = -ry * 0.98; y <= -ry * 0.42; y++) {
        const t = (y + ry * 0.98) / (ry * 0.56);
        const w = rx * (1.02 - t * 0.1);
        const idx = t < 0.3 ? 3 : t < 0.7 ? 2 : 1;
        r.hline(h.x - w, h.x + w * 0.98, h.y + y, C[idx]);
      }
      // gold band edge
      r.hline(h.x - rx, h.x + rx * 0.95, h.y - ry * 0.44, A[3]);
      r.hline(h.x - rx, h.x + rx * 0.95, h.y - ry * 0.98, A[2]);
      // knot tails
      r.limb(h.x - rx * 0.9, h.y - ry * 0.6, h.x - rx * 1.9 - sway, h.y + ry * 0.3, 4, 2, C, {
        flat: true,
        behind: true,
      });
      r.limb(h.x - rx * 0.9, h.y - ry * 0.5, h.x - rx * 2.1 - sway * 1.4, h.y - ry * 0.1, 3, 1.5, C, {
        flat: true,
        behind: true,
      });
      break;
    }
    case 'salakot': {
      // wide conical woven hat
      const W = ra.wood;
      const brim = rx * 2.1;
      const top = h.y - ry * 1.5;
      r.polyShaded(
        [
          [h.x - brim, h.y - ry * 0.5],
          [h.x + brim * 0.95, h.y - ry * 0.5],
          [h.x + rx * 0.25, top],
          [h.x - rx * 0.35, top],
        ],
        W,
        -0.5,
        -0.86,
      );
      r.hline(h.x - brim, h.x + brim * 0.95, h.y - ry * 0.5, W[1]);
      r.hline(h.x - brim * 0.9, h.x + brim * 0.86, h.y - ry * 0.5 - 1, W[3]);
      // weave lines
      for (let i = 1; i <= 3; i++) {
        const yy = top + ((h.y - ry * 0.5 - top) * i) / 4;
        const ww = brim * (i / 4) * 0.9 + rx * 0.3;
        r.hline(h.x - ww, h.x + ww * 0.95, yy, W[1]);
      }
      break;
    }
    case 'turbanRoyal': {
      const C = ra.cloth;
      const A = ra.accent;
      r.blob(h.x - rx * 0.1, h.y - ry * 1.12, rx * 1.22, ry * 0.78, C);
      r.blob(h.x - rx * 0.5, h.y - ry * 1.3, rx * 0.6, ry * 0.42, C);
      // jewelled clasp
      r.blob(h.x + rx * 0.75, h.y - ry * 1.05, 2.6, 2.6, A);
      r.px(h.x + rx * 0.75, h.y - ry * 1.05, ra.accent2[4]);
      // wrap lines
      for (let i = 0; i < 3; i++) {
        r.line(
          h.x - rx * 1.2,
          h.y - ry * (0.9 + i * 0.2),
          h.x + rx * 1.0,
          h.y - ry * (1.15 + i * 0.16),
          C[1],
        );
      }
      // trailing sash
      r.limb(h.x - rx * 1.1, h.y - ry * 0.9, h.x - rx * 2.2 - sway, h.y + ry * 0.6, 5, 2, C, {
        flat: true,
        behind: true,
      });
      break;
    }
    case 'kerchief': {
      const C = ra.accent;
      for (let y = -ry * 0.95; y <= -ry * 0.5; y++) {
        const t = (y + ry * 0.95) / (ry * 0.45);
        r.hline(h.x - rx * (1.0 - t * 0.06), h.x + rx * 0.96, h.y + y, C[t < 0.5 ? 3 : 2]);
      }
      r.limb(h.x - rx * 0.9, h.y - ry * 0.62, h.x - rx * 1.8 - sway, h.y + ry * 0.1, 3.4, 1.6, C, {
        flat: true,
        behind: true,
      });
      break;
    }
    case 'officerCap': {
      const C = ra.clothAlt;
      const A = ra.accent;
      // crown
      r.blob(h.x - rx * 0.05, h.y - ry * 1.06, rx * 1.1, ry * 0.56, C);
      r.rect(h.x - rx * 1.1, h.y - ry * 0.78, rx * 2.15, 2, C[1]);
      // visor toward the face
      r.polyShaded(
        [
          [h.x + rx * 0.2, h.y - ry * 0.76],
          [h.x + rx * 1.55, h.y - ry * 0.6],
          [h.x + rx * 1.5, h.y - ry * 0.4],
          [h.x + rx * 0.2, h.y - ry * 0.52],
        ],
        ra.leather,
        -0.4,
        -0.9,
      );
      r.px(h.x + rx * 0.55, h.y - ry * 0.88, A[4]);
      r.px(h.x + rx * 0.75, h.y - ry * 0.88, A[3]);
      break;
    }
    case 'beret': {
      const C = ra.accent;
      r.blob(h.x - rx * 0.25, h.y - ry * 1.02, rx * 1.15, ry * 0.5, C);
      r.px(h.x - rx * 1.15, h.y - ry * 1.15, C[1]);
      break;
    }
    case 'shadowCrown': {
      const A = ra.accent;
      const M = ra.metalDark;
      // jagged crown of shards
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const bx = h.x - rx * 0.95 + t * rx * 1.95;
        const hh = ry * (0.7 + Math.sin(i * 1.9) * 0.34);
        r.polyShaded(
          [
            [bx - 2, h.y - ry * 0.8],
            [bx + 2, h.y - ry * 0.8],
            [bx + (i - 2) * 0.6, h.y - ry * 0.8 - hh],
          ],
          M,
          -0.5,
          -0.9,
        );
        r.px(bx + (i - 2) * 0.6, h.y - ry * 0.8 - hh, A[4]);
      }
      break;
    }
    default:
      break;
  }
}
