// ============================================================================
// Cloth: skirts, sashes, capes, tapis. Drawn as swaying quads so clothing
// visibly moves during attacks (a requirement of the look).
// ============================================================================

import { Raster, shade, type RGBA } from '../Raster';
import type { BodyPlan } from '../BodyPlans';
import type { Pose } from '../PoseLib';
import type { Ramps } from './ramps';
import type { Skeleton, Pt } from './geometry';

export function drawSkirt(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
  behind: boolean,
): void {
  if (plan.skirt <= 0) return;
  const { up, fwd, pelvis } = sk;
  const len = plan.skirt * (1 - p.crouch * 0.3);
  const sway = p.cloth * 5;
  const topW = plan.hipW * 0.6;
  const botW = plan.hipW * (plan.outfit === 'matriarch' ? 1.1 : 0.86);

  const at = (u: number, f: number): [number, number] => [
    pelvis.x + up.x * u + fwd.x * f,
    pelvis.y + up.y * u + fwd.y * f,
  ];

  const ramp =
    plan.outfit === 'datu' || plan.outfit === 'sultan'
      ? ra.cloth
      : plan.outfit === 'shadow'
        ? ra.clothAlt
        : ra.cloth;
  const use = behind ? ramp.map((c) => shade(c, -0.3)) : ramp;

  const panels = 3;
  for (let i = 0; i < panels; i++) {
    const f0 = -botW * 0.55 + (botW * 1.1 * i) / panels;
    const f1 = -botW * 0.55 + (botW * 1.1 * (i + 1)) / panels;
    const drape = Math.sin(((i + 0.5) / panels) * Math.PI) * 2.5;
    const p0 = at(plan.torsoLen * 0.28, f0 * (topW / botW));
    const p1 = at(plan.torsoLen * 0.28, f1 * (topW / botW));
    const p2 = at(plan.torsoLen * 0.28 - len - drape, f1 + sway);
    const p3 = at(plan.torsoLen * 0.28 - len - drape, f0 + sway);
    r.polyShaded([p0, p1, p2, p3], use, -0.5, -0.86, behind);
    // fold line
    if (i > 0) r.line(p0[0], p0[1], p3[0], p3[1], use[1]);
  }

  // hem trim
  const h0 = at(plan.torsoLen * 0.28 - len, -botW * 0.55 + sway);
  const h1 = at(plan.torsoLen * 0.28 - len, botW * 0.55 + sway);
  if (!behind) r.line(h0[0], h0[1], h1[0], h1[1], ra.accent[3]);
}

export function drawCape(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  if (plan.cape <= 0) return;
  const { up, fwd, neck } = sk;
  const len = plan.cape;
  const sway = p.cloth * 8;
  const at = (u: number, f: number): [number, number] => [
    neck.x + up.x * u + fwd.x * f,
    neck.y + up.y * u + fwd.y * f,
  ];
  const ramp = ra.clothAlt.map((c) => shade(c, -0.2));
  const panels = 4;
  for (let i = 0; i < panels; i++) {
    const t0 = i / panels;
    const t1 = (i + 1) / panels;
    const w = plan.shoulderW * 0.5;
    const flare = 1 + i * 0.35;
    const p0 = at(0, -w * 0.2 + (-w * 0.2 * t0));
    const p1 = at(0, -w * 0.2 + (-w * 0.2 * t1));
    const p2 = at(-len * (0.6 + t1 * 0.4), -w * flare - sway - t1 * 6);
    const p3 = at(-len * (0.6 + t0 * 0.4), -w * flare * 0.86 - sway - t0 * 6);
    r.polyShaded([p0, p1, p2, p3], ramp, -0.5, -0.86, true);
  }
  // torn hem for the shadow boss
  if (plan.outfit === 'shadow') {
    for (let i = 0; i < 6; i++) {
      const y = at(-len * (0.9 + (i % 2) * 0.18), -plan.shoulderW * (0.5 + i * 0.16) - sway);
      r.px(y[0], y[1], ra.aura);
    }
  }
}

/** Sash tails and loose cloth flapping from the belt. */
export function drawSashTails(
  r: Raster,
  plan: BodyPlan,
  p: Pose,
  sk: Skeleton,
  ra: Ramps,
): void {
  if (plan.outfit === 'matriarch' || plan.outfit === 'scholar') return;
  const { up, fwd, pelvis } = sk;
  const sway = p.cloth;
  const base = {
    x: pelvis.x + up.x * plan.torsoLen * 0.26 + fwd.x * -plan.hipW * 0.4,
    y: pelvis.y + up.y * plan.torsoLen * 0.26 + fwd.y * -plan.hipW * 0.4,
  };
  const ramp = ra.accent.map((c) => shade(c, -0.1));
  for (let i = 0; i < 2; i++) {
    const len = 14 + i * 5;
    const spread = -4 - i * 3 - sway * 7;
    r.limb(
      base.x,
      base.y,
      base.x + spread,
      base.y + len * (0.7 - sway * 0.2),
      3.4 - i,
      1.4,
      ramp,
      { flat: true, behind: true },
    );
  }
}
