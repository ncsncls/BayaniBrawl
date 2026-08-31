// ============================================================================
// Torso, outfit, limbs, cloth. Draw order matters: back limbs, then cloth
// behind, then torso, then front limbs, then belts/details on top.
// ============================================================================

import { Raster, shade, type RGBA } from '../Raster';
import type { BodyPlan } from '../BodyPlans';
import type { Pose } from '../PoseLib';
import type { Ramps } from './ramps';
import type { Skeleton, Pt } from './geometry';

function taper(w: number, k: number): number {
  return Math.max(2, w * k);
}

/** Back arm + back leg, drawn darker so depth reads. */
export function drawBackLimbs(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  const skinB = ra.skin.map((c) => shade(c, -0.26));
  const clothB = ra.cloth.map((c) => shade(c, -0.3));
  const leatherB = ra.leather.map((c) => shade(c, -0.3));
  const legW = plan.legW;

  // back leg
  r.limb(sk.hipB.x, sk.hipB.y, sk.kneeB.x, sk.kneeB.y, legW * 1.06, legW * 0.82, clothB, {
    flip: true,
  });
  r.limb(
    sk.kneeB.x,
    sk.kneeB.y,
    sk.footB.x,
    sk.footB.y,
    legW * 0.8,
    legW * 0.6,
    plan.boot > 0 ? leatherB : clothB,
    { flip: true },
  );
  drawFoot(r, plan, sk.footB, sk, leatherB, skinB, true);

  // back arm
  r.limb(
    sk.shoulderB.x,
    sk.shoulderB.y,
    sk.elbowB.x,
    sk.elbowB.y,
    plan.armW * 1.1,
    plan.armW * 0.88,
    sleeveRamp(plan, ra, true),
    { flip: true },
  );
  r.limb(
    sk.elbowB.x,
    sk.elbowB.y,
    sk.handB.x,
    sk.handB.y,
    plan.armW * 0.86,
    plan.armW * 0.7,
    skinB,
    { flip: true },
  );
  drawHand(r, plan, sk.handB, plan.armW * 0.78, skinB, ra, true);
}

export function drawFrontLimbs(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  const legW = plan.legW;
  // front leg
  r.limb(sk.hipF.x, sk.hipF.y, sk.kneeF.x, sk.kneeF.y, legW * 1.1, legW * 0.86, ra.cloth);
  r.limb(
    sk.kneeF.x,
    sk.kneeF.y,
    sk.footF.x,
    sk.footF.y,
    legW * 0.84,
    legW * 0.62,
    plan.boot > 0 ? ra.leather : ra.cloth,
  );
  // knee highlight
  r.px(sk.kneeF.x, sk.kneeF.y - 1, ra.cloth[4]);
  drawFoot(r, plan, sk.footF, sk, ra.leather, ra.skin, false);

  // front arm
  r.limb(
    sk.shoulderF.x,
    sk.shoulderF.y,
    sk.elbowF.x,
    sk.elbowF.y,
    plan.armW * 1.14,
    plan.armW * 0.92,
    sleeveRamp(plan, ra, false),
  );
  // forearm: skin (rolled sleeves) with a muscle highlight
  r.limb(
    sk.elbowF.x,
    sk.elbowF.y,
    sk.handF.x,
    sk.handF.y,
    plan.armW * 0.9,
    plan.armW * 0.72,
    ra.skin,
  );
  if (plan.bulk > 0.6) {
    const mx = (sk.shoulderF.x + sk.elbowF.x) / 2;
    const my = (sk.shoulderF.y + sk.elbowF.y) / 2;
    r.pxOver(mx, my - 1, sleeveRamp(plan, ra, false)[4]);
  }
  drawHand(r, plan, sk.handF, plan.armW * 0.82, ra.skin, ra, false);
}

function sleeveRamp(plan: BodyPlan, ra: Ramps, back: boolean): RGBA[] {
  const base =
    plan.outfit === 'datu' || plan.outfit === 'sultan'
      ? ra.skin
      : plan.outfit === 'katipunan'
        ? ra.accent2
        : ra.cloth;
  return back ? base.map((c) => shade(c, -0.28)) : base;
}

