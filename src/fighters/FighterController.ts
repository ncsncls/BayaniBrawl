// ============================================================================
// FighterController: turns buffered input into state changes.
// This is the movement + action feel layer. Everything here is frame-based.
// ============================================================================

import { Fighter } from './Fighter';
import { BALANCE } from '../data/balance';
import { MOTIONS, type Btn, type Dir } from '../input/InputBuffer';
import type { AttackDef } from '../game/types';

export interface SpecialBinding {
  id: string;
  motion: Dir[];
  btn: Btn;
  /** the direction hint used by simplified (touch / CPU) input */
  hint: Dir | null;
  /** higher priority is tested first */
  prio: number;
}

/**
 * Build the special-move input table for a fighter from each move's notation.
 * Notation strings are authored in the fighter data; we parse them so the
 * move list and the actual inputs can never drift apart.
 */
export function bindingsFor(f: Fighter): SpecialBinding[] {
  const out: SpecialBinding[] = [];
  for (const [id, m] of Object.entries(f.def.moves)) {
    if (m.kind !== 'special' && m.kind !== 'super') continue;
    const b = parseNotation(id, m);
    if (b) out.push(b);
  }
  // supers first, then longer motions, then buttons
  out.sort((a, b) => b.prio - a.prio || b.motion.length - a.motion.length);
  return out;
}

function parseNotation(id: string, m: AttackDef): SpecialBinding | null {
  const n = m.notation.toUpperCase();
  let btn: Btn = 'special';
  if (n.includes('SUPER')) btn = 'super';
  else if (n.includes('LIGHT')) btn = 'light';
  else if (n.includes('HEAVY')) btn = 'heavy';
  else if (n.includes('GRAB')) btn = 'grab';
  else if (n.includes('SPECIAL')) btn = 'special';

  let motion: Dir[] = [];
  let hint: Dir | null = null;
  if (n.includes('DOWN, FORWARD, DOWN, FORWARD')) {
    motion = MOTIONS.superM;
    hint = null;
  } else if (n.includes('DOWN, FORWARD')) {
    motion = MOTIONS.df;
    hint = 'df';
  } else if (n.includes('DOWN, BACK')) {
    motion = MOTIONS.db;
    hint = 'db';
  } else if (n.includes('FORWARD, DOWN')) {
    motion = MOTIONS.fd;
    hint = 'df';
  } else if (n.includes('FORWARD, FORWARD')) {
    motion = MOTIONS.ff;
    hint = 'f';
  } else if (n.includes('BACK, BACK')) {
    motion = MOTIONS.bb;
    hint = 'b';
  } else if (n.includes('DOWN, DOWN')) {
    motion = MOTIONS.dd;
    hint = 'd';
  }

  const prio = m.kind === 'super' ? 100 : motion.length * 10;
  return { id, motion, btn, hint, prio };
}

export interface ControlOpts {
  /** disable jumping etc for cinematic states */
  frozen?: boolean;
  /**
   * Simplified special inputs: holding the hint direction + the button is
   * enough, no motion required. Used for touch controls and the CPU, and
   * available to keyboard players as an accessibility setting.
   */
  simpleSpecials?: boolean;
}

export class FighterController {
  bindings: SpecialBinding[];
  /** simplified special input mode (touch / CPU / accessibility) */
  simple = false;

  constructor(public f: Fighter) {
    this.bindings = bindingsFor(f);
  }

  refresh(): void {
    this.bindings = bindingsFor(this.f);
  }

  /** does the current directional state satisfy a binding's hint? */
  private hintOk(b: SpecialBinding): boolean {
    const f = this.f;
    const inp = f.input;
    if (b.hint === null) return true;
    const d = inp.dirFor(f.facing);
    switch (b.hint) {
      case 'df':
        return d === 'df' || (inp.isHeld('down') && inp.axis(f.facing) > 0.2);
      case 'db':
        return d === 'db' || (inp.isHeld('down') && inp.axis(f.facing) < -0.2);
      case 'd':
        return inp.isHeld('down');
      case 'f':
        return inp.axis(f.facing) > 0.2;
      case 'b':
        return inp.axis(f.facing) < -0.2;
      default:
        return d === b.hint;
    }
  }

  /**
   * Whether a hint may substitute for the full motion. Down-based hints are
   * unambiguous (nothing else uses down + attack), so keyboard players get
   * them for free. Pure forward/back hints would collide with the overhead
   * and walk-back, so those still require a real double tap unless the
   * player is on simplified (touch) input.
   */
  private hintAllowed(b: SpecialBinding): boolean {
    if (this.simple) return true;
    return b.hint === 'df' || b.hint === 'db' || b.hint === 'd';
  }

