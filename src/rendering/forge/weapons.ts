// ============================================================================
// Weapons + offhand items. Each is drawn along the weapon-hand axis so the
// blade tracks the animation, and each silhouette must be identifiable.
// ============================================================================

import { Raster, shade, mix, type RGBA } from '../Raster';
import type { BodyPlan } from '../BodyPlans';
import type { Pose } from '../PoseLib';
import type { Ramps } from './ramps';
import type { Skeleton, Pt } from './geometry';
import { angleOf } from './geometry';

const R = Math.PI / 180;

interface Axis {
  ox: number;
  oy: number;
  /** unit vector along the weapon */
  ux: number;
  uy: number;
  /** unit perpendicular */
  px: number;
  py: number;
}

function axis(sk: Skeleton, p: Pose): Axis {
  // weapon points away from the forearm, plus the pose's weapon rotation
  const fore = angleOf(sk.elbowF, sk.handF);
  const a = (fore + p.weapon) * R;
  const ux = Math.sin(a);
  const uy = Math.cos(a);
  return { ox: sk.handF.x, oy: sk.handF.y, ux, uy, px: -uy, py: ux };
}

function at(ax: Axis, along: number, perp: number): [number, number] {
  return [ax.ox + ax.ux * along + ax.px * perp, ax.oy + ax.uy * along + ax.py * perp];
}

export function drawWeapon(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  if (p.noWeapon || plan.weapon === 'fists') return;
  const ax = axis(sk, p);
  switch (plan.weapon) {
    case 'kampilan':
      kampilan(r, ax, ra);
      break;
    case 'bolo':
      bolo(r, ax, ra);
      break;
    case 'kris':
      kris(r, ax, ra);
      break;
    case 'sabre':
      sabre(r, ax, ra);
      break;
    case 'rapier':
      rapier(r, ax, ra);
      break;
    case 'cane':
      cane(r, ax, ra);
      break;
    case 'staff':
      staff(r, ax, ra);
      break;
    case 'bayonet':
      bayonetRifle(r, ax, ra);
      break;
    case 'brush':
      brush(r, ax, ra);
      break;
    case 'shadowblade':
      shadowblade(r, ax, ra);
      break;
    default:
      break;
  }
}

// --- individual weapons ------------------------------------------------------

function gripWrap(r: Raster, ax: Axis, len: number, ra: Ramps): void {
  for (let i = 0; i < len; i++) {
    const [x, y] = at(ax, -3 + i, 0);
    r.px(x, y, i % 2 === 0 ? ra.leather[2] : ra.leather[1]);
    const [x2, y2] = at(ax, -3 + i, 1);
    r.px(x2, y2, ra.leather[0]);
  }
}

function kampilan(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metal;
  const L = 42;
  // pommel (stylised okir-like crest, fictionalised)
  r.blob(...at(ax, -5, 0), 3.2, 3.2, ra.wood);
  r.px(...at(ax, -7, -1), ra.accent[3]);
  r.px(...at(ax, -7, 1), ra.accent[3]);
  gripWrap(r, ax, 8, ra);
  // guard
  r.polyShaded(
    [at(ax, 5, -3), at(ax, 7, -1), at(ax, 7, 1), at(ax, 5, 4)],
    ra.accent,
    -0.5,
    -0.86,
  );
  // blade: broad, widening toward the tip, with a notched back edge
  r.polyShaded(
    [
      at(ax, 7, -1.5),
      at(ax, L * 0.55, -2.6),
      at(ax, L * 0.86, -3.4),
      at(ax, L, -0.6),
      at(ax, L * 0.9, 2.2),
      at(ax, L * 0.5, 2.0),
      at(ax, 7, 2.0),
    ],
    M,
    -0.5,
    -0.86,
  );
  // fuller highlight
  r.line(...at(ax, 9, -0.4), ...at(ax, L * 0.9, -1.2), M[5] ?? M[4]);
  // spine shadow
  r.line(...at(ax, 8, 1.6), ...at(ax, L * 0.88, 1.8), M[0]);
  // back-edge notch detail
  r.px(...at(ax, L * 0.7, 2.6), M[1]);
  r.px(...at(ax, L * 0.78, 3.0), M[1]);
}

