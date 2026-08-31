// ============================================================================
// Body plans + palettes: the data that makes each fighter's sprite unique.
// The forge (SpriteForge.ts) turns a plan + palette + pose into pixels.
// ============================================================================

export type HairStyle =
  | 'warriorLong'
  | 'parted'
  | 'sweptBack'
  | 'braidLong'
  | 'militaryShort'
  | 'elderBun'
  | 'tiedTail'
  | 'crownWrap'
  | 'shadowMane'
  | 'wildLong'
  | 'bob'
  | 'artistWave';

export type Headgear =
  | 'none'
  | 'putongRed'
  | 'salakot'
  | 'turbanRoyal'
  | 'kerchief'
  | 'officerCap'
  | 'shadowCrown'
  | 'beret';

export type WeaponKind =
  | 'kampilan'
  | 'bolo'
  | 'cane'
  | 'sabre'
  | 'rapier'
  | 'bayonet'
  | 'staff'
  | 'brush'
  | 'lantern'
  | 'kris'
  | 'fists'
  | 'shadowblade';

export type OutfitKind =
  | 'datu'
  | 'barong'
  | 'katipunan'
  | 'revolucionaria'
  | 'general'
  | 'matriarch'
  | 'capitan'
  | 'sultan'
  | 'scholar'
  | 'artist'
  | 'cadet'
  | 'shadow';

export interface BodyPlan {
  /** overall pixel height of the standing figure */
  height: number;
  /** leg length from floor to pelvis */
  legLen: number;
  torsoLen: number;
  neckLen: number;
  headR: number;
  headRy: number;
  shoulderW: number;
  hipW: number;
  upperArm: number;
  foreArm: number;
  upperLeg: number;
  lowerLeg: number;
  armW: number;
  legW: number;
  torsoW: number;
  chestW: number;
  /** 0 = lean, 1 = bulky */
  bulk: number;
  hair: HairStyle;
  headgear: Headgear;
  weapon: WeaponKind;
  offhand: 'shield' | 'sheath' | 'none' | 'cloth' | 'book' | 'palette' | 'lantern' | 'kris';
  outfit: OutfitKind;
  /** long coat / skirt / sash length, 0 = none */
  skirt: number;
  cape: number;
  /** female-read silhouette adjustments */
  fem?: boolean;
  /** facial hair: 0 none, 1 moustache, 2 full beard, 3 goatee */
  facialHair: 0 | 1 | 2 | 3;
  /** boots height */
  boot: number;
  /** shoulder armour pads */
  pauldron: boolean;
  beltWidth: number;
  /** glow colour override for supers */
  aura: string;
}

export interface Palette {
  skin: string;
  skinDark: string;
  hair: string;
  cloth: string;
  clothAlt: string;
  accent: string;
  accent2: string;
  metal: string;
  metalDark: string;
  leather: string;
  outline: string;
  eye: string;
  aura: string;
}

const P = (p: Palette): Palette => p;

