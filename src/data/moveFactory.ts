// ============================================================================
// Move factory helpers. Keeps fighter data compact and guarantees every attack
// has complete frame data (startup / active / recovery / hitstun / boxes).
// ============================================================================

import type {
  AttackDef,
  HitDef,
  Box,
  AttackHeight,
  HitFx,
  MoveKind,
  ProjectileDef,
} from '../game/types';

export interface HitSpec {
  /** frame offset within the active window (default 0) */
  at?: number;
  /** how many frames this hit stays live (default = whole active window) */
  len?: number;
  box: [number, number, number, number];
  dmg: number;
  hs?: number;
  bs?: number;
  stop?: number;
  h?: AttackHeight;
  kbx?: number;
  kby?: number;
  push?: number;
  launcher?: boolean;
  antiAir?: boolean;
  knockdown?: boolean;
  meter?: number;
  fx?: HitFx;
  sfx?: string;
}

export interface MoveSpec {
  id: string;
  name: string;
  kind?: MoveKind;
  anim: string;
  notation: string;
  startup: number;
  active: number;
  recovery: number;
  hits: HitSpec[];
  cancels?: string[];
  cancelFrom?: number;
  whiffCancel?: boolean;
  meterCost?: number;
  requiresSpirit?: boolean;
  move?: Array<[number, number] | [number, number, number]>;
  invuln?: [number, number];
  armor?: [number, number];
  counter?: AttackDef['counter'];
  projectile?: Partial<ProjectileDef> & { spawnFrame?: number };
  throwDef?: AttackDef['throwDef'];
  buff?: AttackDef['buff'];
  heal?: number;
  airOK?: boolean;
  airOnly?: boolean;
  crouchOnly?: boolean;
  freeze?: number;
  cinematic?: boolean;
  cooldown?: number;
  ender?: boolean;
  desc?: string;
}

const DEFAULT_FX: Record<string, HitFx> = {
  slash: 'slash',
  blunt: 'blunt',
  punch: 'punch',
};

export function mv(s: MoveSpec): AttackDef {
  const startup = s.startup;
  const hits: HitDef[] = s.hits.map((hs) => {
    const at = startup + (hs.at ?? 0);
    const len = hs.len ?? s.active;
    const h: AttackHeight = hs.h ?? 'mid';
    const dmg = hs.dmg;
    const box: Box = { x: hs.box[0], y: hs.box[1], w: hs.box[2], h: hs.box[3] };
    return {
      start: at,
      end: at + Math.max(1, len) - 1,
      box,
      damage: dmg,
      hitstun: hs.hs ?? Math.round(11 + dmg * 0.75),
      blockstun: hs.bs ?? Math.round(7 + dmg * 0.35),
      hitstop: hs.stop ?? (dmg >= 14 ? 5 : dmg >= 8 ? 4 : 3),
      height: h,
      kbx: hs.kbx ?? (dmg >= 14 ? 4.4 : dmg >= 8 ? 3.0 : 1.9),
      kby: hs.kby ?? 0,
      pushback: hs.push ?? 1.1,
      launcher: hs.launcher,
      antiAir: hs.antiAir,
      knockdown: hs.knockdown,
      meter: hs.meter ?? Math.max(3, Math.round(dmg * 0.85)),
      fx: hs.fx ?? 'blunt',
      sfx: hs.sfx ?? (hs.fx === 'slash' ? 'slash' : dmg >= 12 ? 'hitHeavy' : 'hitLight'),
    };
  });

  const movement = s.move?.map((m) => ({
    frame: m[0],
    vx: m[1],
    vy: m.length > 2 ? (m[2] as number) : undefined,
  }));

  let projectile: ProjectileDef | undefined;
  if (s.projectile) {
    const p = s.projectile;
    projectile = {
      spawnFrame: p.spawnFrame ?? startup,
      ox: p.ox ?? 26,
      oy: p.oy ?? 60,
      vx: p.vx ?? 6,
      vy: p.vy ?? 0,
      gravity: p.gravity,
      life: p.life ?? 90,
      w: p.w ?? 22,
      h: p.h ?? 16,
      damage: p.damage ?? 8,
      hitstun: p.hitstun ?? 18,
      blockstun: p.blockstun ?? 12,
      hitstop: p.hitstop ?? 4,
      height: p.height ?? 'mid',
      kbx: p.kbx ?? 3,
      kby: p.kby ?? 0,
      meter: p.meter ?? 8,
      style: p.style ?? 'light',
      colorRamp: p.colorRamp,
      launcher: p.launcher,
    };
  }

  return {
    id: s.id,
    name: s.name,
    kind: s.kind ?? 'normal',
    anim: s.anim,
    notation: s.notation,
    startup,
    active: s.active,
    recovery: s.recovery,
    hits,
    cancels: s.cancels,
    cancelFrom: s.cancelFrom ?? startup,
    whiffCancel: s.whiffCancel,
    meterCost: s.meterCost,
    requiresSpirit: s.requiresSpirit,
    movement,
    invuln: s.invuln,
    armor: s.armor,
    counter: s.counter,
    projectile,
    throwDef: s.throwDef,
    buff: s.buff,
    heal: s.heal,
    airOK: s.airOK,
    airOnly: s.airOnly,
    crouchOnly: s.crouchOnly,
    freeze: s.freeze,
    cinematic: s.cinematic,
    cooldown: s.cooldown,
    ender: s.ender,
    desc: s.desc,
  };
}

/** total frames a move occupies */
export function moveLength(a: AttackDef): number {
  return a.startup + a.active + a.recovery;
}

/** frame advantage on block, for the move list display */
export function blockAdv(a: AttackDef): number {
  const h = a.hits[0];
  if (!h) return 0;
  const recovery = moveLength(a) - (h.end + 1);
  return h.blockstun - recovery;
}
