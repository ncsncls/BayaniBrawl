// ============================================================================
// Global balance constants. Every tunable number that is not per-move lives
// here so combat feel can be tuned from one place.
// ============================================================================

export const FPS = 60;
export const FRAME_MS = 1000 / FPS;

/** logical render buffer, camera widens/narrows around this */
export const VIEW_BASE_W = 640;
export const VIEW_BASE_H = 360;
export const VIEW_MIN_W = 560;
export const VIEW_MAX_W = 880;

export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;

export const BALANCE = {
  /** input buffer length in frames (~133ms) */
  inputBuffer: 8,
  /** how long a directional stays in the motion history */
  motionWindow: 16,

  jumpsquat: 4,
  landRecovery: 4,
  dashStartup: 2,

  crouchTransition: 3,

  /** frames of blockstun floor */
  minBlockstun: 8,
  chipRatio: 0.14,
  /** chip damage can never kill */
  chipCannotKill: true,

  /** meter */
  meterMax: 300,
  meterBar: 100,
  meterOnHit: 1.0,
  meterOnTakeDamage: 1.35,
  meterOnBlock: 0.45,
  meterOnCounter: 1.5,
  meterWhiffPenalty: 0,

  /** Bayani Spirit (comeback) */
  spiritThreshold: 0.25,
  spiritMeterMul: 1.4,
  spiritDamageMul: 1.06,
  spiritDefenseMul: 0.94,

  /** combo damage scaling by hit index */
  comboScale: [
    1.0, 0.92, 0.84, 0.74, 0.65, 0.57, 0.5, 0.44, 0.38, 0.33, 0.28, 0.24, 0.2,
  ],
  comboScaleFloor: 0.16,

  /** juggle */
  juggleGravityStep: 0.055,
  juggleGravityMax: 1.9,
  juggleHitstunMul: 0.86,
  juggleHitstunFloor: 8,
  maxJuggleHits: 6,

  /** counter hits */
  counterDamageMul: 1.3,
  counterHitstunMul: 1.55,
  counterHitstopBonus: 3,

  /** throws */
  throwStartup: 5,
  throwActive: 3,
  throwWhiffRecovery: 20,
  throwEscapeWindow: 14,
  throwTechPushback: 3.2,

  /** knockdown */
  knockdownFrames: 34,
  quickRiseFrames: 22,
  wakeupFrames: 12,
  wakeupInvuln: 5,

  /** hitstop presets */
  hitstopLight: 3,
  hitstopHeavy: 5,
  hitstopSuper: 10,

  /** physics */
  gravity: 0.62,
  airFriction: 0.985,
  groundFriction: 0.72,
  pushboxW: 34,
  pushboxH: 106,
  cornerPushMul: 1.35,

  /** proration: hits after a launcher deal less hitstun */
  hitstunDecay: 0.94,

  /** screen */
  shakeDecay: 0.86,
  maxShake: 9,

  /** KO */
  koSlowmoFrames: 70,
  koSlowmoRate: 0.28,
  roundEndFreeze: 110,

  /** cpu */
  cpuMinReaction: 5,
} as const;

export interface DifficultyTuning {
  reaction: number;
  blockChance: number;
  punishChance: number;
  comboLen: number;
  aggression: number;
  techChance: number;
  antiAir: number;
  specialChance: number;
  superChance: number;
  spacingSkill: number;
  label: string;
  desc: string;
}

export const DIFFICULTY_TUNING: Record<
  'CADET' | 'MANDIRIGMA' | 'BAYANI' | 'ALAMAT',
  DifficultyTuning
> = {
  CADET: {
    reaction: 20,
    blockChance: 0.24,
    punishChance: 0.1,
    comboLen: 2,
    aggression: 0.45,
    techChance: 0.08,
    antiAir: 0.15,
    specialChance: 0.18,
    superChance: 0.25,
    spacingSkill: 0.25,
    label: 'CADET',
    desc: 'Learning the ropes. Forgiving and slow to react.',
  },
  MANDIRIGMA: {
    reaction: 14,
    blockChance: 0.42,
    punishChance: 0.28,
    comboLen: 3,
    aggression: 0.6,
    techChance: 0.2,
    antiAir: 0.3,
    specialChance: 0.32,
    superChance: 0.45,
    spacingSkill: 0.45,
    label: 'MANDIRIGMA',
    desc: 'A trained warrior. Blocks well, punishes mistakes.',
  },
  BAYANI: {
    reaction: 10,
    blockChance: 0.6,
    punishChance: 0.5,
    comboLen: 4,
    aggression: 0.72,
    techChance: 0.36,
    antiAir: 0.48,
    specialChance: 0.45,
    superChance: 0.68,
    spacingSkill: 0.68,
    label: 'BAYANI',
    desc: 'A hero of the age. Strong spacing and real combos.',
  },
  ALAMAT: {
    reaction: 7,
    blockChance: 0.74,
    punishChance: 0.68,
    comboLen: 5,
    aggression: 0.82,
    techChance: 0.52,
    antiAir: 0.62,
    specialChance: 0.55,
    superChance: 0.85,
    spacingSkill: 0.85,
    label: 'ALAMAT',
    desc: 'Legend. Fair, but it reads the whole match.',
  },
};
