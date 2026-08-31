// ============================================================================
// Shared normal-attack kit builder.
// Each fighter gets 9 normals from this builder, scaled by its own reach,
// speed and damage profile, then adds hand-written specials + super.
// Boxes are in LOCAL space: x = forward offset from the fighter's origin,
// y = height above the feet (bottom edge of the box).
// ============================================================================

import type { AttackDef, HitFx } from '../game/types';
import { mv } from './moveFactory';

export interface KitOpts {
  /** multiplies every hitbox's forward reach */
  reach: number;
  /** multiplies damage */
  dmg: number;
  /** subtracted from startup frames (positive = faster) */
  fast: number;
  /** primary hit effect for weapon normals */
  fx: HitFx;
  /** animation used for the heavy: 'slash' for weapons, 'strong' for blunt */
  heavyAnim?: string;
  /** launcher animation */
  launchAnim?: string;
  /** name overrides */
  names?: Partial<Record<KitKey, string>>;
}

export type KitKey =
  | 'l1'
  | 'l2'
  | 'l3'
  | 'cl'
  | 'h1'
  | 'h2'
  | 'sweep'
  | 'over'
  | 'launch'
  | 'airL'
  | 'airH'
  | 'throwF';

const F = (n: number, fast: number) => Math.max(3, Math.round(n - fast));

