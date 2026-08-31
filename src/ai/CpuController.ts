// ============================================================================
// CPU controller.
// ----------------------------------------------------------------------------
// DESIGN RULE: the AI never reads the player's buffered inputs. It only sees
// what a human could see - the opponent's current state, animation frame,
// position and health - and it must wait `reaction` frames before responding
// to a change. Difficulty tunes reaction, blocking rate, combo length and
// spacing skill; it never grants frame-perfect reversals.
// ============================================================================

import { Fighter } from '../fighters/Fighter';
import { DIFFICULTY_TUNING, BALANCE, type DifficultyTuning } from '../data/balance';
import type { AiProfileName, Difficulty, FighterStateName } from '../game/types';
import type { Btn } from '../input/InputBuffer';

export interface AiPersona {
  /** preferred distance to hover at, in world units */
  idealRange: number;
  /** 0..1 how much it wants to be in your face */
  aggression: number;
  /** 0..1 tendency to hold block when unsure */
  turtle: number;
  /** 0..1 tendency to use counter stances */
  counterLove: number;
  /** 0..1 tendency to throw when close */
  throwLove: number;
  /** 0..1 tendency to jump in */
  jumpLove: number;
  /** 0..1 tendency to use projectiles / keepaway */
  zoneLove: number;
  /** 0..1 tendency to use command grabs / armor moves */
  armorLove: number;
  /** frames between decisions */
  think: number;
}

export const PERSONAS: Record<AiProfileName, AiPersona> = {
  aggressive: {
    idealRange: 58,
    aggression: 0.86,
    turtle: 0.18,
    counterLove: 0.22,
    throwLove: 0.3,
    jumpLove: 0.24,
    zoneLove: 0.05,
    armorLove: 0.42,
    think: 10,
  },
  tactical: {
    idealRange: 96,
    aggression: 0.48,
    turtle: 0.52,
    counterLove: 0.5,
    throwLove: 0.22,
    jumpLove: 0.1,
    zoneLove: 0.2,
    armorLove: 0.2,
    think: 14,
  },
  counter: {
    idealRange: 88,
    aggression: 0.42,
    turtle: 0.48,
    counterLove: 0.72,
    throwLove: 0.2,
    jumpLove: 0.16,
    zoneLove: 0.34,
    armorLove: 0.12,
    think: 12,
  },
  pressure: {
    idealRange: 48,
    aggression: 0.95,
    turtle: 0.12,
    counterLove: 0.1,
    throwLove: 0.38,
    jumpLove: 0.3,
    zoneLove: 0.02,
    armorLove: 0.2,
    think: 8,
  },
  mobile: {
    idealRange: 72,
    aggression: 0.7,
    turtle: 0.24,
    counterLove: 0.18,
    throwLove: 0.24,
    jumpLove: 0.56,
    zoneLove: 0.1,
    armorLove: 0.1,
    think: 9,
  },
  juggernaut: {
    idealRange: 44,
    aggression: 0.62,
    turtle: 0.44,
    counterLove: 0.1,
    throwLove: 0.62,
    jumpLove: 0.04,
    zoneLove: 0.02,
    armorLove: 0.72,
    think: 15,
  },
  zoner: {
    idealRange: 128,
    aggression: 0.3,
    turtle: 0.6,
    counterLove: 0.4,
    throwLove: 0.14,
    jumpLove: 0.08,
    zoneLove: 0.82,
    armorLove: 0.36,
    think: 14,
  },
  balanced: {
    idealRange: 74,
    aggression: 0.6,
    turtle: 0.36,
    counterLove: 0.34,
    throwLove: 0.26,
    jumpLove: 0.22,
    zoneLove: 0.12,
    armorLove: 0.2,
    think: 11,
  },
  trickster: {
    idealRange: 92,
    aggression: 0.56,
    turtle: 0.3,
    counterLove: 0.44,
    throwLove: 0.3,
    jumpLove: 0.34,
    zoneLove: 0.5,
    armorLove: 0.12,
    think: 10,
  },
  boss: {
    idealRange: 70,
    aggression: 0.8,
    turtle: 0.4,
    counterLove: 0.3,
    throwLove: 0.34,
    jumpLove: 0.26,
    zoneLove: 0.4,
    armorLove: 0.5,
    think: 9,
  },
};

