// ============================================================================
// Roster index + lookup helpers.
// ============================================================================

import type { AttackDef, FighterDef } from '../game/types';
import { ROSTER_1 } from './fighters1';
import { ROSTER_2 } from './fighters2';
import { ROSTER_3, BOSS } from './fighters3';

export const FIGHTERS: FighterDef[] = [...ROSTER_1, ...ROSTER_2, ...ROSTER_3];

export const ALL_FIGHTERS: FighterDef[] = [...FIGHTERS, BOSS];

export const BOSS_ID = BOSS.id;

const byId = new Map<string, FighterDef>();
for (const f of ALL_FIGHTERS) byId.set(f.id, f);

export function getFighter(id: string): FighterDef {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown fighter: ${id}`);
  return f;
}

export function tryFighter(id: string | null | undefined): FighterDef | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

/** Fighters selectable at the character-select screen (boss excluded). */
export const SELECTABLE = FIGHTERS;

/** ids unlocked from the start */
export const DEFAULT_UNLOCKED = FIGHTERS.filter((f) => f.unlocked).map((f) => f.id);

/** ids that must be earned */
export const LOCKED_IDS = FIGHTERS.filter((f) => !f.unlocked).map((f) => f.id);

/** Every move of a fighter, ordered for the move list UI. */
export function moveList(f: FighterDef): AttackDef[] {
  const order = [
    'l1',
    'l2',
    'l3',
    'cl',
    'h1',
    'h2',
    'sweep',
    'over',
    'launch',
    'airL',
    'airH',
    'throwF',
    'sp1',
    'sp2',
    'sp3',
    'sp4',
    'super',
  ];
  const out: AttackDef[] = [];
  for (const id of order) {
    const m = f.moves[id];
    if (m) out.push(m);
  }
  // anything not in the canonical order still gets listed
  for (const [id, m] of Object.entries(f.moves)) {
    if (!order.includes(id)) out.push(m);
  }
  return out;
}

export function normalCount(f: FighterDef): number {
  return moveList(f).filter((m) => m.kind === 'normal').length;
}

export function specialCount(f: FighterDef): number {
  return moveList(f).filter((m) => m.kind === 'special').length;
}
