// ============================================================================
// Physics + per-frame state machine advance for a fighter.
// ============================================================================

import { Fighter } from '../fighters/Fighter';
import { BALANCE } from '../data/balance';
import { moveLength } from '../data/moveFactory';
import { overlaps } from '../combat/hit';

export interface StageBounds {
  left: number;
  right: number;
}

/** Advance timers that keep running during hitstop. */
export function stepTimers(f: Fighter): void {
  if (f.hitstop > 0) {
    f.hitstop--;
    return;
  }
  if (f.freeze > 0) {
    f.freeze--;
    return;
  }
  if (f.flash > 0) f.flash--;
  if (f.spiritFlash > 0) f.spiritFlash--;
  if (f.chainTimer > 0) f.chainTimer--;
  if (f.comboTimer > 0) {
    f.comboTimer--;
    if (f.comboTimer === 0) {
      f.comboHits = 0;
      f.juggleHits = 0;
    }
  }
  if (f.invulnFrames > 0) f.invulnFrames--;
  for (let i = f.buffs.length - 1; i >= 0; i--) {
    f.buffs[i].left--;
    if (f.buffs[i].left <= 0) f.buffs.splice(i, 1);
  }
  f.updateSpirit();
}

/** Advance the animation clock. */
export function stepAnim(f: Fighter, frames: number): void {
  if (f.hitstop > 0 || f.freeze > 0) return;
  f.animFrame++;
}

/**
 * Advance the fighter's state machine one frame. Attack hit detection happens
 * in the engine, not here.
 */
export function stepState(f: Fighter, bounds: StageBounds, opponent: Fighter): void {
  if (f.hitstop > 0 || f.freeze > 0) return;
  f.stateFrame++;

  switch (f.state) {
    case 'intro':
      if (f.stateFrame > 40) f.setState('idle');
      break;

    case 'jumpsquat':
      if (f.stateFrame >= BALANCE.jumpsquat) {
        const ax = f.input.axis(f.facing);
        f.vy = f.phys.jumpV;
        f.vx = ax * f.phys.jumpH * f.facing;
        f.y = 0.5;
        f.setState('air');
      }
      break;

    case 'dash':
      if (f.stateFrame >= f.phys.dashFrames) {
        f.vx = 0;
        f.setState('idle');
      } else {
        f.vx = f.facing * f.phys.dashSpeed * f.buffSpeed * (1 - f.stateFrame / (f.phys.dashFrames * 1.8));
      }
      break;

    case 'backdash':
      if (f.stateFrame >= f.phys.backdashFrames) {
        f.vx = 0;
        f.setState('idle');
      } else {
        f.vx = -f.facing * f.phys.backdashSpeed * (1 - f.stateFrame / (f.phys.backdashFrames * 1.5));
      }
      break;

    case 'land':
      if (f.stateFrame >= BALANCE.landRecovery) f.setState('idle');
      break;

    case 'attack':
      stepAttack(f);
      break;

    case 'blockstun':
    case 'blockstunCrouch':
      f.stun--;
      f.vx *= 0.82;
      if (f.stun <= 0) {
        if (f.input.isHeld('block')) {
          f.blocking = true;
          f.blockingLow = f.input.isHeld('down');
          f.setState(f.blockingLow ? 'blockCrouch' : 'blockStand');
        } else {
          f.setState('idle');
        }
      }
      break;

    case 'hitstun':
    case 'hitstunCrouch':
      f.stun--;
      f.vx *= 0.86;
      if (f.stun <= 0) {
        f.setState(f.airborne ? 'air' : 'idle');
      }
      break;

    case 'juggle':
      f.stun = Math.max(0, f.stun - 1);
      if (!f.airborne && f.stateFrame > 2) {
        f.setState('knockdown');
        f.stun = BALANCE.knockdownFrames;
        f.vx *= 0.3;
      }
      break;

    case 'knockdown': {
      f.stun--;
      f.vx *= 0.8;
      // quick rise: press up or block while down
      const quick =
        f.stun <= BALANCE.knockdownFrames - BALANCE.quickRiseFrames &&
        (f.input.isHeld('up') || f.input.isHeld('block'));
      if (f.stun <= 0 || quick) {
        f.setState('wakeup');
        f.stun = BALANCE.wakeupFrames;
        f.invulnFrames = BALANCE.wakeupInvuln;
        f.comboHits = 0;
        f.juggleHits = 0;
      }
      break;
    }

    case 'wakeup':
      f.stun--;
      f.vx *= 0.7;
      if (f.stun <= 0) f.setState('idle');
      break;

    case 'grabAttempt':
      f.stun--;
      if (f.stun <= 0) f.setState('idle');
      break;

    case 'grabbing':
      // the engine drives throw progress
      break;

    case 'grabbed':
      break;

    case 'thrown':
      f.stun--;
      if (!f.airborne && f.stateFrame > 3) {
        f.setState('knockdown');
        f.stun = BALANCE.knockdownFrames;
      }
      break;

    case 'stance':
      f.stun--;
      if (f.stun <= 0) f.setState('idle');
      break;

    case 'ko':
      f.vx *= 0.94;
      break;

    case 'victory':
      f.vx = 0;
      break;

    default:
      break;
  }
}