type Plan =
  | { kind: 'approach' }
  | { kind: 'retreat' }
  | { kind: 'hover' }
  | { kind: 'block'; low: boolean; frames: number }
  | { kind: 'attack'; ids: string[]; step: number }
  | { kind: 'throw' }
  | { kind: 'jumpIn' }
  | { kind: 'special'; id: string }
  | { kind: 'super' }
  | { kind: 'wait'; frames: number };

export class CpuController {
  private persona: AiPersona;
  private tune: DifficultyTuning;
  private plan: Plan = { kind: 'hover' };
  private planAge = 0;
  private thinkTimer = 0;
  /** delayed perception of the opponent */
  private seenState: FighterStateName = 'idle';
  private seenFrame = 0;
  private reactionQueue: Array<{ state: FighterStateName; frame: number; delay: number }> = [];
  private held = new Set<Btn>();
  /** frames until the AI is allowed to press an attack again */
  private attackCooldown = 0;
  private jumpCooldown = 0;
  private throwCooldown = 0;
  private specialCooldown = 0;
  private rng: () => number;
  /** phase 2 for the boss */
  phase = 1;

  constructor(
    public f: Fighter,
    public opp: Fighter,
    profile: AiProfileName,
    public difficulty: Difficulty,
    seed = 12345,
  ) {
    this.persona = PERSONAS[profile] ?? PERSONAS.balanced;
    this.tune = DIFFICULTY_TUNING[difficulty];
    let s = seed >>> 0;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    this.tune = DIFFICULTY_TUNING[d];
  }

  /** Produce this frame's virtual button state. */
  step(): Set<Btn> {
    const f = this.f;
    const o = this.opp;
    this.held.clear();

    if (f.dead || f.won || o.dead) return this.held;

    // boss phase transition
    if (f.def.boss && this.phase === 1 && f.hp / f.maxHp < 0.5) {
      this.phase = 2;
      this.persona = { ...this.persona, zoneLove: 0.62, aggression: 0.9, think: 8 };
    }

    // ---- perception with reaction delay ---------------------------------
    this.pushPerception();

    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (this.throwCooldown > 0) this.throwCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;

    if (f.hitstop > 0 || f.freeze > 0) return this.held;

    // ---- forced states ---------------------------------------------------
    if (f.state === 'grabbed') {
      // mash grab to escape, at a rate set by difficulty
      if (this.rng() < this.tune.techChance) this.held.add('grab');
      return this.held;
    }
    if (
      f.state === 'hitstun' ||
      f.state === 'hitstunCrouch' ||
      f.state === 'juggle' ||
      f.state === 'thrown' ||
      f.state === 'blockstun' ||
      f.state === 'blockstunCrouch'
    ) {
      // hold block out of blockstun if it likes to block
      if (
        (f.state === 'blockstun' || f.state === 'blockstunCrouch') &&
        this.rng() < this.tune.blockChance
      ) {
        this.held.add('block');
        if (f.state === 'blockstunCrouch') this.held.add('down');
      }
      return this.held;
    }
    if (f.state === 'knockdown') {
      // sometimes quick-rise
      if (this.rng() < 0.4 + this.tune.punishChance * 0.4) this.held.add('block');
      return this.held;
    }
    if (f.state === 'attack' || f.state === 'grabbing' || f.state === 'wakeup') {
      // continue combo strings by feeding the next input during the attack
      if (this.plan.kind === 'attack') this.feedCombo();
      return this.held;
    }

    // ---- decide ----------------------------------------------------------
    this.thinkTimer--;
    this.planAge++;
    if (this.thinkTimer <= 0 || this.planExpired()) {
      this.decide();
      this.thinkTimer = Math.max(4, this.persona.think + Math.floor(this.rng() * 6) - 3);
      this.planAge = 0;
    }

    this.execute();
    return this.held;
  }

  // ---- perception --------------------------------------------------------

  private pushPerception(): void {
    const o = this.opp;
    const delay = Math.max(
      BALANCE.cpuMinReaction,
      this.tune.reaction + Math.floor(this.rng() * 5) - 2,
    );
    this.reactionQueue.push({ state: o.state, frame: o.moveFrame, delay });
    if (this.reactionQueue.length > 90) this.reactionQueue.shift();
    for (const q of this.reactionQueue) q.delay--;
    while (this.reactionQueue.length && this.reactionQueue[0].delay <= 0) {
      const q = this.reactionQueue.shift()!;
      this.seenState = q.state;
      this.seenFrame = q.frame;
    }
  }

