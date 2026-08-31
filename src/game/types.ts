// ============================================================================
// BAYANI BRAWL - Core shared types
// ----------------------------------------------------------------------------
// Coordinate conventions (IMPORTANT):
//   World space: x grows to the right, y grows UP, floor is y = 0.
//   A fighter's origin is the point between its feet.
//   Local boxes use x = FORWARD offset (positive = in front of the facing dir)
//   and y = height above the feet (bottom edge of the box).
// ============================================================================

export type Facing = 1 | -1;

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis aligned box. `y` is the BOTTOM edge in world-up coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AttackHeight = 'high' | 'mid' | 'low' | 'overhead' | 'unblockable';

export type HitFx =
  | 'punch'
  | 'kick'
  | 'blunt'
  | 'slash'
  | 'heavy'
  | 'energy'
  | 'shadow';

export type MoveKind = 'normal' | 'command' | 'special' | 'super' | 'throw';

/** A single active-frame window of an attack. Multi-hit moves have several. */
export interface HitDef {
  /** first frame (inclusive) of this hit window, measured from attack start */
  start: number;
  /** last frame (inclusive) */
  end: number;
  box: Box;
  damage: number;
  /** frames the victim stays in hitstun on a grounded hit */
  hitstun: number;
  blockstun: number;
  hitstop: number;
  height: AttackHeight;
  /** knockback impulse applied to the victim (world units / frame) */
  kbx: number;
  kby: number;
  /** self pushback when the hit connects */
  pushback: number;
  /** launches a grounded opponent into a juggle state */
  launcher?: boolean;
  /** can connect against airborne opponents */
  antiAir?: boolean;
  /** forces a hard knockdown */
  knockdown?: boolean;
  /** meter awarded to the attacker (and 60% of it to the victim) */
  meter: number;
  fx: HitFx;
  sfx: string;
  /** hits per activation window (visual only for rapid moves) */
  chip?: number;
}

export interface MovementKey {
  frame: number;
  vx: number;
  vy?: number;
}

export interface ProjectileDef {
  spawnFrame: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  gravity?: number;
  life: number;
  w: number;
  h: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  height: AttackHeight;
  kbx: number;
  kby: number;
  meter: number;
  style: 'ink' | 'light' | 'shadow' | 'wind' | 'paint' | 'spark';
  colorRamp?: string[];
  launcher?: boolean;
}

export interface CounterStanceDef {
  start: number;
  end: number;
  /** move id executed when the stance absorbs an attack */
  riposte: string;
  /** heals a fraction of the absorbed damage */
  absorb?: number;
}

export interface ThrowDef {
  /** frames the victim can mash grab to escape */
  escapeWindow: number;
  damage: number;
  /** total frames of the throw animation */
  duration: number;
  /** frame the damage lands */
  impactFrame: number;
  kbx: number;
  kby: number;
  meter: number;
  /** victim ends up behind the thrower */
  swap?: boolean;
  command?: boolean;
}

export interface BuffDef {
  duration: number;
  damageMul?: number;
  speedMul?: number;
  defenseMul?: number;
  meterMul?: number;
  armor?: boolean;
  label: string;
}

export interface AttackDef {
  id: string;
  name: string;
  kind: MoveKind;
  /** animation key in the fighter's animation table */
  anim: string;
  /** human readable input, shown in the move list */
  notation: string;
  startup: number;
  active: number;
  recovery: number;
  hits: HitDef[];
  /** move ids this attack may cancel into, and from which frame */
  cancels?: string[];
  cancelFrom?: number;
  /** cancels allowed even on whiff (usually false for normals) */
  whiffCancel?: boolean;
  meterCost?: number;
  requiresSpirit?: boolean;
  movement?: MovementKey[];
  /** [start, end] frames of full invulnerability */
  invuln?: [number, number];
  /** [start, end] frames of hit-absorbing armor (1 hit) */
  armor?: [number, number];
  counter?: CounterStanceDef;
  projectile?: ProjectileDef;
  throwDef?: ThrowDef;
  buff?: BuffDef;
  heal?: number;
  airOK?: boolean;
  airOnly?: boolean;
  crouchOnly?: boolean;
  /** super freeze frames before the move starts */
  freeze?: number;
  cinematic?: boolean;
  /** cannot be used again for N frames */
  cooldown?: number;
  /** hard knockdown ender - always ends a combo */
  ender?: boolean;
  /** scaling floor override */
  minScale?: number;
  /** description shown in the move list */
  desc?: string;
}

