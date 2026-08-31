// ============================================================================
// Pose + animation library.
// ----------------------------------------------------------------------------
// A pose is a skeleton state (angles, not pixels), so animations are cheap to
// author and every character reinterprets them through its own body plan.
//
// ANGLE CONVENTION (strict, used everywhere including weapon trails):
//   degrees, absolute, 0 = straight DOWN, positive rotates toward the
//   character's FORWARD direction. 90 = horizontal forward, 180 = straight up,
//   -90 = horizontal backward.
//   Sprite space has y growing DOWN, so:  dx = sin(a) * len,  dy = cos(a) * len
//
//   armF / armB = [upperArmAbs, foreArmAbs]
//   legF / legB = [thighAbs, shinAbs]
// ============================================================================

export interface Pose {
  /** pelvis offset from neutral stance, px (sprite space, +y = down) */
  ox: number;
  oy: number;
  /** torso lean in degrees, positive = leaning forward */
  lean: number;
  /** 0 = standing, 1 = full crouch (lowers pelvis, compresses torso) */
  crouch: number;
  headTilt: number;
  /** 0 = pure profile, 1 = three-quarter view of the face */
  headTurn: number;
  armF: [number, number];
  armB: [number, number];
  legF: [number, number];
  legB: [number, number];
  /** extra weapon rotation added to the weapon hand angle */
  weapon: number;
  /** cloth sway, -1 (blown backward) .. 1 (blown forward) */
  cloth: number;
  expr: Expr;
  /** squash/stretch, 1 = neutral */
  squash: number;
  /** whole-body rotation in degrees (knockdowns / spins), positive = forward */
  spin: number;
  /** motion arc drawn behind the weapon */
  trail?: TrailSpec;
  /** aura strength 0..1 */
  glow: number;
  /** hide the weapon (empty-hand moves) */
  noWeapon?: boolean;
  /** off-hand guard raised 0..1 */
  guard?: number;
}

export type Expr = 'calm' | 'focus' | 'shout' | 'hurt' | 'smirk' | 'pain' | 'ko';

export interface TrailSpec {
  /** arc start/end angles (same convention as limbs) */
  a0: number;
  a1: number;
  /** inner and outer radius from the weapon hand */
  r0: number;
  r1: number;
  width: number;
  alpha: number;
}

export const NEUTRAL: Pose = {
  ox: 0,
  oy: 0,
  lean: 5,
  crouch: 0,
  headTilt: 0,
  headTurn: 0.6,
  armF: [34, 84],
  armB: [22, 74],
  legF: [15, 4],
  legB: [-16, -8],
  weapon: 0,
  cloth: 0,
  expr: 'calm',
  squash: 1,
  spin: 0,
  glow: 0,
};

export function pose(p: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...p };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const L = (x: number, y: number) => x + (y - x) * t;
  return {
    ox: L(a.ox, b.ox),
    oy: L(a.oy, b.oy),
    lean: L(a.lean, b.lean),
    crouch: L(a.crouch, b.crouch),
    headTilt: L(a.headTilt, b.headTilt),
    headTurn: L(a.headTurn, b.headTurn),
    armF: [L(a.armF[0], b.armF[0]), L(a.armF[1], b.armF[1])],
    armB: [L(a.armB[0], b.armB[0]), L(a.armB[1], b.armB[1])],
    legF: [L(a.legF[0], b.legF[0]), L(a.legF[1], b.legF[1])],
    legB: [L(a.legB[0], b.legB[0]), L(a.legB[1], b.legB[1])],
    weapon: L(a.weapon, b.weapon),
    cloth: L(a.cloth, b.cloth),
    expr: t < 0.5 ? a.expr : b.expr,
    squash: L(a.squash, b.squash),
    spin: L(a.spin, b.spin),
    glow: L(a.glow, b.glow),
    noWeapon: t < 0.5 ? a.noWeapon : b.noWeapon,
    guard: L(a.guard ?? 0, b.guard ?? 0),
    trail: t < 0.5 ? a.trail : b.trail,
  };
}