export function buildKit(o: KitOpts): Record<string, AttackDef> {
  const R = o.reach;
  const D = o.dmg;
  const fx = o.fx;
  const heavyAnim = o.heavyAnim ?? 'strong';
  const launchAnim = o.launchAnim ?? 'launcher';
  const nm = (k: KitKey, d: string) => o.names?.[k] ?? d;
  const dz = (n: number) => Math.round(n * D);

  return {
    // --- light chain -------------------------------------------------------
    l1: mv({
      id: 'l1',
      name: nm('l1', 'Quick Strike'),
      anim: 'jab',
      notation: 'LIGHT',
      startup: F(5, o.fast),
      active: 3,
      recovery: 7,
      cancels: ['l2', 'cl', 'h1', 'sweep', 'launch', 'sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [16 * R, 52, 30 * R, 20],
          dmg: dz(4),
          h: 'mid',
          fx,
          stop: 3,
          kbx: 1.6,
          push: 0.9,
        },
      ],
      desc: 'Fast poke. Chains into everything.',
    }),

    l2: mv({
      id: 'l2',
      name: nm('l2', 'Follow Strike'),
      anim: 'jab2',
      notation: 'LIGHT, LIGHT',
      startup: F(6, o.fast),
      active: 3,
      recovery: 9,
      cancels: ['l3', 'cl', 'h1', 'h2', 'sweep', 'launch', 'sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [18 * R, 50, 32 * R, 22],
          dmg: dz(5),
          h: 'mid',
          fx,
          stop: 3,
          kbx: 2.0,
        },
      ],
      desc: 'Second light. Still cancels into heavies.',
    }),

    l3: mv({
      id: 'l3',
      name: nm('l3', 'Chain Finisher'),
      anim: 'strong',
      notation: 'LIGHT, LIGHT, LIGHT',
      startup: F(8, o.fast),
      active: 4,
      recovery: 14,
      cancels: ['sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [20 * R, 46, 36 * R, 30],
          dmg: dz(8),
          h: 'mid',
          fx,
          stop: 4,
          kbx: 3.4,
          hs: 20,
        },
      ],
      desc: 'Ends the light chain. Special-cancel only.',
    }),

    // --- crouching light ---------------------------------------------------
    cl: mv({
      id: 'cl',
      name: nm('cl', 'Low Jab'),
      anim: 'lowJab',
      notation: 'CROUCH + LIGHT',
      startup: F(6, o.fast),
      active: 3,
      recovery: 8,
      crouchOnly: true,
      cancels: ['cl', 'sweep', 'launch', 'sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [14 * R, 8, 30 * R, 22],
          dmg: dz(4),
          h: 'low',
          fx,
          stop: 3,
          kbx: 1.4,
        },
      ],
      desc: 'Must be blocked low. Loops once into itself.',
    }),

    // --- heavies -----------------------------------------------------------
    h1: mv({
      id: 'h1',
      name: nm('h1', 'Heavy Strike'),
      anim: heavyAnim,
      notation: 'HEAVY',
      startup: F(10, o.fast * 0.5),
      active: 4,
      recovery: 16,
      cancels: ['h2', 'sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [20 * R, 44, 42 * R, 34],
          dmg: dz(11),
          h: 'mid',
          fx,
          stop: 5,
          kbx: 4.0,
          hs: 22,
        },
      ],
      desc: 'Main damage tool. Cancels into specials.',
    }),

    h2: mv({
      id: 'h2',
      name: nm('h2', 'Heavy Finisher'),
      anim: 'slash',
      notation: 'HEAVY, HEAVY',
      startup: F(12, o.fast * 0.5),
      active: 5,
      recovery: 20,
      cancels: ['sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [22 * R, 40, 46 * R, 40],
          dmg: dz(14),
          h: 'mid',
          fx,
          stop: 6,
          kbx: 5.2,
          hs: 24,
          knockdown: true,
        },
      ],
      desc: 'Knocks down. Ends most ground combos.',
    }),

    sweep: mv({
      id: 'sweep',
      name: nm('sweep', 'Sweep'),
      anim: 'lowSweep',
      notation: 'CROUCH + HEAVY',
      startup: F(10, o.fast * 0.5),
      active: 4,
      recovery: 22,
      crouchOnly: true,
      cancels: ['sp1', 'sp2', 'sp3', 'super'],
      hits: [
        {
          box: [16 * R, 2, 44 * R, 20],
          dmg: dz(10),
          h: 'low',
          fx,
          stop: 5,
          kbx: 3.2,
          knockdown: true,
          hs: 24,
        },
      ],
      desc: 'Low knockdown. Punishable on block.',
    }),

    over: mv({
      id: 'over',
      name: nm('over', 'Overhead'),
      anim: 'airAttack',
      notation: 'FORWARD + HEAVY',
      startup: F(17, 0),
      active: 4,
      recovery: 18,
      move: [[0, 1.6], [6, 2.2]],
      cancels: ['sp1', 'sp2', 'super'],
      hits: [
        {
          box: [18 * R, 56, 38 * R, 34],
          dmg: dz(10),
          h: 'overhead',
          fx,
          stop: 5,
          kbx: 3.0,
          hs: 22,
        },
      ],
      desc: 'Overhead: must be blocked standing. Slow but opens up crouchers.',
    }),

    // --- launcher ----------------------------------------------------------
    launch: mv({
      id: 'launch',
      name: nm('launch', 'Launcher'),
      anim: launchAnim,
      notation: 'UP + HEAVY',
      startup: F(11, 0),
      active: 4,
      recovery: 24,
      cancels: ['super'],
      hits: [
        {
          box: [12 * R, 40, 34 * R, 58],
          dmg: dz(9),
          h: 'mid',
          fx,
          stop: 6,
          kbx: 1.4,
          kby: 9.4,
          launcher: true,
          antiAir: true,
          hs: 30,
        },
      ],
      desc: 'Launches into the air. Follow with air attacks for a juggle.',
    }),

    // --- air normals -------------------------------------------------------
    airL: mv({
      id: 'airL',
      name: nm('airL', 'Air Light'),
      anim: 'airAttack',
      notation: 'AIR + LIGHT',
      startup: F(6, o.fast),
      active: 5,
      recovery: 8,
      airOnly: true,
      cancels: ['airH', 'super'],
      hits: [
        {
          box: [16 * R, 30, 32 * R, 30],
          dmg: dz(5),
          h: 'overhead',
          fx,
          stop: 3,
          kbx: 1.6,
          kby: 1.2,
          antiAir: true,
        },
      ],
      desc: 'Air-to-air and juggle filler.',
    }),

    airH: mv({
      id: 'airH',
      name: nm('airH', 'Air Heavy'),
      anim: 'slash',
      notation: 'AIR + HEAVY',
      startup: F(9, o.fast * 0.5),
      active: 5,
      recovery: 12,
      airOnly: true,
      cancels: ['super'],
      hits: [
        {
          box: [18 * R, 24, 38 * R, 38],
          dmg: dz(11),
          h: 'overhead',
          fx,
          stop: 5,
          kbx: 3.4,
          kby: -2.4,
          antiAir: true,
          knockdown: true,
        },
      ],
      desc: 'Juggle ender. Slams the opponent down.',
    }),

    // --- throw -------------------------------------------------------------
    throwF: mv({
      id: 'throwF',
      name: nm('throwF', 'Throw'),
      kind: 'throw',
      anim: 'grab',
      notation: 'GRAB',
      startup: 5,
      active: 3,
      recovery: 20,
      hits: [],
      throwDef: {
        escapeWindow: 14,
        damage: dz(16),
        duration: 34,
        impactFrame: 18,
        kbx: 5.0,
        kby: 3.0,
        meter: 16,
        swap: false,
      },
      desc: 'Beats blocking. Mash GRAB to escape one.',
    }),
  };
}