export type FighterStateName =
  | 'intro'
  | 'idle'
  | 'walkF'
  | 'walkB'
  | 'dash'
  | 'backdash'
  | 'crouch'
  | 'jumpsquat'
  | 'air'
  | 'land'
  | 'attack'
  | 'blockStand'
  | 'blockCrouch'
  | 'blockstun'
  | 'blockstunCrouch'
  | 'hitstun'
  | 'hitstunCrouch'
  | 'juggle'
  | 'knockdown'
  | 'wakeup'
  | 'grabAttempt'
  | 'grabbing'
  | 'grabbed'
  | 'thrown'
  | 'techBreak'
  | 'stance'
  | 'ko'
  | 'victory'
  | 'timeout';

export type StatKey = 'power' | 'speed' | 'defense' | 'technique';

export interface FighterStats {
  power: number;
  speed: number;
  defense: number;
  technique: number;
}

export interface FighterPhysics {
  walkF: number;
  walkB: number;
  dashSpeed: number;
  dashFrames: number;
  backdashSpeed: number;
  backdashFrames: number;
  jumpV: number;
  jumpH: number;
  gravity: number;
  weight: number;
  maxHp: number;
  /** damage taken multiplier */
  defense: number;
  /** damage dealt multiplier */
  attackMul: number;
}

export interface ComboRoute {
  label: string;
  inputs: string;
  note?: string;
}

export interface FighterBio {
  historical: string;
  lore: string;
  ending: string[];
}

export interface FighterDef {
  id: string;
  name: string;
  title: string;
  style: string;
  archetype: string;
  stats: FighterStats;
  physics: FighterPhysics;
  moves: Record<string, AttackDef>;
  /** ordered normal chain: light chain and heavy chain */
  chains: { light: string[]; heavy: string[] };
  routes: ComboRoute[];
  bio: FighterBio;
  ai: AiProfileName;
  /** super move id */
  super: string;
  /** ultimate (Bayani Spirit) super id, falls back to `super` */
  ultimate?: string;
  taunt: string;
  winQuote: string;
  /** art description consumed by the sprite baker */
  art: BodyPlanRef;
  unlocked: boolean;
  boss?: boolean;
}

export interface BodyPlanRef {
  plan: string;
  palette: string;
}

export type AiProfileName =
  | 'aggressive'
  | 'tactical'
  | 'counter'
  | 'pressure'
  | 'mobile'
  | 'juggernaut'
  | 'zoner'
  | 'balanced'
  | 'trickster'
  | 'boss';

export type Difficulty = 'CADET' | 'MANDIRIGMA' | 'BAYANI' | 'ALAMAT';

export interface HitResult {
  damage: number;
  counter: boolean;
  blocked: boolean;
  hits: number;
}

export interface StageLayerDef {
  kind:
    | 'sky'
    | 'sea'
    | 'mountains'
    | 'clouds'
    | 'wall'
    | 'buildings'
    | 'trees'
    | 'bamboo'
    | 'crowd'
    | 'tents'
    | 'ships'
    | 'ruins'
    | 'lanterns'
    | 'flags'
    | 'fire'
    | 'fog'
    | 'birds'
    | 'stars'
    | 'torii'
    | 'rubble'
    | 'shadowveil';
  /** parallax factor: 0 = fixed to camera, 1 = locked to world */
  par: number;
  y: number;
  colors: string[];
  density?: number;
  speed?: number;
  amp?: number;
}

export interface StageDef {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  floorY: number;
  ambient: string;
  /** additive tint drawn over the whole scene */
  tint?: string;
  tintAlpha?: number;
  layers: StageLayerDef[];
  ground: string[];
  music: string;
  lore: string;
  unlocked: boolean;
}
