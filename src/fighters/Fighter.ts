// ============================================================================
// Fighter: state machine + physics + animation + attack execution.
// World space: x right, y UP, floor at y = 0. Origin is between the feet.
// ============================================================================

import type {
  AttackDef,
  Box,
  FighterDef,
  FighterStateName,
  Facing,
  BuffDef,
} from '../game/types';
import { BALANCE } from '../data/balance';
import { moveLength } from '../data/moveFactory';
import { InputBuffer } from '../input/InputBuffer';

export interface ActiveBuff extends BuffDef {
  left: number;
}

export class Fighter {
  def: FighterDef;
  /** 0 = player 1 (left), 1 = player 2 (right) */
  index: 0 | 1;
  input = new InputBuffer();

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: Facing = 1;

  hp: number;
  maxHp: number;
  meter = 0;

  state: FighterStateName = 'idle';
  stateFrame = 0;
  /** frames remaining in stun-like states */
  stun = 0;

  /** current attack */
  move: AttackDef | null = null;
  moveFrame = 0;
  /** hits of the current move that already connected */
  hitsUsed = new Set<number>();
  /** whether the current move has connected at all (for cancels) */
  moveConnected = false;
  /** id of the attack queued as a cancel */
  queued: string | null = null;
  /** armor/counter consumed this move */
  armorUsed = false;
  /** cooldowns by move id */
  cooldowns = new Map<string, number>();

  /** chain progress */
  chainIndex = 0;
  chainType: 'light' | 'heavy' | null = null;
  chainTimer = 0;

  /** animation */
  anim = 'idle';
  animFrame = 0;
  animSpeed = 1;
  animLock = 0;

  /** combo tracking as the VICTIM */
  comboHits = 0;
  comboTimer = 0;
  juggleHits = 0;
  airHitstun = 0;

  /** blocking */
  blocking = false;
  blockingLow = false;

  /** throw state */
  throwPartner: Fighter | null = null;
  throwFrame = 0;
  throwEscapeMash = 0;
  beingThrown = false;
  throwMove: AttackDef | null = null;

  /** counter stance */
  counterActive = false;
  counterRiposte: string | null = null;

  /** buffs */
  buffs: ActiveBuff[] = [];

  /** hitstop freeze (shared) */
  hitstop = 0;
  /** super freeze */
  freeze = 0;

  /** flags */
  invulnFrames = 0;
  spirit = false;
  spiritFlash = 0;
  won = false;
  dead = false;
  /** flash timer when hit */
  flash = 0;
  /** cumulative facing lock during moves */
  facingLocked = false;

  /** training / debug */
  infiniteHp = false;
  infiniteMeter = false;

  /** stats for the results screen */
  stats = {
    damageDealt: 0,
    longestCombo: 0,
    counters: 0,
    throws: 0,
    blocks: 0,
    specials: 0,
    supers: 0,
    perfects: 0,
  };

  constructor(def: FighterDef, index: 0 | 1) {
    this.def = def;
    this.index = index;
    this.maxHp = def.physics.maxHp;
    this.hp = this.maxHp;
    this.facing = index === 0 ? 1 : -1;
  }

  // ---- helpers ------------------------------------------------------------

  get phys() {
    return this.def.physics;
  }

  get airborne(): boolean {
    return this.y > 0.01;
  }

  get crouching(): boolean {
    return (
      this.state === 'crouch' ||
      this.state === 'blockCrouch' ||
      this.state === 'blockstunCrouch' ||
      this.state === 'hitstunCrouch' ||
      (this.state === 'attack' && !!this.move?.crouchOnly)
    );
  }

  get busy(): boolean {
    return (
      this.state === 'attack' ||
      this.state === 'hitstun' ||
      this.state === 'hitstunCrouch' ||
      this.state === 'blockstun' ||
      this.state === 'blockstunCrouch' ||
      this.state === 'juggle' ||
      this.state === 'knockdown' ||
      this.state === 'wakeup' ||
      this.state === 'grabAttempt' ||
      this.state === 'grabbing' ||
      this.state === 'grabbed' ||
      this.state === 'thrown' ||
      this.state === 'ko' ||
      this.state === 'victory' ||
      this.state === 'stance' ||
      this.state === 'intro'
    );
  }

