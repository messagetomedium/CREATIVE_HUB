import type { Direction } from '@creative-factory/contracts';
export const LOWER_LAYOUT = {
  bandTop: 8,
  bandBottom: 16,
  legSplit: 24,
  maxHem: 50,
  shortHem: 34,
  legFrame: { width: 32, height: 40, anchor: { x: 16, y: 4 } },
} as const;
export function hairLayer(x: number, y: number, direction: Direction): 'front' | 'back' {
  if (direction === 'north' || y < 54) return 'front';
  if (direction === 'east') return x >= 48 ? 'front' : 'back';
  if (direction === 'west') return x < 48 ? 'front' : 'back';
  return (x >= 28 && x < 40) || (x >= 56 && x < 68) ? 'front' : 'back';
}
export function lowerLegSourceX(direction: Direction, index: number): number {
  if (direction === 'east') return 42;
  if (direction === 'west') return 38;
  return index === 0 ? 31 : 49;
}