  private get dist(): number {
    return Math.abs(this.opp.x - this.f.x);
  }

  private get towardOpp(): Btn {
    return this.opp.x > this.f.x ? 'right' : 'left';
  }

  private get awayFromOpp(): Btn {
    return this.opp.x > this.f.x ? 'left' : 'right';
  }

  /** does the perceived state look like an incoming attack? */
  private get threat(): boolean {
    return this.seenState === 'attack';
  }

  private planExpired(): boolean {
    switch (this.plan.kind) {
      case 'block':
        return this.planAge >= this.plan.frames;
      case 'wait':
        return this.planAge >= this.plan.frames;
      case 'attack':
        return this.plan.step >= this.plan.ids.length;
      default:
        return this.planAge > 40;
    }
  }

  // ---- decision making ---------------------------------------------------

  private decide(): void {
    const f = this.f;
    const o = this.opp;
    const d = this.dist;
    const p = this.persona;
    const t = this.tune;
    const r = this.rng;
    const hpRatio = f.hp / f.maxHp;
    const oppHpRatio = o.hp / o.maxHp;

    // panic block when a threat is perceived and it can block
    if (this.threat && d < 140 && r() < t.blockChance) {
      const low = r() < 0.45;
      this.plan = { kind: 'block', low, frames: 14 + Math.floor(r() * 14) };
      return;
    }

    // anti-air
    if (o.airborne && d < 96 && r() < t.antiAir) {
      const aa = this.pickAntiAir();
      if (aa) {
        this.plan = { kind: 'special', id: aa };
        return;
      }
    }

    // super when meter is full and the opponent is vulnerable-ish
    if (
      f.canSuper &&
      f.meter >= BALANCE.meterBar &&
      d < 110 &&
      r() < t.superChance * (oppHpRatio < 0.35 ? 1.4 : 0.7)
    ) {
      this.plan = { kind: 'super' };
      return;
    }

    // punish a whiffed / recovering move
    if (
      this.seenState === 'attack' &&
      this.seenFrame > 0 &&
      d < 84 &&
      r() < t.punishChance
    ) {
      this.plan = { kind: 'attack', ids: this.comboString(), step: 0 };
      return;
    }

    // zoning
    if (p.zoneLove > 0.3 && d > 130 && r() < p.zoneLove * (0.5 + t.spacingSkill * 0.5)) {
      const proj = this.pickProjectile();
      if (proj && this.specialCooldown <= 0) {
        this.plan = { kind: 'special', id: proj };
        this.specialCooldown = 28 + Math.floor(r() * 40);
        return;
      }
    }

    // defensive turtling when low
    if (hpRatio < 0.22 && r() < p.turtle * 0.7) {
      this.plan = { kind: 'block', low: r() < 0.5, frames: 20 + Math.floor(r() * 20) };
      return;
    }

    // close range decisions
    if (d < 62) {
      if (this.throwCooldown <= 0 && r() < p.throwLove * (0.4 + t.punishChance)) {
        this.plan = { kind: 'throw' };
        this.throwCooldown = 60 + Math.floor(r() * 70);
        return;
      }
      if (r() < p.aggression * t.aggression + 0.15) {
        this.plan = { kind: 'attack', ids: this.comboString(), step: 0 };
        return;
      }
      if (r() < p.turtle) {
        this.plan = { kind: 'block', low: r() < 0.5, frames: 16 };
        return;
      }
      this.plan = { kind: 'retreat' };
      return;
    }

    // mid range
    if (d < 130) {
      if (r() < p.counterLove * t.spacingSkill && this.specialCooldown <= 0) {
        const c = this.pickCounter();
        if (c) {
          this.plan = { kind: 'special', id: c };
          this.specialCooldown = 50 + Math.floor(r() * 50);
          return;
        }
      }
      if (r() < p.aggression * t.aggression) {
        // approach with a rushing special sometimes
        if (this.specialCooldown <= 0 && r() < t.specialChance) {
          const rush = this.pickRush();
          if (rush) {
            this.plan = { kind: 'special', id: rush };
            this.specialCooldown = 34 + Math.floor(r() * 40);
            return;
          }
        }
        this.plan = { kind: 'approach' };
        return;
      }
      if (r() < p.jumpLove * 0.6 && this.jumpCooldown <= 0) {
        this.plan = { kind: 'jumpIn' };
        this.jumpCooldown = 60;
        return;
      }
      this.plan = { kind: 'hover' };
      return;
    }

    // far
    if (d > p.idealRange + 40) {
      if (r() < p.jumpLove * 0.5 && this.jumpCooldown <= 0) {
        this.plan = { kind: 'jumpIn' };
        this.jumpCooldown = 70;
        return;
      }
      this.plan = { kind: 'approach' };
      return;
    }
    this.plan = { kind: 'hover' };
  }