function drawFoot(
  r: Raster,
  plan: BodyPlan,
  foot: Pt,
  sk: Skeleton,
  leather: RGBA[],
  skin: RGBA[],
  back: boolean,
): void {
  const w = plan.legW * 1.15;
  const hgt = Math.max(3, plan.legW * 0.5);
  if (plan.boot > 0) {
    r.polyShaded(
      [
        [foot.x - w * 0.45, foot.y - hgt],
        [foot.x + w * 0.95, foot.y - hgt * 0.8],
        [foot.x + w * 1.0, foot.y],
        [foot.x - w * 0.5, foot.y],
      ],
      leather,
      -0.4,
      -0.9,
    );
    r.hline(foot.x - w * 0.5, foot.x + w, foot.y, leather[0]);
  } else {
    r.blob(foot.x + w * 0.2, foot.y - hgt * 0.5, w * 0.7, hgt * 0.7, skin);
    r.hline(foot.x - w * 0.4, foot.x + w * 0.85, foot.y, skin[1]);
  }
}

function drawHand(
  r: Raster,
  plan: BodyPlan,
  hand: Pt,
  size: number,
  skin: RGBA[],
  ra: Ramps,
  back: boolean,
): void {
  const s = Math.max(2.4, size * 0.62);
  r.blob(hand.x, hand.y, s, s * 0.94, skin);
  // knuckle pixels for definition when big enough
  if (s >= 3) {
    r.pxOver(hand.x + s * 0.5, hand.y - s * 0.4, skin[5] ?? skin[skin.length - 1]);
    r.pxOver(hand.x - s * 0.4, hand.y + s * 0.4, skin[1]);
  }
}

// ---------------------------------------------------------------------------
// Torso
// ---------------------------------------------------------------------------

export function drawTorso(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  const { up, fwd } = sk;
  const chestW = plan.chestW * (plan.fem ? 0.94 : 1);
  const waistW = plan.torsoW * 0.86;
  const hipW = plan.hipW;

  const at = (base: Pt, u: number, f: number): [number, number] => [
    base.x + up.x * u + fwd.x * f,
    base.y + up.y * u + fwd.y * f,
  ];

  // silhouette: shoulders -> chest -> waist -> hips
  const pts: Array<[number, number]> = [
    at(sk.neck, 2, chestW * 0.46),
    at(sk.chest, 2, chestW * 0.5),
    at(sk.chest, -plan.torsoLen * 0.3, waistW * 0.44),
    at(sk.pelvis, 1, hipW * 0.5),
    at(sk.pelvis, -2, hipW * 0.46),
    at(sk.pelvis, -2, -hipW * 0.46),
    at(sk.pelvis, 1, -hipW * 0.5),
    at(sk.chest, -plan.torsoLen * 0.3, -waistW * 0.44),
    at(sk.chest, 2, -chestW * 0.48),
    at(sk.neck, 2, -chestW * 0.44),
  ];

  const body = outfitRamp(plan, ra);
  r.polyShaded(pts, body, -0.55, -0.84);

  // neck
  r.limb(
    sk.neck.x + up.x * -1,
    sk.neck.y + up.y * -1,
    sk.neck.x + up.x * plan.neckLen,
    sk.neck.y + up.y * plan.neckLen,
    plan.armW * 1.1,
    plan.armW * 1.0,
    ra.skin.map((c) => shade(c, -0.12)),
  );

  drawOutfitDetail(r, plan, p, sk, ra);
  drawShoulders(r, plan, sk, ra);
}

function outfitRamp(plan: BodyPlan, ra: Ramps): RGBA[] {
  switch (plan.outfit) {
    case 'datu':
    case 'sultan':
      return ra.skin;
    case 'katipunan':
      return ra.accent2;
    default:
      return ra.cloth;
  }
}

function drawShoulders(r: Raster, plan: BodyPlan, sk: Skeleton, ra: Ramps): void {
  const rr = plan.armW * 0.82;
  const ramp = outfitRamp(plan, ra);
  r.blob(sk.shoulderB.x, sk.shoulderB.y, rr, rr, ramp.map((c) => shade(c, -0.26)));
  r.blob(sk.shoulderF.x, sk.shoulderF.y, rr * 1.06, rr * 1.06, ramp);
  if (plan.pauldron) {
    const M = ra.metal;
    r.blob(sk.shoulderF.x, sk.shoulderF.y - 1, rr * 1.35, rr * 0.95, M);
    r.hline(sk.shoulderF.x - rr, sk.shoulderF.x + rr, sk.shoulderF.y + rr * 0.7, M[0]);
    r.px(sk.shoulderF.x - rr * 0.4, sk.shoulderF.y - rr * 0.55, M[5] ?? M[4]);
    r.blob(
      sk.shoulderB.x,
      sk.shoulderB.y - 1,
      rr * 1.2,
      rr * 0.85,
      M.map((c) => shade(c, -0.3)),
    );
  }
}

