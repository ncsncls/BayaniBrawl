// ============================================================================
// GameEngine - owns the match: fighters, projectiles, camera, effects, round
// flow, and the fixed-timestep loop. Simulation lives in matchSim.ts and
// drawing in matchRender.ts; this file wires them together and exposes the
// snapshot React needs.
// ============================================================================

import { Fighter } from '../fighters/Fighter';
import { FighterController } from '../fighters/FighterController';
import { CpuController } from '../ai/CpuController';
import { Projectile } from '../combat/Projectile';
import { Camera } from '../rendering/Camera';
import { EffectsRenderer } from '../rendering/EffectsRenderer';
import { StageRenderer } from '../rendering/StageRenderer';
import { FighterRenderer } from '../rendering/FighterRenderer';
import { music } from '../audio/MusicManager';
import { BALANCE, ROUND_TIME, ROUNDS_TO_WIN, FPS } from '../data/balance';
import { getStage } from '../data/stages';
import { getFighter } from '../data/fighters';
import type { StageBounds } from '../physics/step';
import type { Difficulty, StageDef } from '../game/types';
import type { Btn } from '../input/InputBuffer';
import { simulate } from './matchSim';
import { renderMatch } from './matchRender';

export type Phase =
  | 'intro'
  | 'roundStart'
  | 'fight'
  | 'koFreeze'
  | 'roundEnd'
  | 'matchEnd'
  | 'paused';

export type DummyMode =
  | 'stand'
  | 'crouch'
  | 'block'
  | 'blockAll'
  | 'counter'
  | 'jump'
  | 'record';

export interface TrainingConfig {
  dummy: DummyMode;
  infiniteHp: boolean;
  infiniteMeter: boolean;
  showHitboxes: boolean;
  showInputs: boolean;
  showDamage: boolean;
}

export interface EngineOptions {
  p1: string;
  p2: string;
  stage: string;
  difficulty: Difficulty;
  /** how player 2 is driven */
  p2Kind: 'cpu' | 'human' | 'training';
  rounds?: number;
  roundTime?: number;
  training?: TrainingConfig;
  /** simplified special inputs (touch / accessibility) */
  simpleInputs?: boolean;
}

export interface Announce {
  text: string;
  sub?: string;
  life: number;
  maxLife: number;
  big: boolean;
}

export interface FighterStatsOut {
  damageDealt: number;
  longestCombo: number;
  counters: number;
  throws: number;
  blocks: number;
  specials: number;
  supers: number;
  perfects: number;
}

export interface SideSnapshot {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  meter: number;
  bars: number;
  wins: number;
  spirit: boolean;
  buff: string | null;
}

export interface Snapshot {
  phase: Phase;
  timer: number;
  round: number;
  roundsToWin: number;
  p1: SideSnapshot;
  p2: SideSnapshot;
  announce: Announce | null;
  combo: { hits: number; who: 0 | 1 } | null;
  matchOver: boolean;
  matchWinner: 0 | 1 | null;
  roundWinner: 0 | 1 | null;
  perfect: boolean;
  timeout: boolean;
  fps: number;
  stats: [FighterStatsOut, FighterStatsOut];
  matchTime: number;
  inputLog: Array<{ dir: string; btns: string[] }>;
  debug: string[];
}

export interface RenderSettings {
  screenShake: boolean;
  hitFlash: boolean;
  crt: boolean;
  scanlines: boolean;
  damageNumbers: boolean;
  inputDisplay: boolean;
  reducedMotion: boolean;
  showHitboxes: boolean;
  debug: boolean;
}

