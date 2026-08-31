// ============================================================================
// AudioManager: all sound is synthesised at runtime with WebAudio.
// No sample files, no copyrighted material. SFX are short procedural blasts;
// music is a sequenced loop built from oscillators and noise.
// ============================================================================

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
}

type SfxName =
  | 'punch'
  | 'kick'
  | 'slash'
  | 'block'
  | 'parry'
  | 'counter'
  | 'hitLight'
  | 'hitHeavy'
  | 'heavy'
  | 'launch'
  | 'land'
  | 'dash'
  | 'jump'
  | 'special'
  | 'super'
  | 'ko'
  | 'menu'
  | 'select'
  | 'round'
  | 'fight'
  | 'victory'
  | 'throw'
  | 'whiff'
  | 'meter'
  | 'spirit';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private comp!: DynamicsCompressorNode;
  settings: AudioSettings = { master: 0.7, music: 0.55, sfx: 0.8 };
  private started = false;
  private noiseBuf: AudioBuffer | null = null;
  private musicStop: (() => void) | null = null;
  private currentTrack: string | null = null;
  private sfxBudget = 0;
  private lastFrameTime = 0;

  /** Must be called from a user gesture. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.22;
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.comp);
    this.comp.connect(this.ctx.destination);
    this.applySettings();
    this.buildNoise();
    this.started = true;
  }

  get ready(): boolean {
    return this.started && !!this.ctx;
  }

  /** exposed for the music sequencer */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get musicBus(): GainNode | null {
    return this.ctx ? this.musicGain : null;
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noiseBuf;
  }

  setMusicStopper(fn: (() => void) | null): void {
    this.musicStop = fn;
  }

  get trackId(): string | null {
    return this.currentTrack;
  }

  setTrackId(id: string | null): void {
    this.currentTrack = id;
  }

  stopMusic(): void {
    this.musicStop?.();
    this.musicStop = null;
    this.currentTrack = null;
  }

  applySettings(s?: Partial<AudioSettings>): void {
    if (s) this.settings = { ...this.settings, ...s };
    if (!this.ctx) return;
    this.masterGain.gain.value = this.settings.master;
    this.musicGain.gain.value = this.settings.music * 0.6;
    this.sfxGain.gain.value = this.settings.sfx;
  }

  private buildNoise(): void {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // slightly brown-ish noise reads better for impacts
      last = (last + 0.02 * white) / 1.02;
      d[i] = white * 0.7 + last * 3;
    }
    this.noiseBuf = buf;
  }

  private noise(dur: number, gain: number, filter: number, q = 1): void {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = filter;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(
    freq: number,
    dur: number,
    gain: number,
    type: OscillatorType = 'square',
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Reset the per-frame SFX budget so a 12-hit super does not clip. */
  frameTick(): void {
    this.sfxBudget = 4;
  }

  play(name: SfxName | string): void {
    if (!this.ctx) return;
    if (this.sfxBudget-- <= 0) return;
    switch (name) {
      case 'punch':
      case 'hitLight':
        this.noise(0.09, 0.5, 1400, 1.2);
        this.tone(220, 0.07, 0.16, 'square', 90);
        break;
      case 'kick':
        this.noise(0.11, 0.55, 900, 1.1);
        this.tone(160, 0.09, 0.18, 'square', 70);
        break;
      case 'slash':
        this.noise(0.13, 0.42, 3600, 3.2);
        this.tone(1500, 0.09, 0.1, 'sawtooth', 420);
        break;
      case 'hitHeavy':
      case 'heavy':
        this.noise(0.17, 0.7, 620, 0.8);
        this.tone(110, 0.16, 0.3, 'square', 46);
        this.tone(320, 0.07, 0.14, 'triangle', 120);
        break;
      case 'block':
        this.noise(0.08, 0.34, 2400, 2.4);
        this.tone(520, 0.06, 0.12, 'square', 340);
        break;
      case 'parry':
        this.tone(1320, 0.13, 0.2, 'triangle', 1980);
        this.noise(0.07, 0.3, 5200, 4);
        break;
      case 'counter':
        this.tone(880, 0.1, 0.22, 'square', 1760);
        this.noise(0.16, 0.6, 1100, 1);
        this.tone(140, 0.18, 0.26, 'square', 60);
        break;
      case 'launch':
        this.tone(300, 0.22, 0.24, 'square', 1200);
        this.noise(0.14, 0.4, 1800, 1.4);
        break;
      case 'land':
        this.noise(0.1, 0.34, 320, 0.7);
        break;
      case 'dash':
        this.noise(0.12, 0.26, 1600, 1.6);
        break;
      case 'jump':
        this.tone(420, 0.1, 0.12, 'triangle', 720);
        break;
      case 'whiff':
        this.noise(0.1, 0.16, 2600, 2.6);
        break;
      case 'throw':
        this.noise(0.2, 0.5, 700, 0.9);
        this.tone(180, 0.2, 0.24, 'square', 60);
        break;
      case 'special':
        this.tone(180, 0.26, 0.26, 'sawtooth', 620);
        this.noise(0.2, 0.4, 2200, 1.2);
        break;
      case 'super':
        this.tone(90, 0.5, 0.34, 'sawtooth', 300);
        this.tone(360, 0.4, 0.2, 'square', 1400, 0.04);
        this.noise(0.4, 0.6, 900, 0.7);
        for (let i = 0; i < 4; i++) {
          this.tone(660 + i * 220, 0.12, 0.1, 'triangle', 320, 0.06 * i);
        }
        break;
      case 'ko':
        this.tone(70, 0.9, 0.4, 'sawtooth', 30);
        this.noise(0.6, 0.7, 500, 0.5);
        this.tone(220, 0.6, 0.2, 'square', 55, 0.08);
        break;
      case 'menu':
        this.tone(660, 0.05, 0.12, 'square');
        break;
      case 'select':
        this.tone(880, 0.07, 0.16, 'square', 1320);
        this.tone(1320, 0.09, 0.1, 'triangle', 1760, 0.05);
        break;
      case 'round':
        this.tone(330, 0.3, 0.2, 'square', 660);
        break;
      case 'fight':
        this.tone(220, 0.18, 0.24, 'square', 440);
        this.tone(440, 0.24, 0.2, 'square', 880, 0.1);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, 0.24, 0.16, 'square', undefined, i * 0.11),
        );
        break;
      case 'meter':
        this.tone(1200, 0.09, 0.1, 'triangle', 1800);
        break;
      case 'spirit':
        this.tone(160, 0.5, 0.22, 'sawtooth', 480);
        [440, 660, 880].forEach((f, i) =>
          this.tone(f, 0.3, 0.1, 'triangle', f * 1.5, i * 0.07),
        );
        break;
      default:
        this.noise(0.08, 0.3, 1200, 1);
        break;
    }
  }
}

export const audio = new AudioManager();