/** Collars, sashes, jackets, chest details - the read-at-a-glance identity. */
function drawOutfitDetail(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  const { up, fwd } = sk;
  const A = ra.accent;
  const A2 = ra.accent2;
  const C = ra.cloth;
  const CA = ra.clothAlt;
  const L = ra.leather;
  const at = (base: Pt, u: number, f: number): [number, number] => [
    base.x + up.x * u + fwd.x * f,
    base.y + up.y * u + fwd.y * f,
  ];
  const chestW = plan.chestW;
  const torsoLen = plan.torsoLen;

  switch (plan.outfit) {
    case 'datu': {
      // bare chest + crossed baldric + gold pectoral
      r.polyShaded(
        [
          at(sk.neck, 1, chestW * 0.4),
          at(sk.pelvis, torsoLen * 0.42, -chestW * 0.1),
          at(sk.pelvis, torsoLen * 0.3, -chestW * 0.3),
          at(sk.neck, 0, chestW * 0.18),
        ],
        L,
        -0.5,
        -0.85,
      );
      // pectoral collar
      r.polyShaded(
        [
          at(sk.neck, 1, chestW * 0.46),
          at(sk.neck, -3, chestW * 0.3),
          at(sk.neck, -4, -chestW * 0.3),
          at(sk.neck, 1, -chestW * 0.44),
        ],
        A,
        -0.5,
        -0.85,
      );
      // abs shading
      const mid = at(sk.chest, -torsoLen * 0.16, chestW * 0.02);
      r.px(mid[0], mid[1], ra.skin[1]);
      r.px(mid[0], mid[1] + 3, ra.skin[1]);
      r.px(mid[0], mid[1] + 6, ra.skin[1]);
      break;
    }
    case 'sultan': {
      // royal open robe over bare chest, heavy gold trim
      r.polyShaded(
        [
          at(sk.neck, 2, chestW * 0.5),
          at(sk.pelvis, 2, chestW * 0.34),
          at(sk.pelvis, 2, chestW * 0.16),
          at(sk.neck, 0, chestW * 0.28),
        ],
        C,
        -0.5,
        -0.85,
      );
      r.polyShaded(
        [
          at(sk.neck, 2, -chestW * 0.5),
          at(sk.pelvis, 2, -chestW * 0.34),
          at(sk.pelvis, 2, -chestW * 0.16),
          at(sk.neck, 0, -chestW * 0.28),
        ],
        CA,
        -0.5,
        -0.85,
      );
      // gold chest chain
      const c0 = at(sk.chest, torsoLen * 0.1, -chestW * 0.22);
      const c1 = at(sk.chest, -torsoLen * 0.06, 0);
      const c2 = at(sk.chest, torsoLen * 0.1, chestW * 0.22);
      r.line(c0[0], c0[1], c1[0], c1[1], A[3]);
      r.line(c1[0], c1[1], c2[0], c2[1], A[3]);
      r.blob(c1[0], c1[1] + 1, 2.4, 2.4, A2);
      break;
    }
    case 'katipunan': {
      // rolled-sleeve camisa, red sash across the chest
      r.polyShaded(
        [
          at(sk.neck, 0, chestW * 0.44),
          at(sk.pelvis, torsoLen * 0.36, -chestW * 0.16),
          at(sk.pelvis, torsoLen * 0.2, -chestW * 0.38),
          at(sk.neck, -3, chestW * 0.2),
        ],
        A,
        -0.5,
        -0.85,
      );
      // collar
      r.line(...at(sk.neck, 2, chestW * 0.34), ...at(sk.neck, -4, chestW * 0.1), A2[1]);
      r.line(...at(sk.neck, 2, -chestW * 0.34), ...at(sk.neck, -4, -chestW * 0.1), A2[1]);
      // buttons
      for (let i = 0; i < 3; i++) {
        const b = at(sk.chest, -torsoLen * (0.06 + i * 0.14), chestW * 0.06);
        r.px(b[0], b[1], CA[1]);
      }
      break;
    }
    case 'general': {
      // military tunic: standing collar, double-breasted, epaulettes
      r.polyShaded(
        [at(sk.neck, 3, chestW * 0.42), at(sk.neck, -2, chestW * 0.46), at(sk.neck, -2, -chestW * 0.46), at(sk.neck, 3, -chestW * 0.42)],
        CA,
        -0.5,
        -0.85,
      );
      for (let i = 0; i < 4; i++) {
        const u = -torsoLen * (0.02 + i * 0.15);
        const b1 = at(sk.chest, u, chestW * 0.2);
        const b2 = at(sk.chest, u, -chestW * 0.06);
        r.px(b1[0], b1[1], A[4]);
        r.px(b2[0], b2[1], A[4]);
      }
      // sash
      r.polyShaded(
        [
          at(sk.chest, torsoLen * 0.16, chestW * 0.44),
          at(sk.pelvis, torsoLen * 0.1, -chestW * 0.24),
          at(sk.pelvis, 0, -chestW * 0.4),
          at(sk.chest, torsoLen * 0.06, chestW * 0.3),
        ],
        A,
        -0.5,
        -0.85,
      );
      break;
    }
    case 'scholar': {
      // frock coat with lapels and waistcoat
      r.polyShaded(
        [at(sk.neck, 2, chestW * 0.4), at(sk.chest, -torsoLen * 0.1, chestW * 0.2), at(sk.chest, -torsoLen * 0.1, -chestW * 0.02), at(sk.neck, 2, -chestW * 0.2)],
        A2,
        -0.5,
        -0.85,
      );
      // lapels
      r.polyShaded(
        [at(sk.neck, 3, chestW * 0.46), at(sk.chest, -torsoLen * 0.06, chestW * 0.24), at(sk.neck, -2, chestW * 0.1)],
        CA,
        -0.5,
        -0.85,
      );
      r.polyShaded(
        [at(sk.neck, 3, -chestW * 0.46), at(sk.chest, -torsoLen * 0.06, -chestW * 0.24), at(sk.neck, -2, -chestW * 0.1)],
        CA,
        -0.5,
        -0.85,
      );
      // necktie
      const t0 = at(sk.neck, 1, chestW * 0.1);
      r.rect(t0[0] - 1, t0[1], 2, Math.max(3, torsoLen * 0.22), A[2]);
      break;
    }
    case 'revolucionaria': {
      // bodice + wrapped sash, fitted waist
      r.polyShaded(
        [at(sk.neck, 1, chestW * 0.42), at(sk.chest, -torsoLen * 0.24, chestW * 0.4), at(sk.chest, -torsoLen * 0.24, -chestW * 0.4), at(sk.neck, 1, -chestW * 0.42)],
        CA,
        -0.5,
        -0.85,
      );
      // chest highlight lines
      const s0 = at(sk.chest, torsoLen * 0.04, chestW * 0.3);
      const s1 = at(sk.chest, -torsoLen * 0.2, chestW * 0.04);
      r.line(s0[0], s0[1], s1[0], s1[1], A2[3]);
      // waist sash
      r.polyShaded(
        [at(sk.pelvis, torsoLen * 0.34, plan.hipW * 0.52), at(sk.pelvis, torsoLen * 0.12, plan.hipW * 0.54), at(sk.pelvis, torsoLen * 0.12, -plan.hipW * 0.54), at(sk.pelvis, torsoLen * 0.34, -plan.hipW * 0.52)],
        A,
        -0.5,
        -0.85,
      );
      break;
    }
    case 'matriarch': {
      // baro with panuelo (shoulder scarf) - big triangular collar
      r.polyShaded(
        [at(sk.neck, 3, chestW * 0.5), at(sk.chest, -torsoLen * 0.16, chestW * 0.06), at(sk.neck, 3, -chestW * 0.5), at(sk.neck, 5, 0)],
        A2,
        -0.5,
        -0.85,
      );
      r.line(...at(sk.neck, 3, chestW * 0.5), ...at(sk.chest, -torsoLen * 0.16, chestW * 0.06), A[1]);
      r.line(...at(sk.neck, 3, -chestW * 0.5), ...at(sk.chest, -torsoLen * 0.16, chestW * 0.06), A[1]);
      break;
    }
    case 'capitan': {
      // camisa de chino + short jacket
      r.polyShaded(
        [at(sk.neck, 2, chestW * 0.46), at(sk.chest, -torsoLen * 0.3, chestW * 0.34), at(sk.chest, -torsoLen * 0.3, chestW * 0.12), at(sk.neck, 2, chestW * 0.16)],
        CA,
        -0.5,
        -0.85,
      );
      r.polyShaded(
        [at(sk.neck, 2, -chestW * 0.46), at(sk.chest, -torsoLen * 0.3, -chestW * 0.34), at(sk.chest, -torsoLen * 0.3, -chestW * 0.12), at(sk.neck, 2, -chestW * 0.16)],
        CA,
        -0.5,
        -0.85,
      );
      const b = at(sk.chest, torsoLen * 0.02, chestW * 0.02);
      r.px(b[0], b[1], A[3]);
      r.px(b[0], b[1] + 4, A[3]);
      break;
    }
    case 'artist': {
      // smock with paint smears
      r.polyShaded(
        [at(sk.neck, 1, chestW * 0.44), at(sk.pelvis, torsoLen * 0.3, chestW * 0.4), at(sk.pelvis, torsoLen * 0.3, -chestW * 0.4), at(sk.neck, 1, -chestW * 0.44)],
        ra.accent2,
        -0.5,
        -0.85,
      );
      const sm = at(sk.chest, -torsoLen * 0.1, chestW * 0.18);
      r.px(sm[0], sm[1], A[2]);
      r.px(sm[0] + 1, sm[1] + 1, A[3]);
      r.px(sm[0] - 2, sm[1] + 3, ra.aura);
      break;
    }
    case 'cadet': {
      r.polyShaded(
        [at(sk.neck, 2, chestW * 0.44), at(sk.chest, -torsoLen * 0.28, chestW * 0.4), at(sk.chest, -torsoLen * 0.28, -chestW * 0.4), at(sk.neck, 2, -chestW * 0.44)],
        CA,
        -0.5,
        -0.85,
      );
      for (let i = 0; i < 3; i++) {
        const b = at(sk.chest, -torsoLen * (0.04 + i * 0.14), chestW * 0.04);
        r.px(b[0], b[1], A[4]);
      }
      break;
    }
    case 'shadow': {
      // layered dark plate with glowing seams
      r.polyShaded(
        [at(sk.neck, 2, chestW * 0.48), at(sk.chest, -torsoLen * 0.2, chestW * 0.42), at(sk.chest, -torsoLen * 0.2, -chestW * 0.42), at(sk.neck, 2, -chestW * 0.48)],
        ra.clothAlt,
        -0.5,
        -0.85,
      );
      for (let i = 0; i < 3; i++) {
        const s0 = at(sk.chest, torsoLen * (0.08 - i * 0.12), chestW * 0.4);
        const s1 = at(sk.chest, torsoLen * (-0.02 - i * 0.12), -chestW * 0.34);
        r.line(s0[0], s0[1], s1[0], s1[1], i === 1 ? ra.aura : ra.accent[1]);
      }
      const core = at(sk.chest, -torsoLen * 0.04, chestW * 0.04);
      r.blob(core[0], core[1], 3, 3.4, [ra.accent[1], ra.aura, ra.auraLite]);
      break;
    }
    default:
      break;
  }

  // belt (all outfits)
  if (plan.beltWidth > 0) {
    const bw = plan.beltWidth;
    r.polyShaded(
      [
        at(sk.pelvis, torsoLen * 0.3 + bw / 2, plan.hipW * 0.54),
        at(sk.pelvis, torsoLen * 0.3 - bw / 2, plan.hipW * 0.56),
        at(sk.pelvis, torsoLen * 0.3 - bw / 2, -plan.hipW * 0.56),
        at(sk.pelvis, torsoLen * 0.3 + bw / 2, -plan.hipW * 0.54),
      ],
      ra.leather,
      -0.4,
      -0.9,
    );
    const buck = at(sk.pelvis, torsoLen * 0.3, plan.hipW * 0.2);
    r.blob(buck[0], buck[1], bw * 0.42, bw * 0.42, A);
  }
}
