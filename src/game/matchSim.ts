// ============================================================================
// matchSim: one frame of match simulation. Pure logic, no drawing.
// ============================================================================

import type { GameEngine } from './GameEngine';
import { Fighter } from '../fighters/Fighter';
import { Projectile } from '../combat/Projectile';
import {
  applyHit,
  overlaps,
  boxCenter,
  inThrowRange,
  canBeThrown,
  type HitEvent,
} from '../combat/hit';
import { stepTimers, stepState, stepPhysics, resolvePush, updateFacing } from '../physics/step';
import { audio } from '../audio/AudioManager';
import { music } from '../audio/MusicManager';
import { BALANCE, ROUND_TIME, FPS } from '../data/balance';
import type { Btn } from '../input/InputBuffer';

export function simulate(e: GameEngine): void {
  if (e.phase === 'paused') return;
  e.frame++;
  audio.frameTick();

  if (e.announce) {
    e.announce.life--;
    if (e.announce.life <= 0) e.announce = null;
  }
  if (e.combo) {
    e.combo.life--;
    if (e.combo.life <= 0) e.combo = null;
  }
  if (e.slow > 0) e.slow--;

  switch (e.phase) {
    case 'intro':
      phaseIntro(e);
      break;
    case 'roundStart':
      phaseRoundStart(e);
      break;
    case 'fight':
      phaseFight(e);
      break;
    case 'koFreeze':
      phaseKo(e);
      break;
    case 'roundEnd':
      phaseRoundEnd(e);
      break;
    case 'matchEnd':
      phaseMatchEnd(e);
      break;
  }

  e.fx.update();
  e.camera.update(e.f1.x, e.f2.x, e.aspect);
}

// ---------------------------------------------------------------------------
// phases
// ---------------------------------------------------------------------------

function idleAdvance(e: GameEngine): void {
  for (const f of [e.f1, e.f2]) {
    stepTimers(f);
    if (f.hitstop <= 0 && f.freeze <= 0) f.animFrame++;
    stepState(f, e.bounds, f === e.f1 ? e.f2 : e.f1);
    stepPhysics(f, e.bounds);
  }
  resolvePush(e.f1, e.f2, e.bounds);
}

function phaseIntro(e: GameEngine): void {
  e.phaseFrame++;
  if (e.phaseFrame === 1) {
    e.f1.setState('intro');
    e.f2.setState('intro');
  }
  idleAdvance(e);
  if (e.phaseFrame > 80) {
    e.f1.setState('idle');
    e.f2.setState('idle');
    e.setPhase('roundStart');
    e.announceText('ROUND 1', undefined, true, 72);
    audio.play('round');
  }
}

function phaseRoundStart(e: GameEngine): void {
  e.phaseFrame++;
  if (e.phaseFrame === 1 && e.round > 1) audio.play('round');
  idleAdvance(e);
  if (e.phaseFrame === 74) {
    e.announceText('FIGHT!', undefined, true, 48);
    audio.play('fight');
    e.setPhase('fight');
    e.timer = e.opts.roundTime ?? ROUND_TIME;
    e.timerSub = 0;
    e.perfectRound = true;
    e.timeoutRound = false;
  }
}

function phaseFight(e: GameEngine): void {
  e.phaseFrame++;
  e.matchFrames++;

  // ---- input ----------------------------------------------------------
  e.f1.input.setHeld(e.inputSource(0));
  e.f1.input.update(e.f1.facing);

  let s2: Set<Btn>;
  if (e.cpu) s2 = e.cpu.step();
  else if (e.opts.p2Kind === 'training') s2 = dummyInput(e);
  else s2 = e.inputSource(1);
  e.f2.input.setHeld(s2);
  e.f2.input.update(e.f2.facing);

  if (e.recording) {
    e.recordFrames.push([...e.f1.input.held]);
    if (e.recordFrames.length > 60 * 12) e.recording = false;
  }

  // ---- controllers ----------------------------------------------------
  const ev1 = e.c1.step({ simpleSpecials: e.simpleInputs });
  const ev2 = e.c2.step({ simpleSpecials: e.cpu ? true : e.simpleInputs });
  if (ev1 === 'throwAttempt') tryThrow(e, e.f1, e.f2);
  if (ev2 === 'throwAttempt') tryThrow(e, e.f2, e.f1);

  // ---- timers / state / physics ---------------------------------------
  for (const f of [e.f1, e.f2]) {
    const frozen = f.hitstop > 0 || f.freeze > 0;
    stepTimers(f);
    if (!frozen) f.animFrame++;
    stepState(f, e.bounds, f === e.f1 ? e.f2 : e.f1);
  }

  stepThrows(e);

  for (const f of [e.f1, e.f2]) stepPhysics(f, e.bounds);
  resolvePush(e.f1, e.f2, e.bounds);
  updateFacing(e.f1, e.f2);
  updateFacing(e.f2, e.f1);

  spawnProjectile(e, e.f1);
  spawnProjectile(e, e.f2);

  resolveAttacks(e, e.f1, e.f2);
  if (e.phase !== 'fight') return;
  resolveAttacks(e, e.f2, e.f1);
  if (e.phase !== 'fight') return;
  stepProjectiles(e);

  movementFx(e, e.f1);
  movementFx(e, e.f2);
  spiritFx(e);

  // ---- timer ----------------------------------------------------------
  if (!e.training) {
    e.timerSub++;
    if (e.timerSub >= FPS) {
      e.timerSub = 0;
      if (e.timer > 0) e.timer--;
    }
  }

  // ---- win conditions -------------------------------------------------
  if (e.f1.hp <= 0 || e.f2.hp <= 0) {
    beginKo(e);
    return;
  }
  if (e.timer <= 0 && !e.training) {
    e.timeoutRound = true;
    const w = e.f1.hp === e.f2.hp ? null : e.f1.hp > e.f2.hp ? 0 : 1;
    finishRound(e, w as 0 | 1 | null, true);
  }
}