  get canAct(): boolean {
    if (this.dead || this.won) return false;
    if (this.hitstop > 0 || this.freeze > 0) return false;
    switch (this.state) {
      case 'idle':
      case 'walkF':
      case 'walkB':
      case 'crouch':
      case 'blockStand':
      case 'blockCrouch':
      case 'air':
      case 'dash':
      case 'backdash':
        return true;
      case 'attack':
        return false;
      default:
        return false;
    }
  }

  get hurtbox(): Box {
    const w = BALANCE.pushboxW + 8;
    let h = BALANCE.pushboxH;
    let yOff = 0;
    if (this.crouching) h = BALANCE.pushboxH * 0.62;
    if (this.state === 'knockdown' || this.state === 'ko') {
      h = BALANCE.pushboxH * 0.34;
    }
    if (this.state === 'juggle') h = BALANCE.pushboxH * 0.8;
    // slight forward bias so the hurtbox tracks the lean
    return {
      x: this.x - w / 2 + this.facing * 2,
      y: this.y + yOff,
      w,
      h,
    };
  }

  get pushbox(): Box {
    const w = BALANCE.pushboxW * (this.def.physics.weight > 1.2 ? 1.15 : 1);
    const h = this.crouching ? BALANCE.pushboxH * 0.66 : BALANCE.pushboxH;
    return { x: this.x - w / 2, y: this.y, w, h };
  }

  /** convert a move-local box into world space */
  worldBox(b: Box): Box {
    const x = this.facing === 1 ? this.x + b.x : this.x - b.x - b.w;
    return { x, y: this.y + b.y, w: b.w, h: b.h };
  }

  // ---- state transitions --------------------------------------------------

  setState(s: FighterStateName, animOverride?: string): void {
    if (this.state === s && s !== 'attack') return;
    this.state = s;
    this.stateFrame = 0;
    const anim = animOverride ?? DEFAULT_ANIM[s] ?? 'idle';
    this.setAnim(anim);
  }

  setAnim(a: string, restart = true): void {
    if (this.anim === a && !restart) return;
    this.anim = a;
    this.animFrame = 0;
  }

  // ---- attacks ------------------------------------------------------------

  canUse(id: string): boolean {
    const m = this.def.moves[id];
    if (!m) return false;
    if ((this.cooldowns.get(id) ?? 0) > 0) return false;
    if (m.meterCost && !this.infiniteMeter && this.meter < m.meterCost) return false;
    if (m.requiresSpirit && !this.spirit) return false;
    if (m.airOnly && !this.airborne) return false;
    if (!m.airOK && !m.airOnly && this.airborne) return false;
    if (m.crouchOnly && !this.crouching && !this.airborne) {
      // allow it: pressing down+button implies crouch; the controller handles it
    }
    return true;
  }

  startMove(id: string): boolean {
    const m = this.def.moves[id];
    if (!m) return false;
    if (m.meterCost && !this.infiniteMeter) {
      this.meter = Math.max(0, this.meter - m.meterCost);
    }
    if (m.cooldown) this.cooldowns.set(id, m.cooldown);
    this.move = m;
    this.moveFrame = 0;
    this.hitsUsed.clear();
    this.moveConnected = false;
    this.queued = null;
    this.armorUsed = false;
    this.counterActive = false;
    this.counterRiposte = null;
    this.state = 'attack';
    this.stateFrame = 0;
    this.setAnim(m.anim);
    this.animSpeed = 1;
    if (m.freeze) this.freeze = m.freeze;
    if (m.kind === 'special') this.stats.specials++;
    if (m.kind === 'super') this.stats.supers++;
    if (m.heal) {
      this.hp = Math.min(this.maxHp, this.hp + m.heal);
    }
    if (m.buff) this.applyBuff(m.buff);
    if (m.invuln) this.invulnFrames = 0;
    this.blocking = false;
    this.blockingLow = false;
    return true;
  }

  applyBuff(b: BuffDef): void {
    const existing = this.buffs.find((x) => x.label === b.label);
    if (existing) existing.left = b.duration;
    else this.buffs.push({ ...b, left: b.duration });
  }

  get buffDamage(): number {
    let m = 1;
    for (const b of this.buffs) if (b.damageMul) m *= b.damageMul;
    if (this.spirit) m *= BALANCE.spiritDamageMul;
    return m;
  }