function bolo(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metal;
  const L = 34;
  r.blob(...at(ax, -4, 0), 2.6, 2.6, ra.wood);
  gripWrap(r, ax, 7, ra);
  // wide chopping blade, belly toward the cutting edge
  r.polyShaded(
    [
      at(ax, 5, -1.4),
      at(ax, L * 0.6, -3.2),
      at(ax, L * 0.92, -4.2),
      at(ax, L, -1.0),
      at(ax, L * 0.86, 1.6),
      at(ax, 5, 1.6),
    ],
    M,
    -0.5,
    -0.86,
  );
  r.line(...at(ax, 7, -0.6), ...at(ax, L * 0.86, -2.0), M[5] ?? M[4]);
  r.line(...at(ax, 6, 1.2), ...at(ax, L * 0.84, 1.2), M[0]);
}

function kris(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metal;
  const L = 46;
  r.blob(...at(ax, -5, 0.5), 3.4, 3.0, ra.wood);
  r.px(...at(ax, -7, 0), ra.accent[4]);
  gripWrap(r, ax, 9, ra);
  // flared guard
  r.polyShaded(
    [at(ax, 6, -4.5), at(ax, 9, -1), at(ax, 9, 1.5), at(ax, 6, 4.5)],
    ra.accent,
    -0.5,
    -0.86,
  );
  // wavy blade: 4 alternating segments
  let prevN = -1.2;
  for (let i = 0; i < 5; i++) {
    const a0 = 9 + (L - 9) * (i / 5);
    const a1 = 9 + (L - 9) * ((i + 1) / 5);
    const off = i % 2 === 0 ? 2.4 : -2.4;
    const n0 = prevN;
    const n1 = i === 4 ? 0 : off;
    r.polyShaded(
      [at(ax, a0, n0 - 1.7), at(ax, a1, n1 - 1.7), at(ax, a1, n1 + 1.7), at(ax, a0, n0 + 1.7)],
      M,
      -0.5,
      -0.86,
    );
    r.line(...at(ax, a0, n0 - 0.6), ...at(ax, a1, n1 - 0.6), M[5] ?? M[4]);
    prevN = n1;
  }
  r.polyShaded([at(ax, L - 3, -1.6), at(ax, L + 3, 0), at(ax, L - 3, 1.6)], M, -0.5, -0.86);
}

function sabre(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metal;
  const L = 40;
  r.blob(...at(ax, -4, 0), 2.4, 2.4, ra.accent);
  gripWrap(r, ax, 7, ra);
  // knuckle bow
  const A = ra.accent;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const a = 5 + t * 2;
    const n = -4.5 * Math.sin(t * Math.PI) - 1;
    r.px(...at(ax, a - t * 8, n), A[2 + (i % 2)]);
  }
  r.polyShaded([at(ax, 4, -3.4), at(ax, 7, -1), at(ax, 7, 1.6), at(ax, 4, 3.4)], A, -0.5, -0.86);
  // slim curved blade (approximated by 3 segments drifting off-axis)
  let n0 = -0.8;
  for (let i = 0; i < 3; i++) {
    const a0 = 7 + ((L - 7) * i) / 3;
    const a1 = 7 + ((L - 7) * (i + 1)) / 3;
    const n1 = n0 - 1.1;
    r.polyShaded(
      [at(ax, a0, n0 - 1.3), at(ax, a1, n1 - 1.3), at(ax, a1, n1 + 1.3), at(ax, a0, n0 + 1.3)],
      M,
      -0.5,
      -0.86,
    );
    r.line(...at(ax, a0, n0 - 0.4), ...at(ax, a1, n1 - 0.4), M[5] ?? M[4]);
    n0 = n1;
  }
  r.polyShaded([at(ax, L - 2, n0 - 1.4), at(ax, L + 3, n0 - 2.4), at(ax, L - 1, n0 + 1.2)], M, -0.5, -0.86);
}

function rapier(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metal;
  const L = 44;
  r.blob(...at(ax, -4, 0), 2.2, 2.2, ra.accent);
  gripWrap(r, ax, 6, ra);
  // swept hilt
  r.blob(...at(ax, 6, 0), 3.6, 3.2, ra.accent);
  r.blob(...at(ax, 6, 0), 2.0, 1.8, [ra.metalDark[0], ra.metalDark[1], ra.metalDark[2]]);
  // needle blade
  r.polyShaded(
    [at(ax, 8, -1.1), at(ax, L, -0.5), at(ax, L + 3, 0), at(ax, L, 0.5), at(ax, 8, 1.1)],
    M,
    -0.5,
    -0.86,
  );
  r.line(...at(ax, 9, -0.2), ...at(ax, L, -0.2), M[5] ?? M[4]);
}