  // ---- execution ---------------------------------------------------------

  private execute(): void {
    const f = this.f;
    const d = this.dist;
    const p = this.persona;

    switch (this.plan.kind) {
      case 'approach': {
        this.held.add(this.towardOpp);
        // occasional dash
        if (d > 120 && this.planAge % 18 === 0 && this.rng() < 0.4) {
          // simulate a double tap by releasing for one frame
          this.held.delete(this.towardOpp);
        }
        break;
      }
      case 'retreat':
        this.held.add(this.awayFromOpp);
        break;
      case 'hover': {
        const want = p.idealRange;
        if (d > want + 14) this.held.add(this.towardOpp);
        else if (d < want - 14) this.held.add(this.awayFromOpp);
        else if (this.planAge % 24 < 12) this.held.add(this.awayFromOpp);
        break;
      }
      case 'block':
        this.held.add('block');
        if (this.plan.low) this.held.add('down');
        break;
      case 'throw':
        if (d < 52) this.held.add('grab');
        else this.held.add(this.towardOpp);
        break;
      case 'jumpIn':
        if (d > 60) this.held.add(this.towardOpp);
        this.held.add('up');
        if (this.planAge > 8 && d < 90) this.held.add('light');
        break;
      case 'attack':
        this.startCombo();
        break;
      case 'special':
        this.inputSpecial(this.plan.id);
        break;
      case 'super':
        this.held.add('super');
        break;
      case 'wait':
        break;
    }
  }

  /** Begin the planned combo string. */
  private startCombo(): void {
    if (this.plan.kind !== 'attack') return;
    const d = this.dist;
    if (d > 78) {
      this.held.add(this.towardOpp);
      return;
    }
    if (this.attackCooldown > 0) return;
    const id = this.plan.ids[this.plan.step];
    if (!id) return;
    this.pressFor(id);
    this.plan.step++;
    this.attackCooldown = 6;
  }

  /** Continue a combo while the current attack is still running. */
  private feedCombo(): void {
    if (this.plan.kind !== 'attack') return;
    const f = this.f;
    const m = f.move;
    if (!m) return;
    // press the next button near the end of the active window (buffered)
    if (f.moveFrame < m.startup + m.active - 1) return;
    if (f.queued) return;
    const id = this.plan.ids[this.plan.step];
    if (!id) return;
    // only continue if the previous hit actually connected (like a human would)
    if (!f.moveConnected && this.rng() > 0.25) return;
    this.pressFor(id);
    this.plan.step++;
  }

  private pressFor(id: string): void {
    const f = this.f;
    const m = f.def.moves[id];
    if (!m) return;
    const n = m.notation.toUpperCase();
    if (n.includes('SUPER')) {
      this.held.add('super');
      return;
    }
    if (id === 'sweep' || (m.crouchOnly && n.includes('HEAVY'))) {
      this.held.add('down');
      this.held.add('heavy');
      return;
    }
    if (id === 'cl' || (m.crouchOnly && n.includes('LIGHT'))) {
      this.held.add('down');
      this.held.add('light');
      return;
    }
    if (id === 'launch') {
      this.held.add('up');
      this.held.add('heavy');
      return;
    }
    if (id === 'over') {
      this.held.add(this.towardOpp);
      this.held.add('heavy');
      return;
    }
    if (id === 'throwF') {
      this.held.add('grab');
      return;
    }
    if (m.kind === 'special') {
      this.inputSpecial(id);
      return;
    }
    if (n.includes('HEAVY')) this.held.add('heavy');
    else this.held.add('light');
  }