  get buffDefense(): number {
    let m = 1;
    for (const b of this.buffs) if (b.defenseMul) m *= b.defenseMul;
    if (this.spirit) m *= BALANCE.spiritDefenseMul;
    return m;
  }

  get buffSpeed(): number {
    let m = 1;
    for (const b of this.buffs) if (b.speedMul) m *= b.speedMul;
    return m;
  }

  get buffMeter(): number {
    let m = 1;
    for (const b of this.buffs) if (b.meterMul) m *= b.meterMul;
    if (this.spirit) m *= BALANCE.spiritMeterMul;
    return m;
  }

  get hasArmorBuff(): boolean {
    return this.buffs.some((b) => b.armor);
  }

  get activeBuffLabel(): string | null {
    const b = this.buffs.find((x) => x.label);
    return b ? b.label : null;
  }

  /** frame phase of the current move */
  get phase(): 'startup' | 'active' | 'recovery' | 'none' {
    const m = this.move;
    if (!m) return 'none';
    if (this.moveFrame < m.startup) return 'startup';
    if (this.moveFrame < m.startup + m.active) return 'active';
    return 'recovery';
  }

  get moveDone(): boolean {
    return !this.move || this.moveFrame >= moveLength(this.move);
  }

  addMeter(amount: number): void {
    if (this.infiniteMeter) {
      this.meter = BALANCE.meterMax;
      return;
    }
    this.meter = Math.min(BALANCE.meterMax, this.meter + amount * this.buffMeter);
  }

  get meterBars(): number {
    return Math.floor(this.meter / BALANCE.meterBar);
  }

  get canSuper(): boolean {
    return this.infiniteMeter || this.meter >= BALANCE.meterBar;
  }

  updateSpirit(): void {
    const should = this.hp / this.maxHp <= BALANCE.spiritThreshold && this.hp > 0;
    if (should && !this.spirit) {
      this.spirit = true;
      this.spiritFlash = 40;
    } else if (!should && this.spirit) {
      this.spirit = false;
    }
  }

  reset(x: number, facing: Facing, keepStats = true): void {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.stateFrame = 0;
    this.stun = 0;
    this.move = null;
    this.moveFrame = 0;
    this.hitsUsed.clear();
    this.queued = null;
    this.chainIndex = 0;
    this.chainType = null;
    this.chainTimer = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.juggleHits = 0;
    this.airHitstun = 0;
    this.blocking = false;
    this.blockingLow = false;
    this.throwPartner = null;
    this.beingThrown = false;
    this.throwMove = null;
    this.counterActive = false;
    this.buffs.length = 0;
    this.hitstop = 0;
    this.freeze = 0;
    this.invulnFrames = 0;
    this.spirit = false;
    this.spiritFlash = 0;
    this.won = false;
    this.dead = false;
    this.flash = 0;
    this.cooldowns.clear();
    this.input.reset();
    this.setAnim('idle');
    if (!keepStats) {
      this.stats = {
        damageDealt: 0,
        longestCombo: 0,
        counters: 0,
        throws: 0,
        blocks: 0,
        specials: 0,
        supers: 0,
        perfects: 0,
      };
    }
  }
}

export const DEFAULT_ANIM: Partial<Record<FighterStateName, string>> = {
  intro: 'intro',
  idle: 'idle',
  walkF: 'walkF',
  walkB: 'walkB',
  dash: 'dash',
  backdash: 'backdash',
  crouch: 'crouch',
  jumpsquat: 'jumpsquat',
  air: 'air',
  land: 'land',
  blockStand: 'block',
  blockCrouch: 'blockCrouch',
  blockstun: 'block',
  blockstunCrouch: 'blockCrouch',
  hitstun: 'hitHigh',
  hitstunCrouch: 'hitLow',
  juggle: 'juggle',
  knockdown: 'knockdown',
  wakeup: 'wakeup',
  grabAttempt: 'grab',
  grabbing: 'throwAnim',
  grabbed: 'grabbed',
  thrown: 'juggle',
  techBreak: 'backdash',
  stance: 'stance',
  ko: 'ko',
  victory: 'victory',
  timeout: 'idle',
};
