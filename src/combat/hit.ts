// ============================================================================
// Combat: hitbox/hurtbox overlap, block resolution, damage, counters, juggles.
// This module is pure logic; it reports events for FX and UI.
// ============================================================================

import { Fighter } from '../fighters/Fighter';
import { BALANCE } from '../data/balance';
import type { AttackDef, Box, HitDef, HitFx } from '../game/types';

export function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function boxCenter(a: Box, b: Box): { x: number; y: number } {
  const x0 = Math.max(a.x, b.x);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y0 = Math.max(a.y, b.y);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

export interface HitEvent {
  attacker: Fighter;
  victim: Fighter;
  hit: HitDef;
  move: AttackDef;
  x: number;
  y: number;
  damage: number;
  blocked: boolean;
  counter: boolean;
  armored: boolean;
  ko: boolean;
  comboHits: number;
  fx: HitFx;
  sfx: string;
  hitstop: number;
  launched: boolean;
}

/** Would this attack height be blocked by the victim's current guard? */
export function blocksIt(victim: Fighter, hit: HitDef): boolean {
  if (!victim.blocking && victim.state !== 'blockstun' && victim.state !== 'blockstunCrouch') {
    return false;
  }
  if (victim.airborne) return false;
  if (hit.height === 'unblockable') return false;
  const low = victim.blockingLow;
  switch (hit.height) {
    case 'low':
      return low;
    case 'overhead':
      return !low;
    case 'high':
      return !low;
    case 'mid':
      return true;
    default:
      return true;
  }
}

/** Damage scaling from combo length + juggle count. */
export function scaleFor(victim: Fighter): number {
  const i = victim.comboHits;
  const table = BALANCE.comboScale;
  const base = i < table.length ? table[i] : BALANCE.comboScaleFloor;
  const jug = victim.juggleHits > 0 ? Math.pow(0.9, victim.juggleHits) : 1;
  return Math.max(BALANCE.comboScaleFloor, base * jug);
}

/**
 * Apply one hit. Assumes overlap already confirmed and the hit index has not
 * been used yet for this move activation.
 */
export function applyHit(
  attacker: Fighter,
  victim: Fighter,
  move: AttackDef,
  hit: HitDef,
  hx: number,
  hy: number,
): HitEvent {
  const blocked = blocksIt(victim, hit);
  // counter hit: victim was in the startup of its own attack
  const counter =
    !blocked &&
    victim.state === 'attack' &&
    !!victim.move &&
    victim.moveFrame < victim.move.startup &&
    !victim.move.invuln;

  const armorBuff = victim.hasArmorBuff;
  const armorFrames =
    victim.state === 'attack' &&
    victim.move?.armor &&
    victim.moveFrame >= victim.move.armor[0] &&
    victim.moveFrame <= victim.move.armor[1];
  const armored = !blocked && (armorBuff || !!armorFrames) && !victim.armorUsed;

  let dmg = hit.damage * BALANCE.damageMul * attacker.buffDamage * attacker.phys.attackMul;
  dmg *= victim.buffDefense * victim.phys.defense;

  if (blocked) {
    dmg = dmg * BALANCE.chipRatio;
  } else {
    dmg *= scaleFor(victim);
    if (counter) dmg *= BALANCE.counterDamageMul;
    if (armored) dmg *= 0.4;
  }
  dmg = Math.max(1, Math.round(dmg));

  // ---- health ------------------------------------------------------------
  let ko = false;
  if (!victim.infiniteHp) {
    if (blocked && BALANCE.chipCannotKill) {
      victim.hp = Math.max(1, victim.hp - dmg);
    } else {
      victim.hp = Math.max(0, victim.hp - dmg);
    }
    if (victim.hp <= 0) ko = true;
  }

  // ---- meter -------------------------------------------------------------
  const meterBase = hit.meter;
  if (blocked) {
    attacker.addMeter(meterBase * BALANCE.meterOnBlock);
    victim.addMeter(meterBase * BALANCE.meterOnBlock * 1.2);
    victim.stats.blocks++;
  } else {
    attacker.addMeter(meterBase * (counter ? BALANCE.meterOnCounter : BALANCE.meterOnHit));
    victim.addMeter(meterBase * BALANCE.meterOnTakeDamage);
  }
  attacker.stats.damageDealt += blocked ? 0 : dmg;
  if (counter) attacker.stats.counters++;

  // ---- hitstop -----------------------------------------------------------
  let stop = hit.hitstop;
  if (counter) stop += BALANCE.counterHitstopBonus;
  if (blocked) stop = Math.max(2, stop - 1);
  if (ko) stop += 6;
  attacker.hitstop = Math.max(attacker.hitstop, stop);
  victim.hitstop = Math.max(victim.hitstop, stop + (blocked ? 0 : 1));

  // ---- reaction ----------------------------------------------------------
  const dirTo = attacker.facing;
  let launched = false;

  if (blocked) {
    victim.stun = Math.max(BALANCE.minBlockstun, hit.blockstun);
    victim.setState(victim.blockingLow ? 'blockstunCrouch' : 'blockstun');
    victim.vx = dirTo * Math.max(1.2, hit.kbx * 0.42);
    victim.comboTimer = 0;
    attacker.vx -= dirTo * hit.pushback * 0.5;
    attacker.moveConnected = true;
    return event(false);
  }

  if (armored) {
    victim.armorUsed = true;
    victim.flash = 6;
    victim.vx = dirTo * hit.kbx * 0.25;
    attacker.moveConnected = true;
    return event(true);
  }

  // clean hit
  attacker.moveConnected = true;
  victim.armorUsed = false;
  victim.blocking = false;
  victim.blockingLow = false;
  victim.move = null;
  victim.queued = null;
  victim.flash = 5;
  victim.comboHits++;
  victim.comboTimer = 60;
  if (victim.comboHits > attacker.stats.longestCombo) {
    attacker.stats.longestCombo = victim.comboHits;
  }

  let hitstun = hit.hitstun;
  if (counter) hitstun = Math.round(hitstun * BALANCE.counterHitstunMul);
  hitstun = Math.round(hitstun * Math.pow(BALANCE.hitstunDecay, Math.max(0, victim.comboHits - 1)));

  const wasAirborne = victim.airborne || victim.state === 'juggle';
  const doLaunch = !!hit.launcher && !wasAirborne;

  if (doLaunch) {
    launched = true;
    victim.juggleHits = 0;
    victim.setState('juggle');
    victim.vy = hit.kby > 0 ? hit.kby : 9;
    victim.vx = dirTo * (hit.kbx * 0.5 + 1.2);
    victim.airHitstun = Math.max(hitstun, 30);
    victim.stun = victim.airHitstun;
  } else if (wasAirborne) {
    victim.juggleHits = Math.min(BALANCE.maxJuggleHits, victim.juggleHits + 1);
    victim.setState('juggle');
    const forceDown =
      victim.juggleHits >= BALANCE.maxJuggleHits || hit.knockdown || hit.kby < 0;
    if (forceDown) {
      victim.vy = Math.min(victim.vy, -2.2) + (hit.kby < 0 ? hit.kby : 0);
      victim.vx = dirTo * (hit.kbx * 0.7 + 1.4);
    } else {
      victim.vy = Math.max(1.6, hit.kby * 0.72 + 2.2);
      victim.vx = dirTo * (hit.kbx * 0.42 + 0.9);
    }
    victim.airHitstun = Math.max(
      BALANCE.juggleHitstunFloor,
      Math.round(hitstun * BALANCE.juggleHitstunMul),
    );
    victim.stun = victim.airHitstun;
  } else if (hit.knockdown || counter && hit.damage >= 14) {
    victim.setState('knockdown');
    victim.stun = BALANCE.knockdownFrames;
    victim.vx = dirTo * hit.kbx * 1.1;
    victim.vy = Math.max(3.2, hit.kby);
    victim.juggleHits = 0;
  } else {
    const low = hit.height === 'low';
    victim.setState(
      counter ? 'hitstun' : low ? 'hitstunCrouch' : 'hitstun',
      counter ? 'counterHit' : low ? 'hitLow' : 'hitHigh',
    );
    victim.stun = hitstun;
    victim.vx = dirTo * hit.kbx;
    if (hit.kby > 0) victim.vy = hit.kby;
  }

  attacker.vx -= dirTo * hit.pushback * 0.35;

  if (ko) {
    victim.dead = true;
    victim.setState('ko');
    victim.stun = 999;
    victim.vx = dirTo * Math.max(3.4, hit.kbx * 1.2);
    victim.vy = Math.max(4.0, hit.kby * 0.8 + 3);
  }

  return event(false);

  function event(wasArmored: boolean): HitEvent {
    return {
      attacker,
      victim,
      hit,
      move,
      x: hx,
      y: hy,
      damage: dmg,
      blocked,
      counter,
      armored: wasArmored,
      ko,
      comboHits: victim.comboHits,
      fx: hit.fx,
      sfx: blocked ? 'block' : counter ? 'counter' : hit.sfx,
      hitstop: stop,
      launched,
    };
  }
}

// ---------------------------------------------------------------------------
// Throws
// ---------------------------------------------------------------------------

export function inThrowRange(a: Fighter, b: Fighter, command = false): boolean {
  const dx = Math.abs(a.x - b.x);
  const range = command ? 62 : 46;
  const facingRight = a.facing === 1 ? b.x > a.x - 8 : b.x < a.x + 8;
  return dx <= range && !b.airborne && !a.airborne && facingRight;
}

export function canBeThrown(v: Fighter): boolean {
  if (v.airborne) return false;
  if (v.dead || v.won) return false;
  switch (v.state) {
    case 'hitstun':
    case 'hitstunCrouch':
    case 'juggle':
    case 'knockdown':
    case 'wakeup':
    case 'ko':
    case 'grabbed':
    case 'thrown':
    case 'grabbing':
      return false;
    default:
      return true;
  }
}