  /**
   * Specials: the CPU presses the button plus the required direction hint.
   * The engine also allows CPU-driven specials to bypass strict motions by
   * feeding the direction for a couple of frames beforehand; to keep it fair,
   * the AI simply holds the direction and the button, which the buffer accepts.
   */
  private inputSpecial(id: string): void {
    const f = this.f;
    const m = f.def.moves[id];
    if (!m) return;
    const n = m.notation.toUpperCase();
    const toward = this.towardOpp;
    const away = this.awayFromOpp;

    if (n.includes('SUPER')) {
      this.held.add('super');
      return;
    }
    // direction hint
    if (n.includes('DOWN, FORWARD')) {
      this.held.add('down');
      this.held.add(toward);
    } else if (n.includes('DOWN, BACK')) {
      this.held.add('down');
      this.held.add(away);
    } else if (n.includes('FORWARD, FORWARD')) {
      this.held.add(toward);
    } else if (n.includes('BACK, BACK')) {
      this.held.add(away);
    } else if (n.includes('DOWN, DOWN')) {
      this.held.add('down');
    } else if (n.includes('FORWARD, DOWN')) {
      this.held.add(toward);
      this.held.add('down');
    }

    if (n.includes('LIGHT')) this.held.add('light');
    else if (n.includes('HEAVY')) this.held.add('heavy');
    else if (n.includes('GRAB')) this.held.add('grab');
    else this.held.add('special');
  }

  // ---- move selection ---------------------------------------------------

  private comboString(): string[] {
    const f = this.f;
    const len = Math.max(1, this.tune.comboLen);
    const has = (id: string) => !!f.def.moves[id];
    const out: string[] = [];
    const r = this.rng();

    if (r < 0.2 && has('cl')) out.push('cl');
    else out.push('l1');

    if (len >= 2 && has('l2')) out.push('l2');
    if (len >= 3) {
      if (this.rng() < 0.5 && has('h1')) out.push('h1');
      else if (has('l3')) out.push('l3');
    }
    if (len >= 4) {
      // launcher route or heavy ender
      if (this.rng() < 0.42 && has('launch')) {
        out.push('launch');
        if (has('airL')) out.push('airL');
        if (len >= 5 && has('airH')) out.push('airH');
      } else if (has('h2')) {
        out.push('h2');
      }
    }
    if (len >= 5 && this.rng() < this.tune.specialChance) {
      const sp = this.pickEnder();
      if (sp) out.push(sp);
    }
    return out;
  }

  private pickEnder(): string | null {
    const f = this.f;
    for (const id of ['sp1', 'sp3', 'sp2']) {
      const m = f.def.moves[id];
      if (!m) continue;
      if (m.projectile || m.counter || m.buff || m.throwDef) continue;
      if (m.airOnly) continue;
      return id;
    }
    return null;
  }

  private pickRush(): string | null {
    const f = this.f;
    for (const [id, m] of Object.entries(f.def.moves)) {
      if (m.kind !== 'special') continue;
      if (m.airOnly || m.projectile || m.counter || m.buff) continue;
      if (!m.movement || !m.movement.length) continue;
      if (m.movement[0].vx <= 3) continue;
      if (!f.canUse(id)) continue;
      return id;
    }
    return null;
  }

  private pickProjectile(): string | null {
    const f = this.f;
    for (const [id, m] of Object.entries(f.def.moves)) {
      if (m.kind !== 'special' || !m.projectile) continue;
      if (!f.canUse(id)) continue;
      return id;
    }
    return null;
  }

  private pickCounter(): string | null {
    const f = this.f;
    for (const [id, m] of Object.entries(f.def.moves)) {
      if (m.kind !== 'special' || !m.counter) continue;
      if (!f.canUse(id)) continue;
      return id;
    }
    return null;
  }

  private pickAntiAir(): string | null {
    const f = this.f;
    if (f.def.moves.launch && f.canUse('launch')) return 'launch';
    for (const [id, m] of Object.entries(f.def.moves)) {
      if (m.kind !== 'special') continue;
      if (m.hits.some((h) => h.antiAir || h.launcher)) {
        if (f.canUse(id)) return id;
      }
    }
    return null;
  }
}
