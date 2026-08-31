// ============================================================================
// Skeleton solver: pose + body plan -> concrete joint pixel positions.
// Sprite space: x right (character always faces RIGHT here; the renderer
// flips at draw time), y DOWN. Feet rest on `floorY`.
// Angles: 0 = straight down, positive rotates toward forward (+x).
//   dir(a) = (sin a, cos a)
// ============================================================================

import type { BodyPlan } from '../BodyPlans';
import type { Pose } from '../PoseLib';

export interface Pt {
  x: number;
  y: number;
}

export interface Skeleton {
  pelvis: Pt;
  chest: Pt;
  neck: Pt;
  head: Pt;
  headR: number;
  headRy: number;
  shoulderF: Pt;
  shoulderB: Pt;
  elbowF: Pt;
  handF: Pt;
  elbowB: Pt;
  handB: Pt;
  hipF: Pt;
  hipB: Pt;
  kneeF: Pt;
  footF: Pt;
  kneeB: Pt;
  footB: Pt;
  /** unit vector pointing "up" along the torso */
  up: Pt;
  /** unit vector perpendicular to up, pointing forward */
  fwd: Pt;
  /** total body scale from squash */
  sx: number;
  sy: number;
  floorY: number;
  originX: number;
}

const R = Math.PI / 180;

function dir(aDeg: number, len: number): Pt {
  const a = aDeg * R;
  return { x: Math.sin(a) * len, y: Math.cos(a) * len };
}

function add(p: Pt, d: Pt): Pt {
  return { x: p.x + d.x, y: p.y + d.y };
}

export function solve(
  plan: BodyPlan,
  p: Pose,
  originX: number,
  floorY: number,
): Skeleton {
  const crouch = Math.max(0, Math.min(1, p.crouch));
  const legLen = plan.legLen * (1 - crouch * 0.44);
  const torsoLen = plan.torsoLen * (1 - crouch * 0.1);

  const pelvis: Pt = { x: originX + p.ox, y: floorY - legLen + p.oy };

  // torso axis: "up" tilted forward by lean
  const lean = p.lean * R;
  const up: Pt = { x: Math.sin(lean), y: -Math.cos(lean) };
  const fwd: Pt = { x: -up.y, y: up.x }; // rotate up by +90 -> forward

  const chest = add(pelvis, { x: up.x * torsoLen * 0.55, y: up.y * torsoLen * 0.55 });
  const neck = add(pelvis, { x: up.x * torsoLen, y: up.y * torsoLen });

  const headTilt = (p.lean * 0.35 + p.headTilt) * R;
  const hUp: Pt = { x: Math.sin(headTilt), y: -Math.cos(headTilt) };
  const headDist = plan.neckLen + plan.headRy * 0.95;
  const head = add(neck, { x: hUp.x * headDist, y: hUp.y * headDist });

  const shOff = plan.shoulderW * 0.2;
  const shDrop = plan.torsoLen * 0.06;
  const shoulderF = add(neck, {
    x: fwd.x * shOff + up.x * -shDrop,
    y: fwd.y * shOff + up.y * -shDrop,
  });
  const shoulderB = add(neck, {
    x: -fwd.x * shOff + up.x * -shDrop * 1.2,
    y: -fwd.y * shOff + up.y * -shDrop * 1.2,
  });

  const hipOff = plan.hipW * 0.24;
  const hipF = add(pelvis, { x: fwd.x * hipOff, y: fwd.y * hipOff });
  const hipB = add(pelvis, { x: -fwd.x * hipOff, y: -fwd.y * hipOff });

  const ua = plan.upperArm;
  const fa = plan.foreArm;
  const ul = plan.upperLeg * (1 - crouch * 0.06);
  const ll = plan.lowerLeg * (1 - crouch * 0.06);

  const elbowF = add(shoulderF, dir(p.armF[0], ua));
  const handF = add(elbowF, dir(p.armF[1], fa));
  const elbowB = add(shoulderB, dir(p.armB[0], ua));
  const handB = add(elbowB, dir(p.armB[1], fa));

  const kneeF = add(hipF, dir(p.legF[0], ul));
  const footF = add(kneeF, dir(p.legF[1], ll));
  const kneeB = add(hipB, dir(p.legB[0], ul));
  const footB = add(kneeB, dir(p.legB[1], ll));

  const sk: Skeleton = {
    pelvis,
    chest,
    neck,
    head,
    headR: plan.headR,
    headRy: plan.headRy,
    shoulderF,
    shoulderB,
    elbowF,
    handF,
    elbowB,
    handB,
    hipF,
    hipB,
    kneeF,
    footF,
    kneeB,
    footB,
    up,
    fwd,
    sx: 1,
    sy: 1,
    floorY,
    originX,
  };

  if (p.spin) applySpin(sk, pelvis, p.spin);
  if (p.squash !== 1) applySquash(sk, p.squash, floorY, originX);
  return sk;
}

const JOINTS: Array<keyof Skeleton> = [
  'pelvis',
  'chest',
  'neck',
  'head',
  'shoulderF',
  'shoulderB',
  'elbowF',
  'handF',
  'elbowB',
  'handB',
  'hipF',
  'hipB',
  'kneeF',
  'footF',
  'kneeB',
  'footB',
];

function applySpin(sk: Skeleton, pivot: Pt, deg: number): void {
  const a = deg * R;
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (const k of JOINTS) {
    const pt = sk[k] as Pt;
    const dx = pt.x - pivot.x;
    const dy = pt.y - pivot.y;
    pt.x = pivot.x + dx * c + dy * s;
    pt.y = pivot.y - dx * s + dy * c;
  }
  const rot = (v: Pt) => {
    const x = v.x * c + v.y * s;
    const y = -v.x * s + v.y * c;
    v.x = x;
    v.y = y;
  };
  rot(sk.up);
  rot(sk.fwd);
}

function applySquash(sk: Skeleton, q: number, floorY: number, originX: number): void {
  const sy = q;
  const sx = 1 / Math.sqrt(q);
  for (const k of JOINTS) {
    const pt = sk[k] as Pt;
    pt.x = originX + (pt.x - originX) * sx;
    pt.y = floorY - (floorY - pt.y) * sy;
  }
  sk.sx = sx;
  sk.sy = sy;
  sk.headR *= sx;
  sk.headRy *= sy;
}

/** Angle (in the sprite's convention) of the segment a->b. */
export function angleOf(a: Pt, b: Pt): number {
  return Math.atan2(b.x - a.x, b.y - a.y) / R;
}

export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