function phaseKo(e: GameEngine): void {
  e.phaseFrame++;
  idleAdvance(e);
  if (e.phaseFrame > 76) {
    music.duck(false);
    finishRound(e, e.roundWinner, false);
  }
}

function phaseRoundEnd(e: GameEngine): void {
  e.phaseFrame++;
  idleAdvance(e);
  if (e.phaseFrame > BALANCE.roundEndFreeze) {
    const done = e.wins[0] >= e.roundsToWin || e.wins[1] >= e.roundsToWin;
    if (done) {
      e.matchWinner = (e.wins[0] > e.wins[1] ? 0 : 1) as 0 | 1;
      e.matchOver = true;
      e.setPhase('matchEnd');
      const w = e.matchWinner === 0 ? e.f1 : e.f2;
      w.won = true;
      w.setState('victory');
      e.announceText('WINNER', w.def.name, true, 240);
      audio.play('victory');
      e.onEvent('matchEnd', { winner: e.matchWinner });
    } else {
      e.nextRound();
    }
  }
}

function phaseMatchEnd(e: GameEngine): void {
  e.phaseFrame++;
  idleAdvance(e);
}

// ---------------------------------------------------------------------------
// attacks
// ---------------------------------------------------------------------------

function resolveAttacks(e: GameEngine, a: Fighter, v: Fighter): void {
  if (a.state !== 'attack' || !a.move) return;
  if (a.hitstop > 0 || a.freeze > 0) return;
  const m = a.move;

  for (let i = 0; i < m.hits.length; i++) {
    const h = m.hits[i];
    if (a.moveFrame < h.start || a.moveFrame > h.end) continue;
    if (a.hitsUsed.has(i)) continue;
    if (v.invulnFrames > 0) continue;
    if (v.dead || v.state === 'ko') continue;
    // grounded moves cannot hit a high-airborne opponent unless flagged
    const airTarget = v.airborne || v.state === 'juggle';
    if (airTarget && !h.antiAir && !h.launcher && h.kby <= 0 && v.y > 36) continue;

    const hb = a.worldBox(h.box);
    if (!overlaps(hb, v.hurtbox)) continue;

    a.hitsUsed.add(i);

    if (v.counterActive) {
      counterStance(e, v, a, h.damage);
      return;
    }

    const c = boxCenter(hb, v.hurtbox);
    const evt = applyHit(a, v, m, h, c.x, c.y);
    onHit(e, evt);
    if (evt.ko) {
      beginKo(e);
      return;
    }
  }
}