export const DEFAULT_RENDER: RenderSettings = {
  screenShake: true,
  hitFlash: true,
  crt: false,
  scanlines: true,
  damageNumbers: true,
  inputDisplay: false,
  reducedMotion: false,
  showHitboxes: false,
  debug: false,
};

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  f1!: Fighter;
  f2!: Fighter;
  c1!: FighterController;
  c2!: FighterController;
  cpu: CpuController | null = null;

  stage!: StageDef;
  bounds: StageBounds = { left: 40, right: 1360 };

  camera = new Camera();
  fx = new EffectsRenderer();
  stageR = new StageRenderer();
  fighterR = new FighterRenderer();
  projectiles: Projectile[] = [];

  phase: Phase = 'intro';
  phaseFrame = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  roundsToWin = ROUNDS_TO_WIN;
  timer = ROUND_TIME;
  timerSub = 0;
  roundWinner: 0 | 1 | null = null;
  matchWinner: 0 | 1 | null = null;
  matchOver = false;
  perfectRound = false;
  timeoutRound = false;
  matchFrames = 0;
  frame = 0;

  announce: Announce | null = null;
  combo: { hits: number; who: 0 | 1; life: number } | null = null;

  opts: EngineOptions;
  settings: RenderSettings = { ...DEFAULT_RENDER };
  training: TrainingConfig | null = null;
  simpleInputs = false;

  /** KO slow-motion frames remaining */
  slow = 0;

  /** training: recorded dummy inputs */
  recordFrames: Array<Btn[]> = [];
  recording = false;
  playbackIndex = 0;

  fpsShown = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private accum = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private prevPhase: Phase = 'fight';

  /** injected by the React layer */
  inputSource: (index: 0 | 1) => Set<Btn> = () => new Set();
  onEvent: (kind: string, payload?: unknown) => void = () => {};
  onSnapshot: (s: Snapshot) => void = () => {};

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.opts = opts;
    this.roundsToWin = opts.rounds ?? ROUNDS_TO_WIN;
    this.timer = opts.roundTime ?? ROUND_TIME;
    this.training = opts.training ?? null;
    this.simpleInputs = !!opts.simpleInputs;
    this.setup(opts);
  }

  // ---------------------------------------------------------------- setup

  setup(opts: EngineOptions): void {
    const d1 = getFighter(opts.p1);
    const d2 = getFighter(opts.p2);
    this.opts = opts;
    this.f1 = new Fighter(d1, 0);
    this.f2 = new Fighter(d2, 1);
    this.c1 = new FighterController(this.f1);
    this.c2 = new FighterController(this.f2);
    this.stage = getStage(opts.stage);
    this.bounds = { left: 40, right: this.stage.width - 40 };
    this.camera.setStage(this.bounds.left, this.bounds.right);
    this.stageR.load(this.stage);
    this.projectiles.length = 0;
    this.fx.clear();
    this.wins = [0, 0];
    this.round = 1;
    this.matchOver = false;
    this.matchWinner = null;
    this.roundWinner = null;
    this.matchFrames = 0;
    this.combo = null;
    this.slow = 0;

    this.cpu =
      opts.p2Kind === 'cpu'
        ? new CpuController(this.f2, this.f1, d2.ai, opts.difficulty, hash(opts.p2) ^ 0x9e37)
        : null;

    this.resetPositions();
    this.phase = 'intro';
    this.phaseFrame = 0;
    this.announceText(`${d1.name}  VS  ${d2.name}`, this.stage.name, false, 96);
    this.camera.snap(this.f1.x, this.f2.x, this.aspect);
  }

  get aspect(): number {
    return this.canvas.width / Math.max(1, this.canvas.height);
  }

  resetPositions(): void {
    const mid = this.stage.width / 2;
    this.f1.reset(mid - 95, 1);
    this.f2.reset(mid + 95, -1);
    this.projectiles.length = 0;
    this.fx.clear();
    this.combo = null;
    this.applyTrainingFlags();
  }

  private applyTrainingFlags(): void {
    const t = this.training;
    if (!t) return;
    for (const f of [this.f1, this.f2]) {
      f.infiniteHp = t.infiniteHp;
      f.infiniteMeter = t.infiniteMeter;
      if (t.infiniteMeter) f.meter = BALANCE.meterMax;
      if (t.infiniteHp) f.hp = f.maxHp;
    }
    this.fx.showDamage = t.showDamage;
  }

  applySettings(s: Partial<RenderSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.fx.reducedMotion = this.settings.reducedMotion;
    this.fx.showDamage = this.training
      ? this.training.showDamage
      : this.settings.damageNumbers;
  }

  applyTraining(t: Partial<TrainingConfig>): void {
    if (!this.training) return;
    this.training = { ...this.training, ...t };
    this.applyTrainingFlags();
  }

  setDifficulty(d: Difficulty): void {
    this.opts = { ...this.opts, difficulty: d };
    this.cpu?.setDifficulty(d);
  }

  announceText(text: string, sub: string | undefined, big: boolean, life: number): void {
    this.announce = { text, sub, life, maxLife: life, big };
  }

  setPhase(p: Phase): void {
    this.phase = p;
    this.phaseFrame = 0;
  }

  // ---------------------------------------------------------------- loop

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accum = 0;
    music.play(this.stage.music);
    const tick = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(tick);
      let dt = now - this.lastTime;
      this.lastTime = now;
      if (dt > 220) dt = 220;
      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsAccum >= 500) {
        this.fpsShown = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }
      const rate = this.slow > 0 ? BALANCE.koSlowmoRate : 1;
      this.accum += dt * rate;
      const stepMs = 1000 / FPS;
      let steps = 0;
      while (this.accum >= stepMs && steps < 5) {
        simulate(this);
        this.accum -= stepMs;
        steps++;
      }
      renderMatch(this);
      this.onSnapshot(this.snapshot());
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    music.duck(false);
  }

  pause(): void {
    if (this.phase === 'paused') return;
    this.prevPhase = this.phase;
    this.phase = 'paused';
    music.duck(true);
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.prevPhase;
    this.lastTime = performance.now();
    this.accum = 0;
    music.duck(false);
  }

  get isPaused(): boolean {
    return this.phase === 'paused';
  }

  // ---------------------------------------------------------------- rounds

  nextRound(): void {
    this.round++;
    this.roundWinner = null;
    this.perfectRound = false;
    this.timeoutRound = false;
    this.slow = 0;
    this.resetPositions();
    this.camera.snap(this.f1.x, this.f2.x, this.aspect);
    this.setPhase('roundStart');
    const decider = this.wins[0] === this.roundsToWin - 1 && this.wins[1] === this.roundsToWin - 1;
    this.announceText(decider ? 'FINAL ROUND' : `ROUND ${this.round}`, undefined, true, 72);
  }

  rematch(): void {
    const opts = this.opts;
    this.setup({ ...opts });
    music.play(this.stage.music);
  }

  /** Start the next arcade fight without recreating the engine. */
  nextFight(p2: string, stage: string, difficulty?: Difficulty): void {
    this.setup({
      ...this.opts,
      p2,
      stage,
      difficulty: difficulty ?? this.opts.difficulty,
    });
    music.play(this.stage.music);
  }

  // ---------------------------------------------------------------- output

  snapshot(): Snapshot {
    const side = (f: Fighter, wins: number): SideSnapshot => ({
      id: f.def.id,
      name: f.def.name,
      hp: f.hp,
      maxHp: f.maxHp,
      meter: f.meter,
      bars: f.meterBars,
      wins,
      spirit: f.spirit,
      buff: f.activeBuffLabel,
    });
    const debug: string[] = [];
    if (this.settings.debug) {
      debug.push(`FPS ${this.fpsShown}  FRAME ${this.frame}  PHASE ${this.phase}`);
      debug.push(
        `P1 ${this.f1.state} f${this.f1.stateFrame} mv=${this.f1.move?.id ?? '-'}@${this.f1.moveFrame} hs=${this.f1.hitstop} y=${this.f1.y.toFixed(1)}`,
      );
      debug.push(
        `P2 ${this.f2.state} f${this.f2.stateFrame} mv=${this.f2.move?.id ?? '-'}@${this.f2.moveFrame} hs=${this.f2.hitstop} y=${this.f2.y.toFixed(1)}`,
      );
      debug.push(
        `CAM x=${this.camera.x.toFixed(0)} w=${this.camera.viewW.toFixed(0)} FX ${this.fx.count} PROJ ${this.projectiles.length}`,
      );
    }
    return {
      phase: this.phase,
      timer: this.timer,
      round: this.round,
      roundsToWin: this.roundsToWin,
      p1: side(this.f1, this.wins[0]),
      p2: side(this.f2, this.wins[1]),
      announce: this.announce,
      combo: this.combo ? { hits: this.combo.hits, who: this.combo.who } : null,
      matchOver: this.matchOver,
      matchWinner: this.matchWinner,
      roundWinner: this.roundWinner,
      perfect: this.perfectRound,
      timeout: this.timeoutRound,
      fps: this.fpsShown,
      stats: [{ ...this.f1.stats }, { ...this.f2.stats }],
      matchTime: Math.round(this.matchFrames / FPS),
      inputLog: this.f1.input.log.slice(0, 10).map((l) => ({ dir: l.dir, btns: l.btns })),
      debug,
    };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
