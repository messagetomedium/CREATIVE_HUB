import type { GameLocation } from '@creative-factory/contracts';
export function createHouseInterior(): GameLocation {
  const width = 48,
    height = 36;
  const solids = Array.from({ length: width * height }, (_, i) => {
    const x = i % width,
      y = Math.floor(i / width);
    if (x < 2 || x > 45 || y < 2 || y > 33) return true;
    if (y === 18 && !((x >= 11 && x <= 13) || (x >= 34 && x <= 36))) return true;
    return x === 24 && y >= 2 && y < 18;
  });
  const room = (id: string, name: string, x: number, y: number, w: number, h: number) => ({
    id,
    name,
    description: '',
    accent: '#cdb28c',
    bounds: { x: x * 32, y: y * 32, width: w * 32, height: h * 32 },
    priority: 1,
  });
  return {
    id: 'house',
    width,
    height,
    tileSize: 32,
    solids,
    ground: solids.map(() => 4),
    spawn: { x: 24 * 32, y: 32 * 32 },
    door: { x: 24 * 32, y: 33 * 32 + 8 },
    zones: [
      room('entry', 'Дом · прихожая', 2, 19, 44, 15),
      room('room-left', 'Дом · левая комната', 2, 2, 22, 17),
      room('room-right', 'Дом · правая комната', 25, 2, 21, 17),
    ],
    props: [
      { id: 'stairs', solid: true, bounds: { x: 40 * 32, y: 4 * 32, width: 64, height: 128 } },
    ],
    objects: [
      { id: 'stairs', kind: 'stairs', bounds: { x: 40 * 32, y: 4 * 32, width: 64, height: 128 } },
    ],
  };
}