  /**
   * Run one frame of control logic. Returns an optional event for the engine
   * (e.g. 'throwAttempt') so combat systems stay in one place.
   */
  step(opts: ControlOpts = {}): string | null {
    const f = this.f;
    const inp = f.input;
    this.simple = !!opts.simpleSpecials;

    // cooldown ticks
    for (const [k, v] of f.cooldowns) {
      if (v > 0) f.cooldowns.set(k, v - 1);
    }

    if (f.hitstop > 0 || f.freeze > 0) return null;
    if (f.dead || f.won) return null;

    // ---- queued cancels during an attack ---------------------------------
    if (f.state === 'attack' && f.move) {
      this.tryQueueCancel();
      return null;
    }

    if (!f.canAct) return null;
    if (opts.frozen) return null;

    // ---- specials / supers ----------------------------------------------
    const sp = this.trySpecial();
    if (sp) return null;

    // ---- throw -----------------------------------------------------------
    if (inp.has('grab') && !f.airborne) {
      inp.consume('grab');
      return 'throwAttempt';
    }

    // ---- attacks ---------------------------------------------------------
    if (this.tryNormal()) return null;

    // ---- movement --------------------------------------------------------
    this.movement();
    return null;
  }

  // ------------------------------------------------------------------------

  private trySpecial(): boolean {
    const f = this.f;
    const inp = f.input;
    for (const b of this.bindings) {
      if (!inp.has(b.btn)) continue;
      const m = f.def.moves[b.id];
      if (!m) continue;
      if (m.airOnly && !f.airborne) continue;
      if (!m.airOnly && !m.airOK && f.airborne) continue;
      if (b.motion.length) {
        const ok =
          inp.motionMatch(b.motion) || (this.hintAllowed(b) && this.hintOk(b));
        if (!ok) continue;
      }
      if (!f.canUse(b.id)) continue;
      inp.consume(b.btn);
      f.startMove(b.id);
      return true;
    }
    // bare SUPER button with meter (accessibility: no motion required)
    if (inp.has('super') && f.canSuper) {
      const id = f.spirit && f.def.ultimate ? f.def.ultimate : f.def.super;
      if (f.canUse(id) && !f.airborne) {
        inp.consume('super');
        f.startMove(id);
        return true;
      }
    }
    return false;
  }

  private tryNormal(): boolean {
    const f = this.f;
    const inp = f.input;
    const down = inp.isHeld('down');
    const fwd = inp.axis(f.facing) > 0.2;

    if (f.airborne) {
      if (inp.has('heavy') && f.canUse('airH')) {
        inp.consume('heavy');
        f.startMove('airH');
        return true;
      }
      if (inp.has('light') && f.canUse('airL')) {
        inp.consume('light');
        f.startMove('airL');
        return true;
      }
      return false;
    }

    // launcher: up + heavy
    if (inp.isHeld('up') && inp.has('heavy') && f.canUse('launch')) {
      inp.consume('heavy');
      f.startMove('launch');
      f.chainType = null;
      f.chainIndex = 0;
      return true;
    }

    if (inp.has('heavy')) {
      if (down && f.canUse('sweep')) {
        inp.consume('heavy');
        f.startMove('sweep');
        return true;
      }
      if (fwd && f.canUse('over')) {
        inp.consume('heavy');
        f.startMove('over');
        return true;
      }
      const id = this.nextChain('heavy');
      if (id && f.canUse(id)) {
        inp.consume('heavy');
        f.startMove(id);
        return true;
      }
    }

    if (inp.has('light')) {
      if (down && f.canUse('cl')) {
        inp.consume('light');
        f.startMove('cl');
        return true;
      }
      const id = this.nextChain('light');
      if (id && f.canUse(id)) {
        inp.consume('light');
        f.startMove(id);
        return true;
      }
    }

    return false;
  }

  /** advance the chain counter and return the move id to use */
  private nextChain(type: 'light' | 'heavy'): string | null {
    const f = this.f;
    const chain = f.def.chains[type];
    if (!chain.length) return null;
    if (f.chainType !== type || f.chainTimer <= 0) {
      f.chainType = type;
      f.chainIndex = 0;
    }
    const id = chain[Math.min(f.chainIndex, chain.length - 1)];
    f.chainIndex = Math.min(f.chainIndex + 1, chain.length);
    f.chainTimer = 40;
    return id;
  }