function cane(r: Raster, ax: Axis, ra: Ramps): void {
  const W = ra.wood;
  const L = 38;
  // polished hardwood stick with brass ferrules
  r.limb(...at(ax, -6, 0), ...at(ax, L, 0), 3.4, 2.8, W);
  r.blob(...at(ax, -6, 0), 2.6, 2.6, ra.accent);
  for (const a of [2, L * 0.5, L - 2]) {
    const [x, y] = at(ax, a, 0);
    r.blob(x, y, 2.2, 2.0, ra.accent);
  }
  r.line(...at(ax, -4, -1), ...at(ax, L - 1, -1), W[4]);
}

function staff(r: Raster, ax: Axis, ra: Ramps): void {
  const W = ra.wood;
  const L = 52;
  r.limb(...at(ax, -22, 0), ...at(ax, L, 0), 3.2, 2.6, W);
  // bound grip
  for (let i = -4; i < 5; i++) {
    const [x, y] = at(ax, i, 0);
    r.px(x, y, i % 2 === 0 ? ra.leather[1] : ra.leather[2]);
  }
  // carved head
  r.blob(...at(ax, L, 0), 3.6, 3.2, ra.accent);
  r.blob(...at(ax, L, 0), 1.8, 1.6, [ra.accent2[3], ra.accent2[4], ra.accent2[4]]);
  r.px(...at(ax, -22, 0), W[0]);
}

function bayonetRifle(r: Raster, ax: Axis, ra: Ramps): void {
  const W = ra.wood;
  const M = ra.metal;
  const L = 46;
  // stock behind the hand
  r.polyShaded(
    [at(ax, -18, -2.4), at(ax, -4, -3.0), at(ax, -4, 2.6), at(ax, -16, 3.4)],
    W,
    -0.5,
    -0.86,
  );
  // body + barrel
  r.limb(...at(ax, -6, -0.6), ...at(ax, L * 0.72, -0.6), 4.0, 2.4, W);
  r.limb(...at(ax, L * 0.34, -1.6), ...at(ax, L * 0.78, -1.6), 2.2, 2.0, ra.metalDark);
  // bolt + trigger guard
  r.px(...at(ax, 2, -3), M[4]);
  r.blob(...at(ax, -2, 3), 1.8, 1.6, ra.metalDark);
  // bayonet blade
  r.polyShaded(
    [
      at(ax, L * 0.78, -2.4),
      at(ax, L, -1.6),
      at(ax, L + 4, -0.8),
      at(ax, L, 0.4),
      at(ax, L * 0.78, 0.2),
    ],
    M,
    -0.5,
    -0.86,
  );
  r.line(...at(ax, L * 0.8, -1.4), ...at(ax, L + 2, -1.0), M[5] ?? M[4]);
}

function brush(r: Raster, ax: Axis, ra: Ramps): void {
  const W = ra.wood;
  const L = 30;
  r.limb(...at(ax, -5, 0), ...at(ax, L * 0.72, 0), 2.8, 2.4, W);
  r.blob(...at(ax, L * 0.78, 0), 2.6, 2.4, ra.metalDark);
  // bristles loaded with paint
  const A = ra.accent;
  r.polyShaded(
    [at(ax, L * 0.82, -2.6), at(ax, L + 2, -1.2), at(ax, L + 3, 0.6), at(ax, L * 0.82, 2.4)],
    A,
    -0.5,
    -0.86,
  );
  r.px(...at(ax, L + 3, 0), ra.accent2[4]);
}

function shadowblade(r: Raster, ax: Axis, ra: Ramps): void {
  const M = ra.metalDark;
  const L = 54;
  r.blob(...at(ax, -6, 0), 3.6, 3.4, [ra.black, M[0], M[1]]);
  gripWrap(r, ax, 9, ra);
  // jagged, asymmetric blade
  r.polyShaded(
    [
      at(ax, 6, -2.4),
      at(ax, L * 0.32, -4.6),
      at(ax, L * 0.5, -2.8),
      at(ax, L * 0.72, -5.4),
      at(ax, L * 0.9, -2.6),
      at(ax, L + 2, -0.4),
      at(ax, L * 0.8, 2.6),
      at(ax, L * 0.4, 2.4),
      at(ax, 6, 2.6),
    ],
    M,
    -0.5,
    -0.86,
  );
  // glowing seam down the blade
  r.line(...at(ax, 8, -0.6), ...at(ax, L * 0.94, -1.0), ra.aura);
  r.px(...at(ax, L * 0.5, -1), ra.auraLite);
  r.px(...at(ax, L * 0.75, -1), ra.auraLite);
}

