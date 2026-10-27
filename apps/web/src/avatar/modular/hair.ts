import type { Direction } from '@creative-factory/contracts';
// The generated test artwork has different skull centres in its cells. These are
// source-pixel attachment corrections, not changes to the universal head/rig.
// Symmetric profiles reuse E; the old authored W cells had inconsistent registration.
export function hairPlacement(slot: number, direction: Direction) {
  const side = direction === 'east' || direction === 'west';
  return {
    row: direction === 'north' ? 0 : side ? 1 : 2,
    mirror: direction === 'west',
    anchor: {
      x: slot <= 2 ? (side ? 19 : direction === 'north' ? 17 : 18) : side ? 17 : 16,
      y: direction === 'north' ? 19 : side ? 22 : 23,
    },
    scaleY:
      slot === 2
        ? direction === 'north'
          ? 28 / 32
          : 24 / 32
        : slot === 1
          ? side
            ? 26 / 32
            : direction === 'south'
              ? 28 / 32
              : 1
          : 1,
  };
}
