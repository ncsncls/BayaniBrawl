// ============================================================================
// MusicManager: original procedural tracks.
// ----------------------------------------------------------------------------
// Nothing here is sampled or transcribed from existing recordings. Each track
// is a set of pattern arrays played by a scheduler over synthesised voices:
//   - "gong" voice: FM-ish metallic hit (kulintang/agung-inspired texture)
//   - "pluck" voice: short decaying string (rondalla-inspired)
//   - "lead" voice: arcade square/saw melody
//   - "bass" voice: driving arcade bass
//   - "drum" voice: noise-based kick/snare/hat
// Scales used are original note-number patterns, chosen to feel pentatonic.
// ============================================================================

import { audio } from './AudioManager';

type Voice = 'gong' | 'pluck' | 'lead' | 'bass' | 'kick' | 'snare' | 'hat' | 'pad';

interface Note {
  /** step index within the pattern */
  s: number;
  /** midi-ish note number; 0 = rest */
  n: number;
  /** length in steps */
  l?: number;
  /** velocity 0..1 */
  v?: number;
}

interface Track {
  id: string;
  name: string;
  bpm: number;
  /** steps per bar (16 = sixteenth notes) */
  steps: number;
  bars: number;
  parts: Array<{ voice: Voice; notes: Note[] }>;
}

const M = (s: number, n: number, l = 1, v = 1): Note => ({ s, n, l, v });

function freq(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// --- pattern helpers -------------------------------------------------------

function gongCycle(offsets: number[], notes: number[], bars: number, steps: number): Note[] {
  const out: Note[] = [];
  for (let b = 0; b < bars; b++) {
    offsets.forEach((o, i) => {
      out.push(M(b * steps + o, notes[(i + b) % notes.length], 2, 0.9));
    });
  }
  return out;
}

function fourOnFloor(bars: number, steps: number, hitsPerBar: number[]): Note[] {
  const out: Note[] = [];
  for (let b = 0; b < bars; b++) {
    for (const h of hitsPerBar) out.push(M(b * steps + h, 36, 1, 1));
  }
  return out;
}

function hats(bars: number, steps: number, every = 2, v = 0.4): Note[] {
  const out: Note[] = [];
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < steps; s += every) {
      out.push(M(b * steps + s, 42, 1, s % 4 === 0 ? v : v * 0.6));
    }
  }
  return out;
}

function bassLine(root: number, pattern: number[], bars: number, steps: number): Note[] {
  const out: Note[] = [];
  for (let b = 0; b < bars; b++) {
    pattern.forEach((p, i) => {
      if (p === 0) return;
      out.push(M(b * steps + i, root + p - 1, 2, 0.9));
    });
  }
  return out;
}

// --- the tracks ------------------------------------------------------------
// Scale set used for melodies: [0,2,4,7,9] (pentatonic shape, original lines).