export interface Key {
  p: Partial<Pose>;
  /** frames this key occupies (>= 1) */
  d: number;
  /** false = hold the pose (snappy), default true = ease into the next key */
  ease?: boolean;
}

export interface AnimDef {
  keys: Key[];
  loop: boolean;
}

function A(keys: Key[], loop = false): AnimDef {
  return { keys, loop };
}

/** Expand keyframes into one concrete pose per frame. */
export function bake(def: AnimDef): Pose[] {
  const out: Pose[] = [];
  const full = def.keys.map((k) => pose(k.p));
  for (let i = 0; i < def.keys.length; i++) {
    const k = def.keys[i];
    const cur = full[i];
    const nextIdx = i + 1 < full.length ? i + 1 : def.loop ? 0 : i;
    const nxt = full[nextIdx];
    const dur = Math.max(1, Math.round(k.d));
    for (let f = 0; f < dur; f++) {
      if (k.ease === false || dur === 1 || nextIdx === i) out.push(cur);
      else out.push(lerpPose(cur, nxt, f / dur));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared animation set. Fighters bias these via their body plan and can
// override individual entries.
// ---------------------------------------------------------------------------

export const BASE_ANIMS: Record<string, AnimDef> = {
  idle: A(
    [
      { p: { armF: [34, 84], armB: [22, 74], lean: 5, oy: 0, cloth: 0.12 }, d: 7 },
      { p: { armF: [30, 90], armB: [18, 80], lean: 7, oy: -2, cloth: 0.45, headTilt: -1 }, d: 7 },
      { p: { armF: [36, 82], armB: [24, 72], lean: 6, oy: -1, cloth: 0.08 }, d: 7 },
      { p: { armF: [32, 86], armB: [20, 76], lean: 4, oy: 1, cloth: -0.3 }, d: 7 },
    ],
    true,
  ),

  walkF: A(
    [
      { p: { legF: [34, 22], legB: [-30, -22], armF: [16, 70], armB: [40, 92], oy: -1, lean: 9, cloth: 0.6 }, d: 5 },
      { p: { legF: [14, 6], legB: [-8, -6], armF: [28, 82], armB: [26, 80], oy: 2, lean: 7, cloth: 0.2 }, d: 5 },
      { p: { legF: [-24, -18], legB: [34, 24], armF: [44, 94], armB: [12, 66], oy: -1, lean: 8, cloth: -0.45 }, d: 5 },
      { p: { legF: [-6, -4], legB: [14, 8], armF: [30, 84], armB: [24, 76], oy: 2, lean: 6, cloth: -0.1 }, d: 5 },
    ],
    true,
  ),

  walkB: A(
    [
      { p: { legF: [-20, -12], legB: [28, 20], armF: [30, 96], armB: [22, 88], oy: -1, lean: -2, cloth: -0.5 }, d: 5 },
      { p: { legF: [-4, -2], legB: [10, 6], armF: [34, 88], armB: [24, 80], oy: 2, lean: 0, cloth: -0.15 }, d: 5 },
      { p: { legF: [26, 18], legB: [-18, -12], armF: [38, 82], armB: [28, 74], oy: -1, lean: -1, cloth: 0.4 }, d: 5 },
      { p: { legF: [8, 4], legB: [-6, -2], armF: [34, 86], armB: [24, 78], oy: 2, lean: 1, cloth: 0.1 }, d: 5 },
    ],
    true,
  ),

  dash: A(
    [
      { p: { lean: 22, oy: 3, legF: [44, 30], legB: [-34, -26], armF: [8, 62], armB: [52, 100], cloth: 1, squash: 1.03, expr: 'focus' }, d: 3 },
      { p: { lean: 26, oy: 1, legF: [-26, -16], legB: [48, 34], armF: [26, 76], armB: [30, 84], cloth: 0.8, expr: 'focus' }, d: 3 },
      { p: { lean: 20, oy: 2, legF: [36, 24], legB: [-26, -18], armF: [12, 66], armB: [46, 96], cloth: 0.9, expr: 'focus' }, d: 3 },
    ],
    true,
  ),

  backdash: A([
    { p: { lean: -14, oy: -8, legF: [-34, -20], legB: [-12, 18], armF: [44, 120], armB: [36, 112], cloth: -1, squash: 1.05 }, d: 4 },
    { p: { lean: -8, oy: -4, legF: [-18, -10], legB: [-4, 12], armF: [40, 106], armB: [30, 98], cloth: -0.7 }, d: 4 },
    { p: { lean: -2, oy: 1, legF: [-6, -2], legB: [6, 4], armF: [36, 90], armB: [24, 80], cloth: -0.2 }, d: 4 },
  ]),

  jumpsquat: A([
    { p: { crouch: 0.45, oy: 8, lean: 10, armF: [-14, 40], armB: [-20, 34], squash: 0.9, legF: [46, -14], legB: [-44, 16] }, d: 4, ease: false },
  ]),

  air: A(
    [
      { p: { oy: -2, lean: 8, legF: [52, 16], legB: [-34, 22], armF: [58, 128], armB: [-24, 40], cloth: 0.9, squash: 1.06 }, d: 6 },
      { p: { oy: 0, lean: 6, legF: [44, 8], legB: [-28, 16], armF: [50, 118], armB: [-16, 48], cloth: 0.5, squash: 1.0 }, d: 6 },
      { p: { oy: 2, lean: 4, legF: [48, 12], legB: [-32, 20], armF: [54, 124], armB: [-20, 44], cloth: 0.7, squash: 0.98 }, d: 6 },
    ],
    true,
  ),

  land: A([
    { p: { crouch: 0.52, oy: 9, lean: 12, armF: [-4, 46], armB: [-12, 40], squash: 0.86, legF: [50, -16], legB: [-48, 18] }, d: 2, ease: false },
    { p: { crouch: 0.24, oy: 4, lean: 8, armF: [16, 66], armB: [8, 60], squash: 0.96, legF: [30, -4], legB: [-28, 6] }, d: 3 },
  ]),

  crouch: A(
    [
      { p: { crouch: 1, oy: 20, lean: 14, armF: [40, 96], armB: [30, 88], legF: [58, -24], legB: [-56, 26], headTilt: 2 }, d: 8 },
      { p: { crouch: 1, oy: 21, lean: 15, armF: [38, 98], armB: [28, 90], legF: [58, -24], legB: [-56, 26], headTilt: 1 }, d: 8 },
    ],
    true,
  ),

  block: A(
    [
      { p: { lean: -6, armF: [52, 146], armB: [34, 138], guard: 1, legF: [10, 2], legB: [-14, -6], expr: 'focus', cloth: -0.2 }, d: 6 },
      { p: { lean: -5, armF: [54, 144], armB: [36, 136], guard: 1, legF: [10, 2], legB: [-14, -6], expr: 'focus', cloth: 0 }, d: 6 },
    ],
    true,
  ),

  blockCrouch: A(
    [
      { p: { crouch: 1, oy: 20, lean: 6, armF: [56, 142], armB: [40, 134], guard: 1, legF: [58, -24], legB: [-56, 26], expr: 'focus' }, d: 6 },
      { p: { crouch: 1, oy: 21, lean: 7, armF: [58, 140], armB: [42, 132], guard: 1, legF: [58, -24], legB: [-56, 26], expr: 'focus' }, d: 6 },
    ],
    true,
  ),

  // --- normals -------------------------------------------------------------
  jab: A([
    { p: { lean: 8, armF: [16, 62], armB: [30, 92], legF: [14, 4], legB: [-16, -8], expr: 'focus' }, d: 2 },
    { p: { lean: 14, armF: [82, 94], armB: [22, 76], legF: [22, 10], legB: [-22, -12], ox: 2, expr: 'shout', trail: { a0: 40, a1: 92, r0: 12, r1: 26, width: 3, alpha: 0.45 } }, d: 3, ease: false },
    { p: { lean: 10, armF: [50, 90], armB: [26, 82], legF: [16, 6], legB: [-18, -10] }, d: 4 },
  ]),

  jab2: A([
    { p: { lean: 6, armF: [36, 88], armB: [14, 58], legF: [12, 2], legB: [-14, -6], expr: 'focus' }, d: 2 },
    { p: { lean: 16, armF: [40, 92], armB: [84, 96], legF: [24, 12], legB: [-24, -14], ox: 3, expr: 'shout', trail: { a0: 40, a1: 94, r0: 12, r1: 26, width: 3, alpha: 0.45 } }, d: 3, ease: false },
    { p: { lean: 9, armF: [34, 86], armB: [30, 84], legF: [16, 6], legB: [-18, -10] }, d: 5 },
  ]),

  strong: A([
    { p: { lean: -10, armF: [-44, -14], armB: [10, 60], legF: [4, -2], legB: [-24, -14], expr: 'focus', cloth: -0.7 }, d: 4 },
    { p: { lean: 24, armF: [102, 118], armB: [24, 78], legF: [32, 18], legB: [-28, -16], ox: 5, expr: 'shout', squash: 1.02, trail: { a0: -30, a1: 108, r0: 14, r1: 38, width: 5, alpha: 0.7 } }, d: 4, ease: false },
    { p: { lean: 16, armF: [74, 100], armB: [26, 80], legF: [24, 12], legB: [-22, -12], ox: 3 }, d: 7 },
  ]),

  slash: A([
    { p: { lean: -12, armF: [-58, -30], armB: [16, 64], weapon: -30, legF: [2, -4], legB: [-26, -16], expr: 'focus', cloth: -0.8 }, d: 4 },
    { p: { lean: 20, armF: [96, 112], armB: [22, 74], weapon: 20, legF: [30, 16], legB: [-26, -14], ox: 4, expr: 'shout', trail: { a0: -46, a1: 104, r0: 18, r1: 50, width: 6, alpha: 0.85 } }, d: 3, ease: false },
    { p: { lean: 12, armF: [70, 96], armB: [24, 78], weapon: 8, legF: [22, 10], legB: [-20, -10], ox: 2 }, d: 8 },
  ]),

  lowSweep: A([
    { p: { crouch: 1, oy: 20, lean: 14, armF: [30, 84], armB: [26, 88], legF: [50, -18], legB: [-54, 24], expr: 'focus' }, d: 3 },
    { p: { crouch: 1, oy: 26, lean: 22, armF: [-20, 30], armB: [40, 96], legF: [104, 96], legB: [-58, 28], ox: 4, expr: 'shout', trail: { a0: 60, a1: 108, r0: 18, r1: 44, width: 5, alpha: 0.55 } }, d: 3, ease: false },
    { p: { crouch: 1, oy: 23, lean: 16, armF: [20, 70], armB: [30, 90], legF: [70, 20], legB: [-56, 26] }, d: 7 },
  ]),

  lowJab: A([
    { p: { crouch: 1, oy: 20, lean: 12, armF: [44, 90], armB: [28, 86], legF: [58, -24], legB: [-56, 26], expr: 'focus' }, d: 2 },
    { p: { crouch: 1, oy: 20, lean: 16, armF: [78, 100], armB: [30, 88], legF: [58, -24], legB: [-56, 26], expr: 'shout', trail: { a0: 50, a1: 96, r0: 10, r1: 24, width: 3, alpha: 0.4 } }, d: 3, ease: false },
    { p: { crouch: 1, oy: 20, lean: 13, armF: [54, 92], armB: [28, 86], legF: [58, -24], legB: [-56, 26] }, d: 4 },
  ]),

  launcher: A([
    { p: { crouch: 0.42, oy: 12, lean: -14, armF: [-52, -20], armB: [14, 62], weapon: -50, legF: [26, -12], legB: [-30, 8], expr: 'focus', cloth: -0.9 }, d: 5 },
    { p: { oy: -10, lean: -24, armF: [146, 174], armB: [26, 80], weapon: 24, legF: [-8, -12], legB: [-14, 4], expr: 'shout', squash: 1.1, trail: { a0: 30, a1: 172, r0: 20, r1: 54, width: 7, alpha: 0.95 } }, d: 4, ease: false },
    { p: { oy: -2, lean: -10, armF: [124, 156], armB: [24, 78], weapon: 8, legF: [4, -4], legB: [-20, -8] }, d: 10 },
  ]),

  airAttack: A([
    { p: { oy: -2, lean: 14, armF: [-40, -6], armB: [-18, 44], weapon: -26, legF: [46, 12], legB: [-30, 18], expr: 'focus' }, d: 3 },
    { p: { oy: 0, lean: 26, armF: [92, 112], armB: [-8, 52], weapon: 30, legF: [52, 18], legB: [-24, 14], expr: 'shout', trail: { a0: -34, a1: 100, r0: 16, r1: 46, width: 5, alpha: 0.8 } }, d: 4, ease: false },
    { p: { oy: 2, lean: 18, armF: [70, 98], armB: [-12, 48], weapon: 12, legF: [48, 14], legB: [-28, 16] }, d: 6 },
  ]),

  // --- specials ------------------------------------------------------------
  rush: A([
    { p: { lean: 18, oy: 2, armF: [-24, 24], armB: [30, 88], legF: [36, 22], legB: [-30, -18], expr: 'focus', cloth: 0.8 }, d: 3 },
    { p: { lean: 26, oy: 1, armF: [94, 108], armB: [20, 70], legF: [40, 24], legB: [-32, -20], ox: 5, expr: 'shout', trail: { a0: 10, a1: 100, r0: 16, r1: 44, width: 5, alpha: 0.8 } }, d: 3, ease: false },
    { p: { lean: 24, oy: 2, armF: [24, 74], armB: [90, 104], legF: [-26, -16], legB: [42, 26], ox: 5, expr: 'shout', trail: { a0: 8, a1: 96, r0: 14, r1: 42, width: 5, alpha: 0.8 } }, d: 3, ease: false },
    { p: { lean: 22, oy: 1, armF: [90, 106], armB: [22, 74], legF: [34, 20], legB: [-28, -16], ox: 4, expr: 'shout', trail: { a0: 6, a1: 98, r0: 16, r1: 46, width: 6, alpha: 0.85 } }, d: 3, ease: false },
    { p: { lean: 14, oy: 2, armF: [56, 92], armB: [24, 78], legF: [22, 10], legB: [-20, -10] }, d: 8 },
  ]),

  spin: A([
    { p: { lean: 0, spin: 0, armF: [-40, -70], armB: [40, 70], weapon: -40, cloth: 1, expr: 'focus' }, d: 3 },
    { p: { lean: 0, spin: 110, armF: [70, 96], armB: [-60, -20], weapon: 40, cloth: -1, expr: 'shout', trail: { a0: -60, a1: 120, r0: 20, r1: 54, width: 6, alpha: 0.9 } }, d: 3, ease: false },
    { p: { lean: 0, spin: 250, armF: [-30, 10], armB: [60, 90], weapon: -20, cloth: 1, expr: 'shout', trail: { a0: 60, a1: 240, r0: 20, r1: 54, width: 6, alpha: 0.9 } }, d: 3, ease: false },
    { p: { lean: 0, spin: 360, armF: [40, 80], armB: [-30, 20], weapon: 10, cloth: 0, expr: 'shout', trail: { a0: 200, a1: 350, r0: 18, r1: 50, width: 5, alpha: 0.8 } }, d: 3, ease: false },
    { p: { lean: 6, spin: 360, armF: [34, 84], armB: [22, 74], weapon: 0, cloth: 0 }, d: 8 },
  ]),

  cast: A([
    { p: { lean: -10, armF: [-40, -6], armB: [12, 62], expr: 'focus', cloth: -0.6, glow: 0.3 }, d: 5 },
    { p: { lean: 4, armF: [10, 56], armB: [20, 72], expr: 'shout', glow: 1 }, d: 3, ease: false },
    { p: { lean: 12, armF: [86, 100], armB: [22, 76], ox: 2, expr: 'shout', glow: 0.85, trail: { a0: -10, a1: 92, r0: 14, r1: 34, width: 4, alpha: 0.55 } }, d: 4, ease: false },
    { p: { lean: 6, armF: [50, 88], armB: [24, 78], glow: 0.2 }, d: 8 },
  ]),

  stance: A(
    [
      { p: { lean: -10, armF: [58, 150], armB: [30, 96], legF: [8, 0], legB: [-20, -10], expr: 'focus', weapon: -30, cloth: -0.3, glow: 0.35 }, d: 6 },
      { p: { lean: -8, armF: [60, 148], armB: [32, 94], legF: [8, 0], legB: [-20, -10], expr: 'focus', weapon: -24, cloth: 0.1, glow: 0.5 }, d: 6 },
    ],
    true,
  ),

  buff: A([
    { p: { lean: -8, armF: [-30, 10], armB: [-26, 14], expr: 'focus', glow: 0.3, oy: 2 }, d: 5 },
    { p: { lean: -18, armF: [162, 176], armB: [-158, -172], expr: 'shout', glow: 1, oy: -6, squash: 1.06, cloth: 1 }, d: 8 },
    { p: { lean: -6, armF: [60, 120], armB: [30, 100], expr: 'shout', glow: 0.6, oy: 0 }, d: 7 },
  ]),

  // --- grabs ---------------------------------------------------------------
  grab: A([
    { p: { lean: 14, armF: [10, 56], armB: [4, 50], legF: [18, 8], legB: [-18, -10], expr: 'focus' }, d: 3 },
    { p: { lean: 20, armF: [84, 96], armB: [78, 92], legF: [26, 14], legB: [-24, -14], ox: 4, expr: 'shout' }, d: 3, ease: false },
    { p: { lean: 10, armF: [46, 84], armB: [42, 80], legF: [16, 6], legB: [-18, -10] }, d: 6 },
  ]),

  throwAnim: A([
    { p: { lean: 18, armF: [86, 98], armB: [80, 94], ox: 3, expr: 'shout' }, d: 4 },
    { p: { lean: -16, armF: [-70, -40], armB: [-64, -34], ox: -2, expr: 'shout', squash: 1.05, cloth: -1 }, d: 5 },
    { p: { lean: 22, armF: [116, 132], armB: [110, 126], ox: 4, expr: 'shout', squash: 0.96, cloth: 1, trail: { a0: -50, a1: 120, r0: 16, r1: 42, width: 5, alpha: 0.6 } }, d: 5 },
    { p: { lean: 8, armF: [44, 86], armB: [40, 82] }, d: 8 },
  ]),

  grabbed: A(
    [
      { p: { lean: -16, armF: [-30, 20], armB: [-36, 14], legF: [-8, -6], legB: [10, 8], expr: 'pain', oy: -2 }, d: 6 },
      { p: { lean: -12, armF: [-24, 26], armB: [-30, 20], legF: [-4, -8], legB: [6, 10], expr: 'pain', oy: 0 }, d: 6 },
    ],
    true,
  ),

  // --- reactions -----------------------------------------------------------
  hitHigh: A([
    { p: { lean: -24, oy: -3, headTilt: -12, armF: [-42, -8], armB: [-50, -16], legF: [-14, -8], legB: [12, 6], expr: 'pain', squash: 1.04, cloth: -1 }, d: 3, ease: false },
    { p: { lean: -15, oy: -1, headTilt: -7, armF: [-24, 26], armB: [-32, 18], legF: [-6, -4], legB: [4, 2], expr: 'pain' }, d: 4 },
    { p: { lean: -4, oy: 0, headTilt: -2, armF: [10, 60], armB: [2, 52], legF: [2, 0], legB: [-8, -6], expr: 'hurt' }, d: 5 },
  ]),

  hitLow: A([
    { p: { crouch: 0.6, oy: 12, lean: 20, headTilt: 9, armF: [-10, 44], armB: [-16, 38], legF: [40, -8], legB: [-30, 14], expr: 'pain', squash: 0.94 }, d: 3, ease: false },
    { p: { crouch: 0.4, oy: 8, lean: 13, headTilt: 5, armF: [6, 58], armB: [0, 52], legF: [28, 2], legB: [-24, 6], expr: 'pain' }, d: 4 },
    { p: { crouch: 0.15, oy: 3, lean: 6, headTilt: 2, armF: [22, 74], armB: [14, 66], legF: [14, 4], legB: [-16, -6], expr: 'hurt' }, d: 5 },
  ]),

  counterHit: A([
    { p: { lean: -36, oy: -6, headTilt: -22, armF: [-74, -44], armB: [-82, -52], legF: [-26, -18], legB: [22, 12], expr: 'pain', squash: 1.09, cloth: -1, spin: -6 }, d: 4, ease: false },
    { p: { lean: -22, oy: -3, headTilt: -13, armF: [-44, -10], armB: [-52, -18], legF: [-14, -8], legB: [12, 6], expr: 'pain', spin: -3 }, d: 5 },
    { p: { lean: -8, oy: 0, headTilt: -4, armF: [-4, 48], armB: [-12, 40], legF: [-2, -2], legB: [2, 0], expr: 'hurt' }, d: 6 },
  ]),

  juggle: A(
    [
      { p: { lean: -40, oy: -4, headTilt: -20, armF: [-84, -54], armB: [-92, -62], legF: [-30, -22], legB: [28, 16], expr: 'pain', spin: -14, squash: 1.08 }, d: 5 },
      { p: { lean: -50, oy: -2, headTilt: -26, armF: [-100, -70], armB: [-108, -78], legF: [-40, -30], legB: [34, 22], expr: 'pain', spin: -22, squash: 1.04 }, d: 5 },
      { p: { lean: -44, oy: -3, headTilt: -22, armF: [-92, -62], armB: [-100, -70], legF: [-34, -26], legB: [30, 18], expr: 'pain', spin: -18, squash: 1.06 }, d: 5 },
    ],
    true,
  ),

  knockdown: A([
    { p: { lean: -60, oy: 10, headTilt: -28, armF: [-100, -70], armB: [-108, -78], legF: [-46, -30], legB: [40, 24], expr: 'pain', spin: -44, squash: 1.05 }, d: 4 },
    { p: { lean: -70, oy: 22, headTilt: -32, armF: [-116, -86], armB: [-122, -92], legF: [-60, -40], legB: [54, 32], expr: 'pain', spin: -70, squash: 0.94 }, d: 5 },
    { p: { lean: -74, oy: 30, headTilt: -34, armF: [-122, -92], armB: [-128, -98], legF: [-70, -48], legB: [64, 40], expr: 'ko', spin: -86, squash: 0.9 }, d: 20 },
  ]),

  wakeup: A([
    { p: { lean: -60, oy: 26, headTilt: -24, armF: [-96, -60], armB: [-102, -66], legF: [-44, -24], legB: [40, 20], expr: 'hurt', spin: -60, squash: 0.94 }, d: 4 },
    { p: { crouch: 0.8, oy: 16, lean: -18, armF: [-20, 34], armB: [-26, 28], legF: [52, -20], legB: [-48, 22], expr: 'focus', spin: -14 }, d: 4 },
    { p: { crouch: 0.2, oy: 4, lean: 2, armF: [24, 74], armB: [16, 66], legF: [16, 4], legB: [-16, -8], expr: 'focus' }, d: 4 },
  ]),

  ko: A([
    { p: { lean: -66, oy: 16, headTilt: -30, armF: [-108, -78], armB: [-114, -84], legF: [-52, -34], legB: [46, 28], expr: 'ko', spin: -56, squash: 1.02 }, d: 6 },
    { p: { lean: -78, oy: 32, headTilt: -36, armF: [-126, -96], armB: [-132, -102], legF: [-74, -50], legB: [66, 42], expr: 'ko', spin: -90, squash: 0.88 }, d: 30 },
  ]),

  // --- supers / poses ------------------------------------------------------
  superStart: A([
    { p: { lean: -16, oy: 4, armF: [-20, 30], armB: [-26, 24], legF: [10, -4], legB: [-24, -10], expr: 'focus', glow: 0.5, cloth: -0.6 }, d: 4 },
    { p: { lean: -26, oy: -8, armF: [166, 178], armB: [-162, -174], legF: [-4, -6], legB: [-10, -4], expr: 'shout', glow: 1, squash: 1.1, cloth: 1 }, d: 6 },
  ]),

  superHit: A([
    { p: { lean: 22, oy: 0, armF: [-36, -6], armB: [-40, -10], weapon: -50, expr: 'shout', glow: 1, cloth: 0.8 }, d: 3 },
    { p: { lean: 30, oy: 1, armF: [100, 116], armB: [22, 74], weapon: 30, ox: 6, expr: 'shout', glow: 1, trail: { a0: -40, a1: 106, r0: 18, r1: 58, width: 8, alpha: 1 } }, d: 3, ease: false },
    { p: { lean: 26, oy: 0, armF: [30, 80], armB: [96, 110], weapon: 10, ox: 6, expr: 'shout', glow: 0.9, trail: { a0: -30, a1: 100, r0: 18, r1: 56, width: 7, alpha: 0.95 } }, d: 3, ease: false },
    { p: { lean: -20, oy: -6, armF: [-104, -74], armB: [-40, -8], weapon: -70, expr: 'shout', glow: 1, squash: 1.08, cloth: -1 }, d: 4 },
    { p: { lean: 34, oy: 4, armF: [124, 140], armB: [20, 72], weapon: 46, ox: 8, expr: 'shout', glow: 1, squash: 0.96, trail: { a0: -90, a1: 130, r0: 22, r1: 66, width: 9, alpha: 1 } }, d: 6, ease: false },
    { p: { lean: 18, oy: 2, armF: [74, 100], armB: [22, 76], weapon: 20, ox: 4, glow: 0.5 }, d: 10 },
  ]),

  victory: A(
    [
      { p: { lean: 2, armF: [32, 82], armB: [20, 72], expr: 'calm', oy: 0 }, d: 8 },
      { p: { lean: -8, armF: [158, 172], armB: [26, 78], expr: 'smirk', oy: -4, glow: 0.4, cloth: 0.8, weapon: -20 }, d: 10 },
      { p: { lean: -6, armF: [162, 176], armB: [28, 80], expr: 'smirk', oy: -2, glow: 0.5, cloth: -0.4, weapon: -14 }, d: 10 },
      { p: { lean: -8, armF: [156, 170], armB: [24, 76], expr: 'smirk', oy: -5, glow: 0.4, cloth: 0.6, weapon: -22 }, d: 10 },
    ],
    true,
  ),

  intro: A([
    { p: { lean: 10, armF: [38, 88], armB: [26, 80], expr: 'focus', oy: 2, crouch: 0.2 }, d: 8 },
    { p: { lean: -10, armF: [-40, -4], armB: [24, 78], expr: 'shout', oy: -4, glow: 0.6, cloth: 1, weapon: -40 }, d: 10 },
    { p: { lean: 4, armF: [34, 84], armB: [22, 74], expr: 'focus', oy: 0 }, d: 10 },
  ]),
};

export type AnimName = string;