export const PALETTES: Record<string, Palette> = {
  lapulapu: P({
    skin: '#a9663c',
    skinDark: '#6d3c22',
    hair: '#241a14',
    cloth: '#b8342c',
    clothAlt: '#7a1f1c',
    accent: '#e8b23c',
    accent2: '#f2dc9a',
    metal: '#c9d2dc',
    metalDark: '#5a6674',
    leather: '#6b4426',
    outline: '#18100c',
    eye: '#f4e8d0',
    aura: '#ffb43c',
  }),
  rizal: P({
    skin: '#c78f60',
    skinDark: '#8a5734',
    hair: '#1d1712',
    cloth: '#2b2f3f',
    clothAlt: '#151824',
    accent: '#d8d2c0',
    accent2: '#f4efe0',
    metal: '#b9b39c',
    metalDark: '#4a4638',
    leather: '#4a3222',
    outline: '#120e0c',
    eye: '#efe4cc',
    aura: '#7fd4ff',
  }),
  bonifacio: P({
    skin: '#b87846',
    skinDark: '#7a4a26',
    hair: '#1c1410',
    cloth: '#e8e2d0',
    clothAlt: '#b8b09a',
    accent: '#c0261f',
    accent2: '#f2c23c',
    metal: '#cdd4dc',
    metalDark: '#5c6672',
    leather: '#5d3c20',
    outline: '#140f0b',
    eye: '#f0e6d2',
    aura: '#ff5a3c',
  }),
  gabriela: P({
    skin: '#c08454',
    skinDark: '#83502c',
    hair: '#1a120e',
    cloth: '#7a2038',
    clothAlt: '#4a1224',
    accent: '#e4c256',
    accent2: '#f6e6b0',
    metal: '#d6dce4',
    metalDark: '#606a78',
    leather: '#5a3a22',
    outline: '#130d0c',
    eye: '#f2e6cc',
    aura: '#ff86b0',
  }),
  luna: P({
    skin: '#c48c5c',
    skinDark: '#875436',
    hair: '#221a12',
    cloth: '#3a4a36',
    clothAlt: '#22301f',
    accent: '#d8b040',
    accent2: '#f0e0a8',
    metal: '#c4ccd6',
    metalDark: '#56606c',
    leather: '#4c3220',
    outline: '#110d0a',
    eye: '#eee2c8',
    aura: '#ffd84c',
  }),
  sora: P({
    skin: '#c08c62',
    skinDark: '#7f5636',
    hair: '#d8d4cc',
    cloth: '#3f5f4a',
    clothAlt: '#26402f',
    accent: '#e8dcb0',
    accent2: '#fff4d0',
    metal: '#cbd0c8',
    metalDark: '#5a6058',
    leather: '#63452a',
    outline: '#140f0d',
    eye: '#f0e6cc',
    aura: '#8cffc0',
  }),
  diego: P({
    skin: '#bd8250',
    skinDark: '#7f4f2c',
    hair: '#241a12',
    cloth: '#3a5c78',
    clothAlt: '#213b52',
    accent: '#dcc060',
    accent2: '#f4e8b8',
    metal: '#d0d8e2',
    metalDark: '#5a6674',
    leather: '#54371f',
    outline: '#120e0b',
    eye: '#f0e6d0',
    aura: '#6cd0ff',
  }),
  kudarat: P({
    skin: '#9e6238',
    skinDark: '#653a1e',
    hair: '#191110',
    cloth: '#5a2470',
    clothAlt: '#39144a',
    accent: '#f0c040',
    accent2: '#ffe89a',
    metal: '#dce2ea',
    metalDark: '#616c7a',
    leather: '#6a4526',
    outline: '#150e10',
    eye: '#f4e6c8',
    aura: '#d060ff',
  }),
  mabini: P({
    skin: '#c58f5f',
    skinDark: '#87573a',
    hair: '#20180f',
    cloth: '#2e3d4c',
    clothAlt: '#1a2530',
    accent: '#c8b078',
    accent2: '#eee0bc',
    metal: '#b4bcc6',
    metalDark: '#4c545e',
    leather: '#463020',
    outline: '#100d0b',
    eye: '#ece0c6',
    aura: '#9cb8ff',
  }),
  magbanua: P({
    skin: '#c1834f',
    skinDark: '#83512b',
    hair: '#1b130e',
    cloth: '#8a6a2c',
    clothAlt: '#5c451a',
    accent: '#e8e0c8',
    accent2: '#fff6dc',
    metal: '#d4dae2',
    metalDark: '#5e6874',
    leather: '#573820',
    outline: '#120d0a',
    eye: '#f0e4c8',
    aura: '#ffd070',
  }),
  juanluna: P({
    skin: '#c68f60',
    skinDark: '#875838',
    hair: '#241a14',
    cloth: '#5a4a62',
    clothAlt: '#3a2f42',
    accent: '#e06a3c',
    accent2: '#f2d07a',
    metal: '#c0c6ce',
    metalDark: '#525a64',
    leather: '#4e3524',
    outline: '#130f0c',
    eye: '#eee2c8',
    aura: '#ff9a4c',
  }),
  goyo: P({
    skin: '#c58c58',
    skinDark: '#875634',
    hair: '#1e1610',
    cloth: '#d8d0bc',
    clothAlt: '#a89e88',
    accent: '#2c4a7a',
    accent2: '#e8c860',
    metal: '#ccd4de',
    metalDark: '#586270',
    leather: '#4f3520',
    outline: '#120e0b',
    eye: '#f0e6d0',
    aura: '#7cf0ff',
  }),
  anino: P({
    skin: '#4a4258',
    skinDark: '#241f30',
    hair: '#100c18',
    cloth: '#1a1424',
    clothAlt: '#0d0912',
    accent: '#8a2ce0',
    accent2: '#e04c8c',
    metal: '#7a6c9a',
    metalDark: '#332a46',
    leather: '#221a2c',
    outline: '#07050a',
    eye: '#ff4c6a',
    aura: '#b04cff',
  }),
};