const TRACKS: Track[] = [
  {
    id: 'title',
    name: 'HONOR THE PAST',
    bpm: 92,
    steps: 16,
    bars: 4,
    parts: [
      {
        voice: 'gong',
        notes: gongCycle([0, 6, 10], [45, 52, 57, 50], 4, 16),
      },
      {
        voice: 'pad',
        notes: [M(0, 45, 32, 0.4), M(32, 50, 32, 0.4)],
      },
      {
        voice: 'lead',
        notes: [
          M(0, 69, 3, 0.7), M(4, 72, 2, 0.6), M(7, 74, 3, 0.7), M(12, 72, 3, 0.6),
          M(16, 76, 4, 0.75), M(21, 74, 2, 0.6), M(24, 69, 4, 0.7),
          M(32, 67, 3, 0.65), M(36, 69, 2, 0.6), M(39, 72, 5, 0.7),
          M(48, 74, 3, 0.7), M(52, 72, 2, 0.6), M(55, 69, 6, 0.7),
        ],
      },
      {
        voice: 'pluck',
        notes: [
          M(2, 57, 1, 0.5), M(10, 60, 1, 0.5), M(18, 62, 1, 0.5), M(26, 57, 1, 0.5),
          M(34, 55, 1, 0.5), M(42, 60, 1, 0.5), M(50, 62, 1, 0.5), M(58, 64, 1, 0.5),
        ],
      },
      { voice: 'hat', notes: hats(4, 16, 4, 0.24) },
    ],
  },
  {
    id: 'select',
    name: 'CHOOSE YOUR BAYANI',
    bpm: 124,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 6, 8, 14]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.7), M(12, 38, 1, 0.7), M(20, 38, 0.7), M(28, 38, 1, 0.7), M(36, 38, 1, 0.7), M(44, 38, 1, 0.7), M(52, 38, 1, 0.7), M(60, 38, 1, 0.8)] },
      { voice: 'hat', notes: hats(4, 16, 2, 0.3) },
      { voice: 'bass', notes: bassLine(33, [1, 0, 0, 1, 0, 8, 0, 0, 1, 0, 0, 1, 0, 6, 0, 0], 4, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 76, 2, 0.7), M(2, 79, 2, 0.7), M(4, 81, 2, 0.7), M(6, 79, 2, 0.6),
          M(8, 76, 4, 0.7), M(14, 74, 2, 0.6),
          M(16, 72, 2, 0.7), M(18, 76, 2, 0.7), M(20, 79, 4, 0.75), M(26, 76, 2, 0.6),
          M(32, 81, 2, 0.7), M(34, 83, 2, 0.7), M(36, 84, 4, 0.8), M(42, 81, 2, 0.6),
          M(48, 79, 2, 0.7), M(50, 76, 2, 0.7), M(52, 72, 6, 0.7),
        ],
      },
      { voice: 'gong', notes: gongCycle([0, 12], [52, 57], 4, 16) },
    ],
  },
  {
    id: 'shore',
    name: 'MACTAN SHORE',
    bpm: 138,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 3, 8, 11]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.8), M(12, 38, 1, 0.8), M(20, 38, 1, 0.8), M(28, 38, 1, 0.9), M(36, 38, 1, 0.8), M(44, 38, 1, 0.8), M(52, 38, 1, 0.8), M(58, 38, 1, 0.6), M(60, 38, 1, 0.9)] },
      { voice: 'hat', notes: hats(4, 16, 2, 0.32) },
      { voice: 'bass', notes: bassLine(31, [1, 0, 1, 0, 8, 0, 1, 0, 1, 0, 1, 0, 6, 0, 4, 0], 4, 16) },
      { voice: 'gong', notes: gongCycle([0, 5, 10, 13], [50, 55, 57, 62], 4, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 74, 3, 0.8), M(4, 77, 2, 0.7), M(6, 79, 4, 0.8), M(12, 77, 2, 0.7),
          M(16, 82, 3, 0.85), M(20, 79, 2, 0.7), M(22, 74, 4, 0.8),
          M(32, 72, 3, 0.75), M(36, 74, 2, 0.7), M(38, 79, 5, 0.85),
          M(48, 82, 2, 0.8), M(50, 84, 2, 0.8), M(52, 79, 6, 0.8),
        ],
      },
    ],
  },
  {
    id: 'walls',
    name: 'STONE WALLS',
    bpm: 128,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 6, 8, 12]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.75), M(12, 38, 1, 0.8), M(20, 38, 1, 0.75), M(28, 38, 1, 0.85), M(36, 38, 1, 0.75), M(44, 38, 1, 0.8), M(52, 38, 1, 0.75), M(60, 38, 1, 0.9)] },
      { voice: 'hat', notes: hats(4, 16, 2, 0.26) },
      { voice: 'bass', notes: bassLine(29, [1, 0, 0, 1, 0, 0, 8, 0, 1, 0, 0, 1, 0, 0, 6, 0], 4, 16) },
      { voice: 'pad', notes: [M(0, 41, 32, 0.32), M(32, 46, 32, 0.32)] },
      {
        voice: 'lead',
        notes: [
          M(0, 65, 4, 0.7), M(6, 68, 3, 0.7), M(10, 70, 4, 0.75),
          M(16, 72, 4, 0.8), M(22, 70, 3, 0.7), M(26, 65, 4, 0.7),
          M(32, 63, 4, 0.7), M(38, 65, 3, 0.7), M(42, 70, 5, 0.75),
          M(48, 72, 4, 0.8), M(54, 68, 3, 0.7), M(58, 65, 5, 0.7),
        ],
      },
      { voice: 'gong', notes: gongCycle([0, 8], [46, 53], 4, 16) },
    ],
  },
  {
    id: 'plaza',
    name: 'NORTHERN PLAZA',
    bpm: 146,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 4, 8, 12]) },
      { voice: 'snare', notes: [M(2, 38, 1, 0.5), M(6, 38, 1, 0.8), M(14, 38, 1, 0.8), M(22, 38, 1, 0.8), M(30, 38, 1, 0.9), M(38, 38, 1, 0.8), M(46, 38, 1, 0.8), M(54, 38, 1, 0.8), M(62, 38, 1, 0.9)] },
      { voice: 'hat', notes: hats(4, 16, 1, 0.2) },
      { voice: 'bass', notes: bassLine(33, [1, 1, 0, 1, 0, 1, 0, 8, 1, 1, 0, 1, 0, 6, 0, 4], 4, 16) },
      {
        voice: 'pluck',
        notes: [
          M(0, 69, 1, 0.6), M(3, 72, 1, 0.6), M(6, 74, 1, 0.6), M(9, 76, 1, 0.6),
          M(16, 74, 1, 0.6), M(19, 72, 1, 0.6), M(22, 69, 1, 0.6),
          M(32, 71, 1, 0.6), M(35, 74, 1, 0.6), M(38, 76, 1, 0.6),
          M(48, 79, 1, 0.65), M(51, 76, 1, 0.6), M(54, 72, 1, 0.6),
        ],
      },
      {
        voice: 'lead',
        notes: [
          M(0, 81, 3, 0.8), M(4, 84, 2, 0.75), M(7, 86, 4, 0.85),
          M(16, 84, 3, 0.8), M(20, 81, 2, 0.7), M(23, 79, 5, 0.8),
          M(32, 83, 3, 0.8), M(36, 86, 2, 0.75), M(39, 88, 5, 0.85),
          M(48, 84, 3, 0.8), M(52, 81, 3, 0.75), M(56, 76, 6, 0.8),
        ],
      },
    ],
  },
  {
    id: 'bamboo',
    name: 'MOONLIT BAMBOO',
    bpm: 116,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 8]) },
      { voice: 'snare', notes: [M(12, 38, 1, 0.6), M(28, 38, 1, 0.7), M(44, 38, 1, 0.6), M(60, 38, 1, 0.75)] },
      { voice: 'hat', notes: hats(4, 16, 4, 0.22) },
      { voice: 'bass', notes: bassLine(28, [1, 0, 0, 0, 8, 0, 0, 0, 1, 0, 0, 0, 6, 0, 0, 0], 4, 16) },
      { voice: 'pad', notes: [M(0, 40, 64, 0.36)] },
      {
        voice: 'pluck',
        notes: [
          M(0, 64, 1, 0.55), M(4, 67, 1, 0.5), M(8, 71, 1, 0.55), M(12, 74, 1, 0.5),
          M(16, 71, 1, 0.5), M(20, 67, 1, 0.5), M(24, 64, 1, 0.55),
          M(32, 62, 1, 0.5), M(36, 67, 1, 0.5), M(40, 71, 1, 0.55),
          M(48, 74, 1, 0.55), M(52, 71, 1, 0.5), M(56, 64, 1, 0.5),
        ],
      },
      { voice: 'gong', notes: gongCycle([0, 10], [40, 47], 4, 16) },
    ],
  },
  {
    id: 'camp',
    name: 'CAMPFIRE OATH',
    bpm: 132,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 3, 6, 8, 11, 14]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.7), M(12, 38, 1, 0.85), M(20, 38, 1, 0.7), M(28, 38, 1, 0.9), M(36, 38, 1, 0.7), M(44, 38, 1, 0.85), M(52, 38, 1, 0.7), M(60, 38, 1, 0.95)] },
      { voice: 'hat', notes: hats(4, 16, 2, 0.3) },
      { voice: 'bass', notes: bassLine(31, [1, 0, 1, 0, 1, 0, 8, 0, 1, 0, 1, 0, 1, 0, 6, 0], 4, 16) },
      { voice: 'gong', notes: gongCycle([0, 4, 8, 12], [43, 50, 55, 47], 4, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 74, 2, 0.8), M(2, 74, 2, 0.7), M(4, 79, 4, 0.85),
          M(12, 77, 3, 0.75),
          M(16, 74, 2, 0.8), M(18, 74, 2, 0.7), M(20, 81, 4, 0.85),
          M(28, 79, 3, 0.75),
          M(32, 82, 3, 0.85), M(36, 79, 2, 0.7), M(38, 74, 4, 0.8),
          M(48, 77, 3, 0.8), M(52, 74, 3, 0.75), M(56, 70, 6, 0.8),
        ],
      },
    ],
  },
  {
    id: 'port',
    name: 'HARBOUR IRON',
    bpm: 142,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 5, 8, 13]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.8), M(12, 38, 1, 0.8), M(19, 38, 1, 0.5), M(20, 38, 1, 0.8), M(28, 38, 1, 0.9), M(36, 38, 1, 0.8), M(44, 38, 1, 0.8), M(52, 38, 1, 0.8), M(60, 38, 1, 0.9)] },
      { voice: 'hat', notes: hats(4, 16, 2, 0.3) },
      { voice: 'bass', notes: bassLine(30, [1, 0, 1, 1, 0, 8, 0, 1, 1, 0, 1, 1, 0, 6, 0, 4], 4, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 66, 3, 0.8), M(4, 71, 2, 0.75), M(6, 73, 4, 0.85),
          M(16, 78, 3, 0.85), M(20, 73, 2, 0.7), M(23, 71, 5, 0.8),
          M(32, 68, 3, 0.8), M(36, 73, 2, 0.75), M(38, 78, 5, 0.85),
          M(48, 80, 3, 0.85), M(52, 78, 3, 0.8), M(56, 71, 6, 0.8),
        ],
      },
      { voice: 'gong', notes: gongCycle([0, 6, 12], [42, 49, 54], 4, 16) },
    ],
  },
  {
    id: 'pass',
    name: 'FOG ON THE PASS',
    bpm: 150,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 4, 8, 12]) },
      { voice: 'snare', notes: [M(6, 38, 1, 0.8), M(14, 38, 1, 0.9), M(22, 38, 1, 0.8), M(30, 38, 1, 0.95), M(38, 38, 1, 0.8), M(46, 38, 1, 0.9), M(54, 38, 1, 0.8), M(62, 38, 1, 1) ] },
      { voice: 'hat', notes: hats(4, 16, 1, 0.18) },
      { voice: 'bass', notes: bassLine(27, [1, 1, 0, 1, 1, 0, 8, 8, 1, 1, 0, 1, 1, 0, 6, 6], 4, 16) },
      { voice: 'pad', notes: [M(0, 39, 32, 0.3), M(32, 44, 32, 0.3)] },
      {
        voice: 'lead',
        notes: [
          M(0, 75, 2, 0.85), M(2, 78, 2, 0.8), M(4, 80, 2, 0.8), M(6, 82, 4, 0.9),
          M(16, 80, 2, 0.8), M(18, 78, 2, 0.75), M(20, 75, 4, 0.85),
          M(32, 77, 2, 0.8), M(34, 80, 2, 0.8), M(36, 84, 4, 0.9),
          M(48, 82, 2, 0.85), M(50, 78, 2, 0.8), M(52, 75, 6, 0.85),
        ],
      },
    ],
  },
  {
    id: 'ruins',
    name: 'ANG ANINO',
    bpm: 154,
    steps: 16,
    bars: 4,
    parts: [
      { voice: 'kick', notes: fourOnFloor(4, 16, [0, 3, 6, 8, 10, 13]) },
      { voice: 'snare', notes: [M(4, 38, 1, 0.9), M(12, 38, 1, 0.95), M(20, 38, 1, 0.9), M(26, 38, 1, 0.6), M(28, 38, 1, 1), M(36, 38, 1, 0.9), M(44, 38, 1, 0.95), M(52, 38, 1, 0.9), M(58, 38, 1, 0.6), M(60, 38, 1, 1)] },
      { voice: 'hat', notes: hats(4, 16, 1, 0.22) },
      { voice: 'bass', notes: bassLine(25, [1, 1, 1, 0, 8, 0, 1, 1, 1, 1, 1, 0, 6, 0, 4, 4], 4, 16) },
      { voice: 'pad', notes: [M(0, 37, 16, 0.4), M(16, 38, 16, 0.4), M(32, 37, 16, 0.4), M(48, 40, 16, 0.4)] },
      { voice: 'gong', notes: gongCycle([0, 2, 7, 11, 14], [37, 44, 48, 43, 50], 4, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 73, 2, 0.9), M(2, 74, 2, 0.85), M(4, 73, 2, 0.85), M(6, 68, 4, 0.9),
          M(16, 75, 2, 0.9), M(18, 76, 2, 0.85), M(20, 75, 4, 0.9),
          M(32, 73, 2, 0.9), M(34, 79, 2, 0.9), M(36, 80, 4, 0.95),
          M(48, 76, 2, 0.9), M(50, 73, 2, 0.85), M(52, 68, 8, 0.9),
        ],
      },
    ],
  },
  {
    id: 'victory',
    name: 'BAYANI',
    bpm: 120,
    steps: 16,
    bars: 2,
    parts: [
      { voice: 'kick', notes: fourOnFloor(2, 16, [0, 8]) },
      { voice: 'gong', notes: gongCycle([0, 8], [52, 57], 2, 16) },
      {
        voice: 'lead',
        notes: [
          M(0, 76, 3, 0.9), M(4, 79, 3, 0.9), M(8, 84, 6, 0.95),
          M(16, 83, 3, 0.9), M(20, 79, 3, 0.85), M(24, 76, 8, 0.9),
        ],
      },
      { voice: 'pad', notes: [M(0, 52, 32, 0.4)] },
    ],
  },
];