// --- offhand ---------------------------------------------------------------

export function drawOffhand(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
  behind: boolean,
): void {
  const guard = p.guard ?? 0;
  const h = sk.handB;
  switch (plan.offhand) {
    case 'shield': {
      if (behind) return;
      // round wooden shield with a metal boss and painted rim
      const rr = 11 + guard * 1.5;
      r.blob(h.x, h.y, rr, rr * 1.08, ra.wood);
      // rim
      for (let a = 0; a < 360; a += 6) {
        const rad = a * R;
        r.px(h.x + Math.cos(rad) * rr, h.y + Math.sin(rad) * rr * 1.08, ra.accent[2]);
      }
      // painted quarters
      r.blob(h.x, h.y, rr * 0.62, rr * 0.66, ra.cloth);
      r.blob(h.x, h.y, rr * 0.26, rr * 0.28, ra.metal);
      r.px(h.x - rr * 0.1, h.y - rr * 0.14, ra.metal[5] ?? ra.metal[4]);
      // boss rivets
      for (let a = 0; a < 360; a += 90) {
        const rad = (a + 45) * R;
        r.px(h.x + Math.cos(rad) * rr * 0.78, h.y + Math.sin(rad) * rr * 0.8, ra.accent[4]);
      }
      break;
    }
    case 'sheath': {
      if (!behind) return;
      const { up, fwd, pelvis } = sk;
      const x0 = pelvis.x - fwd.x * 4 + up.x * 2;
      const y0 = pelvis.y - fwd.y * 4 + up.y * 2;
      r.limb(x0, y0, x0 - 14, y0 + 16, 4, 2.6, ra.leather, { flat: true, behind: true });
      r.px(x0 - 13, y0 + 15, ra.accent[3]);
      break;
    }
    case 'book': {
      if (behind) return;
      r.polyShaded(
        [
          [h.x - 5, h.y - 4],
          [h.x + 5, h.y - 5],
          [h.x + 5, h.y + 4],
          [h.x - 5, h.y + 5],
        ],
        ra.clothAlt,
        -0.5,
        -0.86,
      );
      r.vline(h.x + 4, h.y - 4, h.y + 4, ra.accent2[4]);
      r.px(h.x, h.y - 1, ra.accent[3]);
      break;
    }
    case 'palette': {
      if (behind) return;
      r.blob(h.x, h.y, 7, 5.2, ra.wood);
      r.blob(h.x + 3, h.y + 1, 1.6, 1.4, [ra.black, ra.black, ra.black]);
      const dots = [ra.accent[3], ra.aura, ra.accent2[4], ra.cloth[3]];
      dots.forEach((c, i) => r.px(h.x - 4 + i * 2, h.y - 2, c));
      break;
    }
    case 'lantern': {
      if (behind) return;
      // hanging lantern: warm glow
      const lx = h.x;
      const ly = h.y + 8;
      r.vline(lx, h.y, ly - 4, ra.metalDark[1]);
      r.polyShaded(
        [
          [lx - 4, ly - 4],
          [lx + 4, ly - 4],
          [lx + 3, ly + 5],
          [lx - 3, ly + 5],
        ],
        ra.accent,
        -0.5,
        -0.86,
      );
      r.blob(lx, ly, 2.2, 3, [ra.accent2[3], ra.accent2[4], ra.white]);
      r.hline(lx - 4, lx + 4, ly - 5, ra.metalDark[2]);
      break;
    }
    case 'cloth': {
      if (!behind) return;
      const { up, fwd, pelvis } = sk;
      const bx = pelvis.x - fwd.x * 5;
      const by = pelvis.y + up.y * 2;
      r.limb(bx, by, bx - 10 - p.cloth * 6, by + 18, 4, 1.8, ra.accent, {
        flat: true,
        behind: true,
      });
      break;
    }
    default:
      break;
  }
}
