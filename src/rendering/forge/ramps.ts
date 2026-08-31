// ============================================================================
// Palette -> shading ramps. Each material gets a 5-step ramp so sprites read
// with real volume (32-bit era shading) while staying index-quantised.
// ============================================================================

import { hex, ramp5, shade, mix, type RGBA } from '../Raster';
import type { Palette } from '../BodyPlans';

export interface Ramps {
  skin: RGBA[];
  skinShadow: RGBA[];
  hair: RGBA[];
  cloth: RGBA[];
  clothAlt: RGBA[];
  accent: RGBA[];
  accent2: RGBA[];
  metal: RGBA[];
  metalDark: RGBA[];
  leather: RGBA[];
  wood: RGBA[];
  outline: RGBA;
  outlineSoft: RGBA;
  eye: RGBA;
  eyeDark: RGBA;
  mouth: RGBA;
  aura: RGBA;
  auraLite: RGBA;
  white: RGBA;
  black: RGBA;
}

export function buildRamps(pal: Palette): Ramps {
  const skinBase = hex(pal.skin);
  const skin = [
    shade(hex(pal.skinDark), -0.28),
    hex(pal.skinDark),
    mix(hex(pal.skinDark), skinBase, 0.55),
    skinBase,
    shade(skinBase, 0.22),
    shade(skinBase, 0.42),
  ];
  const metalBase = hex(pal.metal);
  const metal = [
    hex(pal.metalDark),
    mix(hex(pal.metalDark), metalBase, 0.45),
    metalBase,
    shade(metalBase, 0.3),
    shade(metalBase, 0.62),
    shade(metalBase, 0.88),
  ];
  return {
    skin,
    skinShadow: skin.map((c) => shade(c, -0.24)),
    hair: ramp5(pal.hair, 1.3),
    cloth: ramp5(pal.cloth, 1.05),
    clothAlt: ramp5(pal.clothAlt, 1.05),
    accent: ramp5(pal.accent, 0.9),
    accent2: ramp5(pal.accent2, 0.7),
    metal,
    metalDark: ramp5(pal.metalDark, 1.1),
    leather: ramp5(pal.leather, 1.1),
    wood: ramp5('#6b4a28', 1.1),
    outline: hex(pal.outline),
    outlineSoft: shade(hex(pal.outline), 0.22),
    eye: hex(pal.eye),
    eyeDark: shade(hex(pal.outline), 0.1),
    mouth: shade(hex(pal.skinDark), -0.45),
    aura: hex(pal.aura),
    auraLite: shade(hex(pal.aura), 0.5),
    white: hex('#ffffff'),
    black: hex('#000000'),
  };
}

const cache = new Map<Palette, Ramps>();

export function ramps(pal: Palette): Ramps {
  let r = cache.get(pal);
  if (!r) {
    r = buildRamps(pal);
    cache.set(pal, r);
  }
  return r;
}