function onHit(e: GameEngine, evt: HitEvent): void {
  const heavy = evt.hit.damage >= 12 || evt.counter;
  const dir = evt.attacker.facing;

  if (evt.blocked) {
    e.fx.block(evt.x, evt.y, dir);
    audio.play('block');
    e.camera.addShake(1.3, e.settings.screenShake);
  } else if (evt.armored) {
    e.fx.block(evt.x, evt.y, dir);
    audio.play('parry');
    e.camera.addShake(1.8, e.settings.screenShake);
    e.fx.label(evt.victim.x, evt.victim.y + 120, 'ARMOR', '#9cd8ff', 10);
  } else {
    e.fx.hit(evt.x, evt.y, evt.fx, heavy, dir, evt.counter);
    audio.play(evt.sfx);
    e.camera.addShake(evt.counter ? 5.5 : heavy ? 4.2 : 2.2, e.settings.screenShake);
    e.fx.damage(evt.x, evt.y + 16, evt.damage, evt.counter);
    if (evt.counter) {
      e.fx.label(evt.victim.x, evt.victim.y + 130, 'COUNTER!', '#ffd83c', 14);
      e.fx.ring(evt.x, evt.y, 'heavy', 1.4);
    }
    if (evt.launched) {
      audio.play('launch');
      e.fx.ring(evt.x, evt.y, 'energy', 1.2);
      e.fx.label(evt.victim.x, evt.victim.y + 134, 'LAUNCH!', '#8fd0ff', 11);
    }
    if (evt.comboHits >= 2) {
      e.combo = { hits: evt.comboHits, who: (evt.attacker.index === 0 ? 0 : 1) as 0 | 1, life: 72 };
    }
  }
  if (evt.move.kind === 'super' && evt.hit.damage >= 20 && !evt.blocked) {
    e.fx.superFlash(evt.x, evt.y, auraOf(evt.attacker));
    e.camera.addShake(7, e.settings.screenShake);
  }
  e.onEvent('hit', evt);
}

function counterStance(e: GameEngine, def: Fighter, atk: Fighter, incoming: number): void {
  def.counterActive = false;
  const riposte = def.counterRiposte;
  const absorb = def.move?.counter?.absorb ?? 0;
  if (absorb > 0 && !def.infiniteHp) {
    def.hp = Math.min(def.maxHp, def.hp + Math.round(incoming * absorb));
  }
  def.hitstop = 9;
  atk.hitstop = 9;
  atk.move = null;
  atk.queued = null;
  atk.setState('hitstun', 'counterHit');
  atk.stun = 24;
  atk.vx = -atk.facing * 2.6;
  atk.comboHits = 0;

  audio.play('parry');
  e.camera.addShake(4.6, e.settings.screenShake);
  e.fx.ring(def.x + def.facing * 22, def.y + 60, 'energy', 1.5);
  e.fx.label(def.x, def.y + 128, 'COUNTER!', '#ffd83c', 14);
  def.stats.counters++;
  def.addMeter(24);

  if (riposte && def.def.moves[riposte]) def.startMove(riposte);
  e.onEvent('counterStance', { who: def.index });
}

// ---------------------------------------------------------------------------
// throws
// ---------------------------------------------------------------------------

function tryThrow(e: GameEngine, a: Fighter, v: Fighter): void {
  const m = a.def.moves.throwF;
  if (!m?.throwDef) return;
  if (!inThrowRange(a, v, false) || !canBeThrown(v)) {
    a.setState('grabAttempt', 'grab');
    a.stun = BALANCE.throwWhiffRecovery;
    audio.play('whiff');
    return;
  }
  startThrow(e, a, v, 'throwF');
}

export function startThrow(e: GameEngine, a: Fighter, v: Fighter, moveId: string): void {
  const m = a.def.moves[moveId];
  if (!m?.throwDef) return;
  a.throwMove = m;
  a.throwPartner = v;
  a.throwFrame = 0;
  a.setState('grabbing', 'throwAnim');
  a.stats.throws++;
  v.throwPartner = a;
  v.throwEscapeMash = 0;
  v.beingThrown = true;
  v.setState('grabbed', 'grabbed');
  v.comboHits = 0;
  v.move = null;
  v.queued = null;
  audio.play('throw');
  e.fx.label(v.x, v.y + 128, 'GRAB', '#ffffff', 10);
}

