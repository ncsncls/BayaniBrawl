// ============================================================================
// Keyboard + touch input sources feeding InputBuffer sets.
// ============================================================================

import type { Btn } from './InputBuffer';

export type KeyMap = Record<string, Btn>;

export const DEFAULT_P1: KeyMap = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'special',
  KeyI: 'grab',
  ShiftLeft: 'block',
  ShiftRight: 'block',
  Space: 'super',
};

export const DEFAULT_P2: KeyMap = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Numpad1: 'light',
  Numpad2: 'heavy',
  Numpad3: 'special',
  Numpad5: 'grab',
  Numpad0: 'block',
  NumpadEnter: 'super',
};

export const REMAPPABLE: Array<{ btn: Btn; label: string }> = [
  { btn: 'left', label: 'MOVE LEFT' },
  { btn: 'right', label: 'MOVE RIGHT' },
  { btn: 'up', label: 'JUMP' },
  { btn: 'down', label: 'CROUCH' },
  { btn: 'light', label: 'LIGHT ATTACK' },
  { btn: 'heavy', label: 'HEAVY ATTACK' },
  { btn: 'special', label: 'SPECIAL' },
  { btn: 'grab', label: 'GRAB' },
  { btn: 'block', label: 'BLOCK' },
  { btn: 'super', label: 'SUPER' },
];

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  if (code.startsWith('Arrow')) {
    const d = code.slice(5);
    return { Left: '←', Right: '→', Up: '↑', Down: '↓' }[d] ?? d;
  }
  switch (code) {
    case 'ShiftLeft':
      return 'L-SHIFT';
    case 'ShiftRight':
      return 'R-SHIFT';
    case 'Space':
      return 'SPACE';
    case 'ControlLeft':
      return 'L-CTRL';
    case 'ControlRight':
      return 'R-CTRL';
    case 'AltLeft':
      return 'L-ALT';
    case 'AltRight':
      return 'R-ALT';
    case 'Enter':
      return 'ENTER';
    case 'Backslash':
      return '\\';
    case 'Slash':
      return '/';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    default:
      return code.toUpperCase();
  }
}

/**
 * Global keyboard listener. Owns the raw key state; the game reads
 * `stateFor(map)` once per frame.
 */
export class KeyboardInput {
  private down = new Set<string>();
  /** codes pressed this poll cycle (cleared by consumeEdges) */
  private edges = new Set<string>();
  private onKey?: (code: string, e: KeyboardEvent) => void;
  private bound = false;

  private keydown = (e: KeyboardEvent) => {
    if (e.repeat) {
      // still notify menus for held-repeat navigation
      this.onKey?.(e.code, e);
      return;
    }
    this.down.add(e.code);
    this.edges.add(e.code);
    this.onKey?.(e.code, e);
    if (PREVENT.has(e.code)) e.preventDefault();
  };

  private keyup = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private blur = () => {
    this.down.clear();
  };

  attach(): void {
    if (this.bound) return;
    window.addEventListener('keydown', this.keydown, { passive: false });
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    this.bound = true;
  }

  detach(): void {
    if (!this.bound) return;
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    this.bound = false;
    this.down.clear();
  }

  setKeyListener(fn?: (code: string, e: KeyboardEvent) => void): void {
    this.onKey = fn;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  stateFor(map: KeyMap): Set<Btn> {
    const out = new Set<Btn>();
    for (const code in map) {
      if (this.down.has(code)) out.add(map[code]);
    }
    return out;
  }

  clear(): void {
    this.down.clear();
    this.edges.clear();
  }
}

const PREVENT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Numpad0',
  'NumpadEnter',
]);

export const keyboard = new KeyboardInput();

// ---------------------------------------------------------------------------
// Touch: a shared mutable set the on-screen pad writes into.
// ---------------------------------------------------------------------------

export class TouchInput {
  private active = new Set<Btn>();
  /** id -> button, so multi-touch releases correctly */
  private byPointer = new Map<number, Btn>();
  enabled = false;

  press(id: number, btn: Btn): void {
    const old = this.byPointer.get(id);
    if (old === btn) return;
    if (old) this.releaseBtn(old);
    this.byPointer.set(id, btn);
    this.active.add(btn);
  }

  /** For the analog pad: set several directions at once for one pointer. */
  pressDirs(id: number, dirs: Btn[]): void {
    // clear previous dirs owned by this pointer
    const key = -id - 1000;
    const prev = this.dirOwners.get(key);
    if (prev) for (const d of prev) this.active.delete(d);
    this.dirOwners.set(key, dirs);
    for (const d of dirs) this.active.add(d);
  }

  releaseDirs(id: number): void {
    const key = -id - 1000;
    const prev = this.dirOwners.get(key);
    if (prev) for (const d of prev) this.active.delete(d);
    this.dirOwners.delete(key);
  }

  private dirOwners = new Map<number, Btn[]>();

  release(id: number): void {
    const b = this.byPointer.get(id);
    if (b) {
      this.byPointer.delete(id);
      this.releaseBtn(b);
    }
    this.releaseDirs(id);
  }

  private releaseBtn(b: Btn): void {
    // only drop if no other pointer holds it
    for (const v of this.byPointer.values()) if (v === b) return;
    this.active.delete(b);
  }

  state(): Set<Btn> {
    return new Set(this.active);
  }

  clear(): void {
    this.active.clear();
    this.byPointer.clear();
    this.dirOwners.clear();
  }
}

export const touch = new TouchInput();

/** Merge keyboard + touch for player 1. */
export function mergeState(a: Set<Btn>, b: Set<Btn>): Set<Btn> {
  if (!b.size) return a;
  const out = new Set(a);
  for (const v of b) out.add(v);
  return out;
}

export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}