const trackMap = new Map(TRACKS.map((t) => [t.id, t]));

export class MusicManager {
  private timer: number | null = null;
  private step = 0;
  private current: Track | null = null;
  private nextTime = 0;
  private lookahead = 0.12;
  private lowpass: BiquadFilterNode | null = null;

  play(id: string): void {
    const ctx = audio.context;
    if (!ctx || !audio.musicBus) return;
    if (audio.trackId === id && this.timer !== null) return;
    this.stop();
    const t = trackMap.get(id) ?? trackMap.get('title')!;
    this.current = t;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 12000;
    this.lowpass.connect(audio.musicBus);
    audio.setTrackId(id);
    audio.setMusicStopper(() => this.stop());
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  /** duck the music (used during KO slow motion) */
  duck(on: boolean): void {
    if (!this.lowpass || !audio.context) return;
    const t = audio.context.currentTime;
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.linearRampToValueAtTime(on ? 700 : 12000, t + 0.18);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.current = null;
    if (this.lowpass) {
      try {
        this.lowpass.disconnect();
      } catch {
        /* ignore */
      }
      this.lowpass = null;
    }
    audio.setTrackId(null);
  }

  private schedule(): void {
    const ctx = audio.context;
    const t = this.current;
    if (!ctx || !t || !this.lowpass) return;
    const spb = 60 / t.bpm;
    const stepDur = (spb * 4) / t.steps;
    const total = t.bars * t.steps;

    while (this.nextTime < ctx.currentTime + this.lookahead) {
      const s = this.step % total;
      for (const part of t.parts) {
        for (const n of part.notes) {
          if (n.s !== s) continue;
          this.voice(part.voice, n, this.nextTime, stepDur);
        }
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private voice(v: Voice, n: Note, when: number, stepDur: number): void {
    const ctx = audio.context;
    if (!ctx || !this.lowpass) return;
    const out = this.lowpass;
    const dur = (n.l ?? 1) * stepDur;
    const vel = n.v ?? 1;

    switch (v) {
      case 'lead': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.13 * vel, when + 0.01);
        g.gain.setValueAtTime(0.11 * vel, when + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        const o1 = ctx.createOscillator();
        o1.type = 'square';
        o1.frequency.value = freq(n.n);
        const o2 = ctx.createOscillator();
        o2.type = 'sawtooth';
        o2.frequency.value = freq(n.n) * 1.005;
        const og = ctx.createGain();
        og.gain.value = 0.4;
        o2.connect(og);
        og.connect(g);
        o1.connect(g);
        g.connect(out);
        o1.start(when);
        o2.start(when);
        o1.stop(when + dur + 0.02);
        o2.stop(when + dur + 0.02);
        break;
      }
      case 'bass': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.2 * vel, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95);
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = freq(n.n);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        o.connect(lp);
        lp.connect(g);
        g.connect(out);
        o.start(when);
        o.stop(when + dur + 0.02);
        break;
      }
      case 'pluck': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16 * vel, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(0.5, dur * 3));
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq(n.n);
        const o2 = ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = freq(n.n + 12);
        const g2 = ctx.createGain();
        g2.gain.value = 0.3;
        o2.connect(g2);
        g2.connect(g);
        o.connect(g);
        g.connect(out);
        o.start(when);
        o2.start(when);
        o.stop(when + 0.6);
        o2.stop(when + 0.4);
        break;
      }
      case 'gong': {
        // metallic: a few inharmonic partials with a long-ish decay
        const base = freq(n.n);
        const partials = [1, 1.52, 2.13, 2.77, 3.41];
        const decay = Math.min(1.4, dur * 4 + 0.5);
        partials.forEach((p, i) => {
          const o = ctx.createOscillator();
          o.type = i === 0 ? 'sine' : 'triangle';
          o.frequency.value = base * p;
          const g = ctx.createGain();
          const amp = (0.11 * vel) / (i + 1.2);
          g.gain.setValueAtTime(amp, when);
          g.gain.exponentialRampToValueAtTime(0.0001, when + decay * (1 - i * 0.12));
          o.connect(g);
          g.connect(out);
          o.start(when);
          o.stop(when + decay + 0.05);
        });
        // strike transient
        this.noiseHit(when, 0.05, 0.12 * vel, 2600, 3);
        break;
      }
      case 'pad': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.05 * vel, when + dur * 0.25);
        g.gain.linearRampToValueAtTime(0.0001, when + dur);
        [0, 7, 12].forEach((iv, i) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = freq(n.n + iv) * (1 + i * 0.002);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1400;
          o.connect(lp);
          lp.connect(g);
          o.start(when);
          o.stop(when + dur + 0.05);
        });
        g.connect(out);
        break;
      }
      case 'kick': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, when);
        o.frequency.exponentialRampToValueAtTime(44, when + 0.11);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.34 * vel, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
        o.connect(g);
        g.connect(out);
        o.start(when);
        o.stop(when + 0.2);
        break;
      }
      case 'snare':
        this.noiseHit(when, 0.13, 0.2 * vel, 1900, 1.1);
        this.pitchBlip(when, 220, 0.06, 0.08 * vel);
        break;
      case 'hat':
        this.noiseHit(when, 0.045, 0.1 * vel, 8000, 4);
        break;
    }
  }

  private noiseHit(
    when: number,
    dur: number,
    gain: number,
    filterHz: number,
    q: number,
  ): void {
    const ctx = audio.context;
    const buf = audio.noiseBuffer;
    if (!ctx || !buf || !this.lowpass) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + Math.random() * 0.3;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = filterHz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.lowpass);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  private pitchBlip(when: number, hz: number, dur: number, gain: number): void {
    const ctx = audio.context;
    if (!ctx || !this.lowpass) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz, when);
    o.frequency.exponentialRampToValueAtTime(hz * 0.5, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.lowpass);
    o.start(when);
    o.stop(when + dur + 0.02);
  }
}

export const music = new MusicManager();

export const TRACK_NAMES: Record<string, string> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t.name]),
);