function stepAttack(f: Fighter): void {
  const m = f.move;
  if (!m) {
    f.setState('idle');
    return;
  }
  f.moveFrame++;

  // movement keys
  if (m.movement) {
    for (const k of m.movement) {
      if (k.frame === f.moveFrame - 1) {
        f.vx = f.facing * k.vx;
        if (k.vy !== undefined) {
          f.vy = -k.vy;
          if (f.y <= 0 && k.vy < 0) f.y = 0.5;
        }
      }
    }
  }

  // invulnerability windows
  if (m.invuln && f.moveFrame >= m.invuln[0] && f.moveFrame <= m.invuln[1]) {
    f.invulnFrames = Math.max(f.invulnFrames, 1);
  }

  // counter stance window
  if (m.counter) {
    f.counterActive = f.moveFrame >= m.counter.start && f.moveFrame <= m.counter.end;
    f.counterRiposte = m.counter.riposte;
  } else {
    f.counterActive = false;
  }

  const total = moveLength(m);

  // cancel into the queued move as soon as legal
  if (f.queued) {
    const inActiveOrLater = f.moveFrame >= (m.cancelFrom ?? m.startup);
    const connected = f.moveConnected || m.whiffCancel || m.kind === 'special';
    if (inActiveOrLater && (connected || f.moveFrame >= m.startup + m.active)) {
      const id = f.queued;
      f.queued = null;
      f.startMove(id);
      return;
    }
  }

  if (f.moveFrame >= total) {
    f.move = null;
    f.counterActive = false;
    if (f.airborne) f.setState('air');
    else f.setState('idle');
  }
}

/** Integrate velocity, gravity, floor and stage bounds. */
export function stepPhysics(f: Fighter, bounds: StageBounds): void {
  if (f.hitstop > 0 || f.freeze > 0) return;

  const airborne = f.y > 0;
  if (airborne || f.vy !== 0) {
    let g = f.phys.gravity;
    if (f.state === 'juggle') {
      g += Math.min(
        BALANCE.juggleGravityMax - 1,
        f.juggleHits * BALANCE.juggleGravityStep,
      );
    }
    f.vy -= g;
    f.y += f.vy;
    f.vx *= BALANCE.airFriction;
    if (f.y <= 0) {
      f.y = 0;
      const hardLand = f.vy < -8;
      f.vy = 0;
      if (f.state === 'air') {
        f.setState('land');
        f.vx *= 0.4;
      } else if (f.state === 'juggle' || f.state === 'thrown') {
        // handled in stepState
      } else if (f.state !== 'ko' && f.state !== 'knockdown') {
        f.setState('land');
      }
      void hardLand;
    }
  } else {
    // ground friction unless the state drives velocity
    if (
      f.state !== 'dash' &&
      f.state !== 'backdash' &&
      f.state !== 'walkF' &&
      f.state !== 'walkB' &&
      f.state !== 'attack'
    ) {
      f.vx *= BALANCE.groundFriction;
      if (Math.abs(f.vx) < 0.05) f.vx = 0;
    }
  }

  f.x += f.vx;

  // stage bounds
  const half = BALANCE.pushboxW / 2;
  if (f.x - half < bounds.left) {
    f.x = bounds.left + half;
    if (f.vx < 0) f.vx = 0;
  }
  if (f.x + half > bounds.right) {
    f.x = bounds.right - half;
    if (f.vx > 0) f.vx = 0;
  }
}

/** Resolve pushbox overlap between the two fighters. */
export function resolvePush(a: Fighter, b: Fighter, bounds: StageBounds): void {
  const pa = a.pushbox;
  const pb = b.pushbox;
  if (!overlaps(pa, pb)) return;
  // vertical separation: don't push when clearly above one another
  const aTop = a.y + pa.h;
  const bTop = b.y + pb.h;
  if (a.y > bTop - 8 || b.y > aTop - 8) return;

  const overlapAmount =
    Math.min(pa.x + pa.w, pb.x + pb.w) - Math.max(pa.x, pb.x);
  if (overlapAmount <= 0) return;

  const half = overlapAmount / 2 + 0.05;
  const aLeft = a.x < b.x;
  const wa = a.phys.weight;
  const wb = b.phys.weight;
  const total = wa + wb;
  let aPush = half * (wb / total) * 2;
  let bPush = half * (wa / total) * 2;

  const hb = BALANCE.pushboxW / 2;
  const aAtLeftWall = a.x - hb <= bounds.left + 0.5;
  const aAtRightWall = a.x + hb >= bounds.right - 0.5;
  const bAtLeftWall = b.x - hb <= bounds.left + 0.5;
  const bAtRightWall = b.x + hb >= bounds.right - 0.5;

  // if one fighter is cornered, the other absorbs the whole push
  if (aLeft) {
    if (aAtLeftWall) {
      bPush += aPush;
      aPush = 0;
    } else if (bAtRightWall) {
      aPush += bPush;
      bPush = 0;
    }
    a.x -= aPush;
    b.x += bPush;
  } else {
    if (bAtLeftWall) {
      aPush += bPush;
      bPush = 0;
    } else if (aAtRightWall) {
      bPush += aPush;
      aPush = 0;
    }
    a.x += aPush;
    b.x -= bPush;
  }

  clampToBounds(a, bounds);
  clampToBounds(b, bounds);
}

export function clampToBounds(f: Fighter, bounds: StageBounds): void {
  const half = BALANCE.pushboxW / 2;
  f.x = Math.max(bounds.left + half, Math.min(bounds.right - half, f.x));
}

/** Face the opponent when neutral. */
export function updateFacing(f: Fighter, opp: Fighter): void {
  if (f.state === 'attack' || f.state === 'grabbing' || f.state === 'grabbed') return;
  if (
    f.state === 'hitstun' ||
    f.state === 'hitstunCrouch' ||
    f.state === 'juggle' ||
    f.state === 'knockdown' ||
    f.state === 'ko' ||
    f.state === 'thrown'
  ) {
    return;
  }
  const want: 1 | -1 = opp.x >= f.x ? 1 : -1;
  if (want !== f.facing) f.facing = want;
}