  /** During an attack, buffer the next move if it is a legal cancel. */
  private tryQueueCancel(): void {
    const f = this.f;
    const m = f.move!;
    const inp = f.input;
    if (f.queued) return;
    const canCancelNow = f.moveFrame >= (m.cancelFrom ?? m.startup);
    if (!canCancelNow) return;
    // most cancels require the move to have connected (hit or blocked)
    const needsConnect = !m.whiffCancel && m.kind !== 'special';
    if (needsConnect && !f.moveConnected && m.kind === 'normal') {
      // normals may still chain into the next normal on whiff for feel,
      // but only within the light chain (classic "rekka" feel is limited)
      if (!f.moveConnected && f.moveFrame < m.startup + m.active) return;
    }
    const list = m.cancels ?? [];

    // super cancel is always allowed if listed
    if (list.includes('super') && inp.has('super') && f.canSuper) {
      const sid = f.spirit && f.def.ultimate ? f.def.ultimate : f.def.super;
      if (f.canUse(sid)) {
        inp.consume('super');
        f.queued = sid;
        return;
      }
    }

    // special cancels
    for (const b of this.bindings) {
      if (!list.includes(b.id)) continue;
      if (!inp.has(b.btn)) continue;
      if (b.motion.length) {
        const ok =
          inp.motionMatch(b.motion) || (this.hintAllowed(b) && this.hintOk(b));
        if (!ok) continue;
      }
      const mm = f.def.moves[b.id];
      if (!mm) continue;
      if (mm.airOnly && !f.airborne) continue;
      if (!mm.airOnly && !mm.airOK && f.airborne) continue;
      if (!f.canUse(b.id)) continue;
      inp.consume(b.btn);
      f.queued = b.id;
      return;
    }

    const down = inp.isHeld('down');
    const fwd = inp.axis(f.facing) > 0.2;
    const up = inp.isHeld('up');

    // normal cancels
    if (inp.has('heavy')) {
      const cands = up
        ? ['launch', 'h1', 'h2']
        : down
          ? ['sweep', 'h1', 'h2']
          : fwd
            ? ['over', 'h1', 'h2']
            : ['h1', 'h2', 'launch'];
      for (const id of cands) {
        if (!list.includes(id)) continue;
        if (!f.canUse(id)) continue;
        if (f.airborne && !f.def.moves[id].airOnly) continue;
        inp.consume('heavy');
        f.queued = id;
        return;
      }
    }
    if (inp.has('light')) {
      const cands = down ? ['cl', 'l1', 'l2', 'l3'] : ['l1', 'l2', 'l3', 'cl'];
      // chain order: prefer the next chain step
      const chain = f.def.chains.light;
      const nextInChain = chain[Math.min(f.chainIndex, chain.length - 1)];
      const ordered = [nextInChain, ...cands.filter((c) => c !== nextInChain)];
      for (const id of ordered) {
        if (!list.includes(id)) continue;
        if (!f.canUse(id)) continue;
        if (f.airborne && !f.def.moves[id].airOnly) continue;
        inp.consume('light');
        f.queued = id;
        if (chain.includes(id)) {
          f.chainType = 'light';
          f.chainIndex = chain.indexOf(id) + 1;
          f.chainTimer = 40;
        }
        return;
      }
    }
    if (inp.has('grab') && list.includes('throwF')) {
      inp.consume('grab');
      f.queued = 'throwF';
    }
  }

  // ------------------------------------------------------------------------

  private movement(): void {
    const f = this.f;
    const inp = f.input;
    const p = f.phys;
    const speedMul = f.buffSpeed;

    if (f.airborne) {
      f.setState('air');
      return;
    }

    // jump
    if (inp.isHeld('up')) {
      f.setState('jumpsquat');
      return;
    }

    // dashes
    if (inp.doubleTap('f')) {
      f.setState('dash');
      f.vx = f.facing * p.dashSpeed * speedMul;
      return;
    }
    if (inp.doubleTap('b')) {
      f.setState('backdash');
      f.vx = -f.facing * p.backdashSpeed;
      f.invulnFrames = 4;
      return;
    }

    const holdBlock = inp.isHeld('block');
    const down = inp.isHeld('down');
    const ax = inp.axis(f.facing);

    if (holdBlock) {
      f.blocking = true;
      f.blockingLow = down;
      f.setState(down ? 'blockCrouch' : 'blockStand');
      f.vx = 0;
      return;
    }
    f.blocking = false;
    f.blockingLow = false;

    if (down) {
      f.setState('crouch');
      f.vx = 0;
      return;
    }

    if (ax > 0.2) {
      f.setState('walkF');
      f.vx = p.walkF * speedMul * f.facing;
    } else if (ax < -0.2) {
      f.setState('walkB');
      f.vx = -p.walkB * f.facing;
    } else {
      f.setState('idle');
      f.vx = 0;
    }
  }
}
