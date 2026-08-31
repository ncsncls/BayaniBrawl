// ============================================================================
// Input: logical buttons, buffered presses, and motion recognition.
// One InputBuffer per player. The game logic never touches the keyboard.
// ============================================================================

import { BALANCE } from '../data/balance';

export type Btn =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'light'
  | 'heavy'
  | 'special'
  | 'grab'
  | 'block'
  | 'super';

export const ALL_BTNS: Btn[] = [
  'up',
  'down',
  'left',
  'right',
  'light',
  'heavy',
  'special',
  'grab',
  'block',
  'super',
];

/** Direction as seen by the fighter (already flipped for facing). */
export type Dir = 'n' | 'f' | 'b' | 'u' | 'd' | 'df' | 'db' | 'uf' | 'ub';

export interface InputState {
  held: Set<Btn>;
  /** buttons that went down this frame */
  pressed: Set<Btn>;
  released: Set<Btn>;
}

export interface BufferedPress {
  btn: Btn;
  /** frames since the press */
  age: number;
}

export interface MotionEntry {
  dir: Dir;
  age: number;
}

export class InputBuffer {
  held = new Set<Btn>();
  private prev = new Set<Btn>();
  pressed = new Set<Btn>();
  released = new Set<Btn>();

  /** recent button presses that have not been consumed yet */
  private buffer: BufferedPress[] = [];
  /** recent directional states, newest first */
  private motion: MotionEntry[] = [];
  /** input display log (newest first) - training mode */
  log: Array<{ dir: Dir; btns: Btn[]; frames: number }> = [];

  private lastDir: Dir = 'n';

  /** external systems (touch / keyboard) set this each frame */
  setHeld(next: Set<Btn>): void {
    this.prev = this.held;
    this.held = next;
  }

  /** Called once per game frame, after setHeld. */
  update(facing: 1 | -1): void {
    this.pressed.clear();
    this.released.clear();
    for (const b of this.held) if (!this.prev.has(b)) this.pressed.add(b);
    for (const b of this.prev) if (!this.held.has(b)) this.released.add(b);

    // age + expire buffered presses
    for (const p of this.buffer) p.age++;
    while (this.buffer.length && this.buffer[0].age > BALANCE.inputBuffer) {
      this.buffer.shift();
    }
    for (const b of this.pressed) {
      if (b === 'up' || b === 'down' || b === 'left' || b === 'right') continue;
      this.buffer.push({ btn: b, age: 0 });
    }

    // directions relative to facing
    const dir = this.dirFor(facing);
    for (const m of this.motion) m.age++;
    while (this.motion.length && this.motion[this.motion.length - 1].age > BALANCE.motionWindow) {
      this.motion.pop();
    }
    if (dir !== this.lastDir) {
      this.motion.unshift({ dir, age: 0 });
      this.lastDir = dir;
    }

    // input display
    const btns = [...this.pressed].filter(
      (b) => b !== 'up' && b !== 'down' && b !== 'left' && b !== 'right',
    );
    if (btns.length || dir !== (this.log[0]?.dir ?? 'n')) {
      this.log.unshift({ dir, btns, frames: 1 });
      if (this.log.length > 14) this.log.pop();
    } else if (this.log[0]) {
      this.log[0].frames++;
    }
  }

  dirFor(facing: 1 | -1): Dir {
    const l = this.held.has('left');
    const r = this.held.has('right');
    const u = this.held.has('up');
    const d = this.held.has('down');
    const fwd = facing === 1 ? r : l;
    const back = facing === 1 ? l : r;
    if (u && fwd) return 'uf';
    if (u && back) return 'ub';
    if (d && fwd) return 'df';
    if (d && back) return 'db';
    if (u) return 'u';
    if (d) return 'd';
    if (fwd) return 'f';
    if (back) return 'b';
    return 'n';
  }

  /** raw forward/back axis, -1..1 */
  axis(facing: 1 | -1): number {
    const l = this.held.has('left') ? 1 : 0;
    const r = this.held.has('right') ? 1 : 0;
    const raw = r - l;
    return raw * facing;
  }

  /** Is a button held right now? */
  isHeld(b: Btn): boolean {
    return this.held.has(b);
  }

  /** Was a button pressed within the buffer window and not yet consumed? */
  has(b: Btn): boolean {
    return this.buffer.some((p) => p.btn === b);
  }

  /** Consume a buffered press (returns true if it was there). */
  consume(b: Btn): boolean {
    const i = this.buffer.findIndex((p) => p.btn === b);
    if (i < 0) return false;
    this.buffer.splice(i, 1);
    return true;
  }

  clearBuffer(): void {
    this.buffer.length = 0;
  }

  /**
   * Motion recognition. `seq` is oldest-first, e.g. ['d','df','f'] or ['f','f'].
   * A motion matches if its entries appear in order within the motion window,
   * allowing 'n' (neutral) gaps between them.
   */
  motionMatch(seq: Dir[]): boolean {
    if (!seq.length) return true;
    let idx = seq.length - 1;
    for (const m of this.motion) {
      if (m.age > BALANCE.motionWindow) break;
      const want = seq[idx];
      if (m.dir === want || dirLoose(m.dir, want)) {
        idx--;
        if (idx < 0) return true;
      }
    }
    return false;
  }

  /** double-tap of a direction (dash) */
  doubleTap(dir: Dir): boolean {
    let count = 0;
    let sawNeutral = false;
    for (const m of this.motion) {
      if (m.age > 12) break;
      if (m.dir === dir) {
        count++;
        if (count >= 2 && sawNeutral) return true;
      } else if (m.dir === 'n' || m.dir === 'u' || m.dir === 'd') {
        if (count >= 1) sawNeutral = true;
      } else {
        break;
      }
    }
    return false;
  }

  reset(): void {
    this.held.clear();
    this.prev.clear();
    this.pressed.clear();
    this.released.clear();
    this.buffer.length = 0;
    this.motion.length = 0;
    this.log.length = 0;
    this.lastDir = 'n';
  }
}

/** treat diagonals as matching their cardinal components */
function dirLoose(actual: Dir, want: Dir): boolean {
  if (want === 'd') return actual === 'df' || actual === 'db';
  if (want === 'f') return actual === 'df' || actual === 'uf';
  if (want === 'b') return actual === 'db' || actual === 'ub';
  if (want === 'u') return actual === 'uf' || actual === 'ub';
  return false;
}

export const MOTIONS = {
  qcf: ['d', 'df', 'f'] as Dir[],
  qcb: ['d', 'db', 'b'] as Dir[],
  dpf: ['f', 'd', 'df'] as Dir[],
  ff: ['f', 'f'] as Dir[],
  bb: ['b', 'b'] as Dir[],
  dd: ['d', 'd'] as Dir[],
  df: ['d', 'f'] as Dir[],
  db: ['d', 'b'] as Dir[],
  fd: ['f', 'd'] as Dir[],
  superM: ['d', 'f', 'd', 'f'] as Dir[],
};

export const DIR_ARROW: Record<Dir, string> = {
  n: '·',
  f: '→',
  b: '←',
  u: '↑',
  d: '↓',
  df: '↘',
  db: '↙',
  uf: '↗',
  ub: '↖',
};

export const BTN_LABEL: Record<Btn, string> = {
  up: 'U',
  down: 'D',
  left: 'L',
  right: 'R',
  light: 'L',
  heavy: 'H',
  special: 'S',
  grab: 'G',
  block: 'B',
  super: 'X',
};
