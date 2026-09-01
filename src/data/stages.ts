// ============================================================================
// Stage definitions. All artwork is generated procedurally by StageRenderer
// from these layer descriptions - no image assets.
// ============================================================================

import type { StageDef } from '../game/types';

const W = 1400;

export const STAGES: StageDef[] = [
  {
    id: 'mactan',
    name: 'MACTAN SHORE',
    subtitle: 'TROPICAL COASTLINE',
    width: W,
    floorY: 0,
    ambient: '#0d1c2e',
    tint: '#ff9a4c',
    tintAlpha: 0.06,
    music: 'shore',
    lore:
      'A wide beach at low tide. Outrigger boats sit pulled up on the sand while the sea works at the reef.',
    unlocked: true,
    ground: ['#c9a878', '#b08f60', '#8e7148', '#6d5636'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#1b3a5c', '#2f6088', '#5d94b4', '#a8cfd8', '#f0d8a8'] },
      { kind: 'clouds', par: 0.06, y: 60, colors: ['#f6e2b8', '#e8c890', '#c9a878'], density: 6, speed: 0.05 },
      { kind: 'birds', par: 0.1, y: 78, colors: ['#26364a'], density: 5, speed: 0.35 },
      { kind: 'mountains', par: 0.14, y: 176, colors: ['#2b4a5e', '#3a5e70', '#4d7182'], density: 5 },
      { kind: 'sea', par: 0.28, y: 196, colors: ['#1d5570', '#2b7290', '#4f9cb4', '#8fd0dc'], amp: 3, speed: 0.6 },
      { kind: 'ships', par: 0.34, y: 206, colors: ['#5b4028', '#7d5a38', '#e8dcc0', '#2a1c12'], density: 3 },
      { kind: 'trees', par: 0.6, y: 236, colors: ['#1d3a24', '#2d5a34', '#3f7a44', '#5f9a58'], density: 7, speed: 0.5 },
    ],
  },
  {
    id: 'intramuros',
    name: 'INTRAMUROS',
    subtitle: 'STONE WALLS AT DUSK',
    width: W,
    floorY: 0,
    ambient: '#241a2c',
    tint: '#ffb45c',
    tintAlpha: 0.08,
    music: 'walls',
    lore:
      'A courtyard inside old stone walls. Lanterns are lit early here because the walls take the light away.',
    unlocked: true,
    ground: ['#8e8378', '#736a60', '#585049', '#3e3833'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#171326', '#2c1f3c', '#4a2c48', '#7a4450', '#c07050'] },
      { kind: 'stars', par: 0.02, y: 40, colors: ['#f0e0c0', '#c8b898'], density: 26 },
      { kind: 'clouds', par: 0.07, y: 66, colors: ['#4a3450', '#63445e', '#7c5468'], density: 5, speed: 0.04 },
      { kind: 'buildings', par: 0.2, y: 210, colors: ['#3a3038', '#4a3e44', '#5c4e52', '#2a2228'], density: 6 },
      { kind: 'wall', par: 0.42, y: 232, colors: ['#6e6258', '#84776b', '#9a8c7e', '#4e453e'], density: 9 },
      { kind: 'lanterns', par: 0.5, y: 190, colors: ['#ffd070', '#ff9a3c', '#7a4a20'], density: 5 },
      { kind: 'flags', par: 0.56, y: 168, colors: ['#b8342c', '#e8b23c', '#2b4a7a'], density: 3, speed: 0.7 },
    ],
  },
  {
    id: 'ilocos',
    name: 'ILOCOS PLAZA',
    subtitle: 'CROWD AND BANNERS',
    width: W,
    floorY: 0,
    ambient: '#2a2418',
    tint: '#ffe08c',
    tintAlpha: 0.07,
    music: 'plaza',
    lore:
      'The plaza in front of an old stone church. A crowd has gathered and nobody is going home.',
    unlocked: true,
    ground: ['#a89878', '#8e7d60', '#736349', '#584c38'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#2e5a86', '#4b7ea6', '#7aa8c0', '#b8d4d0', '#f2e2b0'] },
      { kind: 'clouds', par: 0.06, y: 54, colors: ['#f8ecd0', '#e0cca8', '#c4ac84'], density: 7, speed: 0.05 },
      { kind: 'buildings', par: 0.22, y: 214, colors: ['#8a7458', '#a08a68', '#b8a078', '#5e4c38'], density: 5 },
      { kind: 'flags', par: 0.34, y: 150, colors: ['#c0261f', '#f2c23c', '#e8e2d0'], density: 5, speed: 0.8 },
      { kind: 'crowd', par: 0.52, y: 240, colors: ['#3a2c28', '#4e3c34', '#6a5244', '#8a6a52'], density: 24, speed: 0.4 },
    ],
  },
  {
    id: 'bamboo',
    name: 'BAMBOO FOREST',
    subtitle: 'MOONLIGHT',
    width: W,
    floorY: 0,
    ambient: '#0e1a1e',
    tint: '#6cd0ff',
    tintAlpha: 0.09,
    music: 'bamboo',
    lore:
      'A stand of bamboo so thick the moonlight arrives in strips. Everything here creaks.',
    unlocked: true,
    ground: ['#4a5240', '#3c4434', '#2e3628', '#22281e'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#0a1420', '#122436', '#1e3a4e', '#2e5468', '#48788a'] },
      { kind: 'stars', par: 0.02, y: 30, colors: ['#e8f4ff', '#b8d0e0'], density: 34 },
      { kind: 'fog', par: 0.12, y: 180, colors: ['#8fd0dc', '#5f9aa8'], density: 4, speed: 0.12 },
      { kind: 'bamboo', par: 0.3, y: 250, colors: ['#1c3428', '#2a4a34', '#3c6642', '#548050'], density: 14, speed: 0.55 },
      { kind: 'bamboo', par: 0.62, y: 254, colors: ['#243c2c', '#36583c', '#4c7448', '#68925c'], density: 9, speed: 0.8 },
    ],
  },
  {
    id: 'camp',
    name: 'REVOLUTIONARY CAMP',
    subtitle: 'FIRELIGHT AND TENTS',
    width: W,
    floorY: 0,
    ambient: '#1e1410',
    tint: '#ff8a3c',
    tintAlpha: 0.11,
    music: 'camp',
    lore:
      'A camp between two ridges. Somebody is always awake, and the fires are never quite out.',
    unlocked: true,
    ground: ['#7a6448', '#63503a', '#4c3d2c', '#382d21'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#120e18', '#22182a', '#3a2436', '#5c3438', '#8a4a34'] },
      { kind: 'stars', par: 0.02, y: 34, colors: ['#f0e0c0', '#d8c0a0'], density: 22 },
      { kind: 'mountains', par: 0.14, y: 190, colors: ['#241c26', '#322634', '#42323e'], density: 4 },
      { kind: 'trees', par: 0.3, y: 226, colors: ['#1a2418', '#26341f', '#334428', '#425432'], density: 9, speed: 0.35 },
      { kind: 'tents', par: 0.46, y: 244, colors: ['#c8b48c', '#a89468', '#86744c', '#4a3c28'], density: 4 },
      { kind: 'fire', par: 0.54, y: 246, colors: ['#ffe070', '#ff9a30', '#e04c20', '#7a2410'], density: 3 },
      { kind: 'flags', par: 0.5, y: 172, colors: ['#c0261f', '#f2c23c', '#e8e2d0'], density: 2, speed: 0.7 },
    ],
  },
  {
    id: 'port',
    name: 'MANILA PORT',
    subtitle: 'CARGO AND HULLS',
    width: W,
    floorY: 0,
    ambient: '#141c26',
    tint: '#9cc8ff',
    tintAlpha: 0.06,
    music: 'port',
    lore:
      'A working dock. Crates stacked to the height of a man, and hulls creaking against the pilings.',
    unlocked: true,
    ground: ['#6e6a62', '#585449', '#454138', '#33302a'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#1a2634', '#2c3e50', '#48606e', '#6e8894', '#a8b8b4'] },
      { kind: 'clouds', par: 0.06, y: 62, colors: ['#8e9aa0', '#a8b2b4', '#c0c8c4'], density: 6, speed: 0.06 },
      { kind: 'birds', par: 0.1, y: 84, colors: ['#26303a'], density: 6, speed: 0.4 },
      { kind: 'ships', par: 0.24, y: 214, colors: ['#3a3028', '#584838', '#d8ccb0', '#20180f'], density: 4 },
      { kind: 'sea', par: 0.3, y: 224, colors: ['#1c3a4a', '#2a5264', '#3e7080', '#6a9aa8'], amp: 2, speed: 0.5 },
      { kind: 'rubble', par: 0.56, y: 248, colors: ['#7a6a4e', '#5e5138', '#463c28', '#2e2818'], density: 10 },
    ],
  },
  {
    id: 'pass',
    name: 'MOUNTAIN PASS',
    subtitle: 'FOG AND WIND',
    width: W,
    floorY: 0,
    ambient: '#1a2028',
    tint: '#c8dcff',
    tintAlpha: 0.08,
    music: 'pass',
    lore:
      'A narrow cut between two slopes. The wind comes through it hard enough to lean on.',
    unlocked: true,
    ground: ['#6a6258', '#544d45', '#403a34', '#2e2a26'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#20283a', '#38445c', '#566478', '#7e8c98', '#b0bcbc'] },
      { kind: 'mountains', par: 0.1, y: 150, colors: ['#2e3a4a', '#3e4c5c', '#50606e', '#66757e'], density: 6 },
      { kind: 'fog', par: 0.2, y: 186, colors: ['#c8dcea', '#98acbc'], density: 6, speed: 0.16 },
      { kind: 'mountains', par: 0.36, y: 220, colors: ['#242c38', '#323c48', '#404c56'], density: 4 },
      { kind: 'fog', par: 0.5, y: 236, colors: ['#dce8f4', '#b0c0cc'], density: 4, speed: 0.24 },
      { kind: 'rubble', par: 0.6, y: 250, colors: ['#6e685c', '#565044', '#403a30', '#2c2820'], density: 12 },
    ],
  },
  {
    id: 'ruins',
    name: 'ANCIENT RUINS',
    subtitle: 'WHERE MEMORY THINS',
    width: W,
    floorY: 0,
    ambient: '#160e1e',
    tint: '#b04cff',
    tintAlpha: 0.14,
    music: 'ruins',
    lore:
      'Stones no one can date, arranged by no one anyone remembers. This is where Ang Anino is waiting.',
    unlocked: true,
    ground: ['#4a4054', '#3a3242', '#2c2632', '#1e1a24'],
    layers: [
      { kind: 'sky', par: 0, y: 0, colors: ['#0a0610', '#180e24', '#2a1438', '#42204a', '#5e2c58'] },
      { kind: 'stars', par: 0.02, y: 28, colors: ['#e0c0ff', '#a880d0'], density: 30 },
      { kind: 'shadowveil', par: 0.08, y: 60, colors: ['#3a1a52', '#5a2a78', '#8a3ca8'], density: 5, speed: 0.1 },
      { kind: 'ruins', par: 0.24, y: 216, colors: ['#3e3448', '#4e4258', '#605268', '#2a2232'], density: 6 },
      { kind: 'torii', par: 0.4, y: 224, colors: ['#4a2c58', '#623a70', '#7a4a88', '#2c1a34'], density: 3 },
      { kind: 'fire', par: 0.5, y: 244, colors: ['#e0a0ff', '#b060e0', '#7a30a8', '#3a1050'], density: 4 },
      { kind: 'rubble', par: 0.6, y: 250, colors: ['#544868', '#423652', '#32283e', '#221a2a'], density: 11 },
    ],
  },
];

const stageMap = new Map(STAGES.map((s) => [s.id, s]));

export function getStage(id: string): StageDef {
  return stageMap.get(id) ?? STAGES[0];
}

export const BOSS_STAGE = 'ruins';

/** Preferred home stage per fighter, used by arcade mode. */
export const HOME_STAGE: Record<string, string> = {
  lapulapu: 'mactan',
  rizal: 'intramuros',
  bonifacio: 'camp',
  gabriela: 'ilocos',
  luna: 'pass',
  sora: 'bamboo',
  diego: 'ilocos',
  kudarat: 'port',
  magbanua: 'ilocos',
  juanluna: 'intramuros',
  goyo: 'pass',
  anino: 'ruins',
};