const BASE: BodyPlan = {
  height: 104,
  legLen: 46,
  torsoLen: 34,
  neckLen: 5,
  headR: 9,
  headRy: 10,
  shoulderW: 24,
  hipW: 15,
  upperArm: 17,
  foreArm: 16,
  upperLeg: 22,
  lowerLeg: 22,
  armW: 8,
  legW: 11,
  torsoW: 20,
  chestW: 24,
  bulk: 0.5,
  hair: 'parted',
  headgear: 'none',
  weapon: 'fists',
  offhand: 'none',
  outfit: 'barong',
  skirt: 0,
  cape: 0,
  facialHair: 0,
  boot: 12,
  pauldron: false,
  beltWidth: 4,
  aura: '#ffd24c',
};

function plan(p: Partial<BodyPlan>): BodyPlan {
  return { ...BASE, ...p };
}

export const BODY_PLANS: Record<string, BodyPlan> = {
  // 1. LAPU-LAPU - broad datu, kampilan + shield
  datuWarrior: plan({
    height: 108,
    legLen: 47,
    torsoLen: 36,
    headR: 9,
    headRy: 10,
    shoulderW: 30,
    chestW: 29,
    torsoW: 23,
    hipW: 17,
    armW: 10,
    legW: 13,
    bulk: 0.85,
    hair: 'warriorLong',
    headgear: 'putongRed',
    weapon: 'kampilan',
    offhand: 'shield',
    outfit: 'datu',
    skirt: 16,
    facialHair: 2,
    boot: 0,
    pauldron: true,
    beltWidth: 6,
    aura: '#ffb43c',
  }),

  // 2. RIZAL - slim, precise, cane
  scholarDuelist: plan({
    height: 102,
    legLen: 47,
    torsoLen: 33,
    headR: 8,
    headRy: 9,
    shoulderW: 22,
    chestW: 21,
    torsoW: 17,
    hipW: 13,
    armW: 7,
    legW: 10,
    bulk: 0.3,
    hair: 'parted',
    headgear: 'none',
    weapon: 'cane',
    offhand: 'book',
    outfit: 'scholar',
    skirt: 22,
    facialHair: 0,
    boot: 14,
    beltWidth: 3,
    aura: '#7fd4ff',
  }),

  // 3. BONIFACIO - rushdown, bolo, rolled sleeves
  revolutionary: plan({
    height: 105,
    legLen: 46,
    torsoLen: 35,
    headR: 9,
    headRy: 10,
    shoulderW: 26,
    chestW: 25,
    torsoW: 20,
    hipW: 15,
    armW: 9,
    legW: 11,
    bulk: 0.6,
    hair: 'sweptBack',
    headgear: 'kerchief',
    weapon: 'bolo',
    offhand: 'cloth',
    outfit: 'katipunan',
    skirt: 0,
    facialHair: 1,
    boot: 8,
    beltWidth: 5,
    aura: '#ff5a3c',
  }),

  // 4. GABRIELA - fast, sabre, long braid, riding skirt
  revoltRider: plan({
    height: 100,
    legLen: 46,
    torsoLen: 32,
    headR: 8,
    headRy: 9,
    shoulderW: 20,
    chestW: 19,
    torsoW: 16,
    hipW: 15,
    armW: 7,
    legW: 10,
    bulk: 0.28,
    hair: 'braidLong',
    headgear: 'none',
    weapon: 'sabre',
    offhand: 'sheath',
    outfit: 'revolucionaria' as OutfitKind,
    skirt: 24,
    fem: true,
    facialHair: 0,
    boot: 16,
    beltWidth: 4,
    aura: '#ff86b0',
  }),

  // 5. ANTONIO LUNA - officer, bayonet rifle as polearm
  fieldGeneral: plan({
    height: 104,
    legLen: 46,
    torsoLen: 35,
    headR: 8,
    headRy: 9,
    shoulderW: 25,
    chestW: 24,
    torsoW: 19,
    hipW: 14,
    armW: 8,
    legW: 11,
    bulk: 0.5,
    hair: 'militaryShort',
    headgear: 'officerCap',
    weapon: 'bayonet',
    offhand: 'sheath',
    outfit: 'general',
    skirt: 12,
    facialHair: 1,
    boot: 18,
    pauldron: false,
    beltWidth: 5,
    aura: '#ffd84c',
  }),

  // 6. TANDANG SORA - grounded matriarch, staff + lantern
  matriarchGuardian: plan({
    height: 101,
    legLen: 44,
    torsoLen: 34,
    headR: 9,
    headRy: 9,
    shoulderW: 23,
    chestW: 23,
    torsoW: 20,
    hipW: 17,
    armW: 8,
    legW: 11,
    bulk: 0.6,
    hair: 'elderBun',
    headgear: 'salakot',
    weapon: 'staff',
    offhand: 'lantern',
    outfit: 'matriarch',
    skirt: 30,
    fem: true,
    facialHair: 0,
    boot: 0,
    beltWidth: 5,
    aura: '#8cffc0',
  }),

  // 7. DIEGO SILANG - balanced capitan
  capitanBlade: plan({
    height: 104,
    legLen: 46,
    torsoLen: 34,
    headR: 8,
    headRy: 9,
    shoulderW: 25,
    chestW: 24,
    torsoW: 19,
    hipW: 14,
    armW: 8,
    legW: 11,
    bulk: 0.5,
    hair: 'tiedTail',
    headgear: 'none',
    weapon: 'sabre',
    offhand: 'sheath',
    outfit: 'capitan',
    skirt: 14,
    facialHair: 3,
    boot: 14,
    beltWidth: 5,
    aura: '#6cd0ff',
  }),

  // 8. SULTAN KUDARAT - huge, kris, royal
  sultanColossus: plan({
    height: 114,
    legLen: 48,
    torsoLen: 40,
    headR: 10,
    headRy: 10,
    shoulderW: 36,
    chestW: 35,
    torsoW: 28,
    hipW: 21,
    armW: 13,
    legW: 15,
    bulk: 1,
    hair: 'crownWrap',
    headgear: 'turbanRoyal',
    weapon: 'kris',
    offhand: 'none',
    outfit: 'sultan',
    skirt: 22,
    facialHair: 2,
    boot: 10,
    pauldron: true,
    beltWidth: 8,
    aura: '#d060ff',
  }),

  // 9. MABINI - seated-strategist reimagined as a standing energy caster
  strategistSage: plan({
    height: 101,
    legLen: 45,
    torsoLen: 34,
    headR: 8,
    headRy: 9,
    shoulderW: 21,
    chestW: 20,
    torsoW: 17,
    hipW: 14,
    armW: 7,
    legW: 10,
    bulk: 0.32,
    hair: 'parted',
    headgear: 'none',
    weapon: 'fists',
    offhand: 'book',
    outfit: 'scholar',
    skirt: 28,
    facialHair: 0,
    boot: 12,
    beltWidth: 3,
    aura: '#9cb8ff',
  }),

  // 10. TERESA MAGBANUA - fast bolo cavalry teacher
  teacherLancer: plan({
    height: 101,
    legLen: 46,
    torsoLen: 32,
    headR: 8,
    headRy: 9,
    shoulderW: 21,
    chestW: 20,
    torsoW: 16,
    hipW: 15,
    armW: 7,
    legW: 10,
    bulk: 0.3,
    hair: 'bob',
    headgear: 'none',
    weapon: 'bolo',
    offhand: 'sheath',
    outfit: 'revolucionaria' as OutfitKind,
    skirt: 20,
    fem: true,
    facialHair: 0,
    boot: 15,
    beltWidth: 4,
    aura: '#ffd070',
  }),

  // 11. JUAN LUNA - painter, brush + palette
  painterDuelist: plan({
    height: 103,
    legLen: 46,
    torsoLen: 34,
    headR: 8,
    headRy: 9,
    shoulderW: 23,
    chestW: 22,
    torsoW: 18,
    hipW: 14,
    armW: 8,
    legW: 10,
    bulk: 0.4,
    hair: 'artistWave',
    headgear: 'beret',
    weapon: 'brush',
    offhand: 'palette',
    outfit: 'artist',
    skirt: 18,
    facialHair: 1,
    boot: 12,
    beltWidth: 4,
    aura: '#ff9a4c',
  }),

  // 12. GREGORIO DEL PILAR - young agile officer
  youngOfficer: plan({
    height: 100,
    legLen: 46,
    torsoLen: 32,
    headR: 8,
    headRy: 9,
    shoulderW: 22,
    chestW: 21,
    torsoW: 17,
    hipW: 13,
    armW: 7,
    legW: 10,
    bulk: 0.34,
    hair: 'militaryShort',
    headgear: 'none',
    weapon: 'rapier',
    offhand: 'sheath',
    outfit: 'cadet',
    skirt: 10,
    facialHair: 0,
    boot: 16,
    beltWidth: 4,
    aura: '#7cf0ff',
  }),

  // BOSS - ANG ANINO
  shadowColossus: plan({
    height: 122,
    legLen: 52,
    torsoLen: 44,
    headR: 10,
    headRy: 11,
    shoulderW: 38,
    chestW: 36,
    torsoW: 28,
    hipW: 20,
    armW: 13,
    legW: 15,
    bulk: 0.95,
    hair: 'shadowMane',
    headgear: 'shadowCrown',
    weapon: 'shadowblade',
    offhand: 'none',
    outfit: 'shadow',
    skirt: 34,
    cape: 34,
    facialHair: 0,
    boot: 0,
    pauldron: true,
    beltWidth: 7,
    aura: '#b04cff',
  }),
};