function stepThrows(e: GameEngine): void {
  for (const a of [e.f1, e.f2]) {
    if (a.state !== 'grabbing' || !a.throwPartner || !a.throwMove?.throwDef) continue;
    const t = a.throwMove.throwDef;
    const v = a.throwPartner;
    a.throwFrame++;

    if (a.throwFrame <= t.escapeWindow) {
      if (v.input.consume('grab')) v.throwEscapeMash++;
      if (v.throwEscapeMash >= 2) {
        a.setState('idle');
        a.throwPartner = null;
        a.throwMove = null;
        v.setState('idle');
        v.throwPartner = null;
        v.beingThrown = false;
        const dir = a.x < v.x ? -1 : 1;
        a.vx = dir * BALANCE.throwTechPushback;
        v.vx = -dir * BALANCE.throwTechPushback;
        a.hitstop = 6;
        v.hitstop = 6;
        audio.play('parry');
        e.fx.label((a.x + v.x) / 2, a.y + 118, 'THROW ESCAPE!', '#8fd0ff', 12);
        e.camera.addShake(3, e.settings.screenShake);
        e.onEvent('throwTech', { who: v.index });
        continue;
      }
    }

    if (a.throwFrame < t.impactFrame) {
      v.x = a.x + a.facing * 30;
      v.y = 0;
      v.vx = 0;
      v.vy = 0;
    }

    if (a.throwFrame === t.impactFrame) {
      const dmg = Math.max(
        1,
        Math.round(
          t.damage * BALANCE.damageMul * a.buffDamage * a.phys.attackMul * v.buffDefense * v.phys.defense,
        ),
      );
      if (!v.infiniteHp) v.hp = Math.max(0, v.hp - dmg);
      a.stats.damageDealt += dmg;
      a.addMeter(t.meter);
      v.addMeter(t.meter * 0.7);
      if (t.swap) {
        const nx = a.x - a.facing * 34;
        v.x = Math.max(e.bounds.left + 20, Math.min(e.bounds.right - 20, nx));
        a.facing = (a.facing * -1) as 1 | -1;
      }
      v.setState('thrown', 'juggle');
      v.stun = 30;
      v.vx = a.facing * t.kbx;
      v.vy = t.kby;
      v.juggleHits = 0;
      a.hitstop = 8;
      v.hitstop = 8;
      audio.play('hitHeavy');
      e.camera.addShake(5.6, e.settings.screenShake);
      e.fx.hit(v.x, v.y + 50, 'heavy', true, a.facing, false);
      e.fx.damage(v.x, v.y + 70, dmg, false);
      if (v.hp <= 0) {
        v.dead = true;
        v.setState('ko');
        beginKo(e);
      }
      e.onEvent('throwHit', { who: a.index, dmg });
    }

    if (a.throwFrame >= t.duration) {
      a.setState('idle');
      a.throwPartner = null;
      a.throwMove = null;
      if (v.throwPartner === a) {
        v.throwPartner = null;
        v.beingThrown = false;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// projectiles
// ---------------------------------------------------------------------------

function spawnProjectile(e: GameEngine, f: Fighter): void {
  if (f.state !== 'attack' || !f.move?.projectile) return;
  if (f.hitstop > 0 || f.freeze > 0) return;
  const p = f.move.projectile;
  if (f.moveFrame !== p.spawnFrame) return;
  e.projectiles.push(new Projectile(f, p));
  audio.play('special');
  e.fx.ring(f.x + f.facing * p.ox, f.y + p.oy, 'energy', 0.8);
}

function stepProjectiles(e: GameEngine): void {
  for (let i = e.projectiles.length - 1; i >= 0; i--) {
    const p = e.projectiles[i];
    if (p.owner.hitstop > 0 || p.owner.freeze > 0) continue;
    p.step();
    if (p.x < e.bounds.left - 70 || p.x > e.bounds.right + 70) p.dead = true;

    const target = p.owner === e.f1 ? e.f2 : e.f1;
    if (!p.dead && target.invulnFrames <= 0 && !target.dead) {
      if (overlaps(p.box, target.hurtbox)) {
        const c = boxCenter(p.box, target.hurtbox);
        const carrier = p.owner.move ?? p.owner.def.moves.l1;
        const evt = applyHit(p.owner, target, carrier, p.hit, c.x, c.y);
        onHit(e, evt);
        p.dead = true;
        if (evt.ko) beginKo(e);
      }
    }

    for (let j = i - 1; j >= 0; j--) {
      const q = e.projectiles[j];
      if (q.owner === p.owner) continue;
      if (overlaps(p.box, q.box)) {
        p.dead = true;
        q.dead = true;
        e.fx.ring((p.x + q.x) / 2, (p.y + q.y) / 2, 'energy', 1);
        audio.play('block');
      }
    }
    if (p.dead) e.projectiles.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// fx helpers
// ---------------------------------------------------------------------------

function movementFx(e: GameEngine, f: Fighter): void {
  if (f.hitstop > 0) return;
  if ((f.state === 'dash' || f.state === 'backdash') && f.stateFrame === 1) {
    audio.play('dash');
    e.fx.dust(f.x, f.y, f.state === 'dash' ? f.facing : -f.facing, 1.2);
  }
  if (f.state === 'dash' && f.stateFrame % 4 === 0) e.fx.dust(f.x, f.y, f.facing, 0.5);
  if (f.state === 'land' && f.stateFrame === 1) {
    audio.play('land');
    e.fx.land(f.x, f.y, false);
  }
  if (f.state === 'jumpsquat' && f.stateFrame === 1) audio.play('jump');
  if (f.state === 'knockdown' && f.stateFrame === 1) {
    e.fx.land(f.x, f.y, true);
    e.camera.addShake(3.4, e.settings.screenShake);
  }
  if (f.state === 'attack' && f.move?.kind === 'super' && f.moveFrame === 1) {
    e.fx.superFlash(f.x, f.y + 55, auraOf(f));
    audio.play('super');
    e.camera.addShake(6, e.settings.screenShake);
    e.fx.label(f.x, f.y + 150, f.move.name, auraOf(f), 13);
  }
  if (f.state === 'attack' && f.move?.kind === 'special' && f.moveFrame === 1) {
    audio.play('special');
  }
}

function spiritFx(e: GameEngine): void {
  for (const f of [e.f1, e.f2]) {
    if (f.spirit && e.frame % 5 === 0) e.fx.spiritAura(f.x, f.y + 20, auraOf(f));
    if (f.spiritFlash === 39) {
      audio.play('spirit');
      e.fx.label(f.x, f.y + 132, 'BAYANI SPIRIT', '#ffd83c', 12);
      e.onEvent('spirit', { who: f.index });
    }
  }
}

function auraOf(f: Fighter): string {
  return AURA[f.def.art.palette] ?? '#ffd24c';
}

const AURA: Record<string, string> = {
  lapulapu: '#ffb43c',
  rizal: '#7fd4ff',
  bonifacio: '#ff5a3c',
  gabriela: '#ff86b0',
  luna: '#ffd84c',
  sora: '#8cffc0',
  diego: '#6cd0ff',
  kudarat: '#d060ff',
  magbanua: '#ffd070',
  juanluna: '#ff9a4c',
  goyo: '#7cf0ff',
  anino: '#b04cff',
};

// ---------------------------------------------------------------------------
// training dummy
// ---------------------------------------------------------------------------

function dummyInput(e: GameEngine): Set<Btn> {
  const out = new Set<Btn>();
  const t = e.training;
  if (!t) return out;
  const d = e.f2;
  switch (t.dummy) {
    case 'crouch':
      out.add('down');
      break;
    case 'block':
      if (d.state === 'blockstun' || d.state === 'blockstunCrouch' || d.stun > 0) {
        out.add('block');
      }
      break;
    case 'blockAll':
      out.add('block');
      break;
    case 'counter':
      if (d.state === 'blockstun' || d.state === 'blockstunCrouch') out.add('block');
      else if (d.canAct && e.frame % 46 < 3) out.add('light');
      else out.add('block');
      break;
    case 'jump':
      if (!d.airborne && e.frame % 52 < 3) out.add('up');
      break;
    case 'record': {
      if (e.recordFrames.length) {
        const idx = e.playbackIndex % e.recordFrames.length;
        e.playbackIndex++;
        return new Set(e.recordFrames[idx]);
      }
      break;
    }
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// round resolution
// ---------------------------------------------------------------------------

function beginKo(e: GameEngine): void {
  if (e.phase === 'koFreeze' || e.phase === 'roundEnd' || e.phase === 'matchEnd') return;
  const loser = e.f1.hp <= 0 ? 0 : 1;
  const winner = (loser === 0 ? 1 : 0) as 0 | 1;
  e.roundWinner = winner;
  const w = winner === 0 ? e.f1 : e.f2;
  const l = winner === 0 ? e.f2 : e.f1;
  e.perfectRound = w.hp >= w.maxHp;
  l.dead = true;
  if (l.state !== 'ko') l.setState('ko');
  e.setPhase('koFreeze');
  e.slow = BALANCE.koSlowmoFrames;
  audio.play('ko');
  music.duck(true);
  e.camera.addShake(9, e.settings.screenShake);
  e.announceText('K.O.!', undefined, true, 92);
  e.onEvent('ko', { winner });
}

function finishRound(e: GameEngine, winner: 0 | 1 | null, timeout: boolean): void {
  e.roundWinner = winner;
  if (winner !== null) {
    e.wins[winner]++;
    const w = winner === 0 ? e.f1 : e.f2;
    const l = winner === 0 ? e.f2 : e.f1;
    if (e.perfectRound) w.stats.perfects++;
    w.won = true;
    w.setState('victory');
    if (!l.dead) {
      l.setState('knockdown');
      l.stun = 9999;
    }
  }
  e.setPhase('roundEnd');
  if (timeout) {
    e.announceText('TIME UP!', winner === null ? 'DRAW' : undefined, true, 92);
  } else if (e.perfectRound) {
    e.announceText('PERFECT!', undefined, true, 92);
  }
  audio.play('victory');
  e.onEvent('roundEnd', { winner, timeout });
}
