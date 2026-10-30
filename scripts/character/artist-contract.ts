/** Five artist canvases, independent of renderer implementation and saved avatar schemas. */
import { COMPACT_VERSION, COMPACT_SPECS, SOURCE_VIEWS } from './compact-contract';
export const ARTIST_VERSION = COMPACT_VERSION;
export const ARTIST_BUILDS = ['very-slim', 'slim', 'average', 'sturdy'] as const;
export const ARTIST_VIEWS = { full: SOURCE_VIEWS, pair: SOURCE_VIEWS.slice(0, 3) };
export type ArtistMode = keyof typeof ARTIST_VIEWS;
export const ARTIST_TEMPLATES = Object.entries(COMPACT_SPECS).map(([id, spec]) => ({
  ...spec,
  id,
  category: id.toLowerCase(),
  modes: [id === 'SHOES' ? ('pair' as const) : ('full' as const)],
}));
export const ARTIST_LOWER = { bandTop: 8, bandBottom: 16, legSplit: 24, floor: 50 };
export function artistLegX(direction: string, index: number) {
  return direction === 'east' || direction === 'west'
    ? 42
    : direction === 'north'
      ? index === 0
        ? 48
        : 32
      : index === 0
        ? 32
        : 48;
}
export function artistHairLayer(x: number, y: number, direction: string) {
  if (direction === 'north' || y < 54) return 'front';
  if (direction === 'east') return x >= 48 ? 'front' : 'back';
  if (direction === 'west') return x < 48 ? 'front' : 'back';
  return (x >= 28 && x < 40) || (x >= 56 && x < 68) ? 'front' : 'back';
}
