import type { GameLocation } from '@creative-factory/contracts';
import { terrainAt } from './terrain';
export const ISLAND_CONFIG = { width: 56, height: 48, tileSize: 32 } as const;
export const GENERATOR_VERSION = 1;
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateIsland(
  seed: number,
  config: { width: number; height: number } = ISLAND_CONFIG,
): GameLocation {
  const { width, height } = config;
  if (width < 40 || height < 36 || width > 128 || height > 128)
    throw new Error('Недопустимый размер острова');
  const random = seededRandom(seed),
    cx = Math.floor(width / 2),
    cy = Math.floor(height / 2);
  const phases = Array.from({ length: 5 }, () => random() * Math.PI * 2);
  const noise = Array.from({ length: 64 }, () => random());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const valueNoise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      tx = smooth(x - ix),
      ty = smooth(y - iy);
    const at = (a: number, b: number) => noise[(b % 8) * 8 + (a % 8)]!;
    return (
      (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) +
      (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty
    );
  };
  let land = Array.from({ length: width * height }, (_, i) => {
    const x = i % width,
      y = Math.floor(i / width),
      dx = (x - cx) / (width * 0.36),
      dy = (y - cy) / (height * 0.34);
    const angle = Math.atan2(dy, dx);
    const radius =
      1 +
      0.1 * Math.sin(3 * angle + phases[0]!) +
      0.075 * Math.sin(5 * angle + phases[1]!) +
      0.04 * Math.cos(2 * angle + phases[2]!);
    return Math.hypot(dx, dy) < radius + (valueNoise(x / 8, y / 8) - 0.5) * 0.18;
  });
  // Neighbour smoothing, protected central clearing, then retain only the main landmass.
  for (let pass = 0; pass < 2; pass++)
    land = land.map((_, i) => {
      const x = i % width,
        y = Math.floor(i / width);
      if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3) return false;
      if (Math.hypot((x - cx) / 9, (y - cy) / 7) < 1) return true;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) count += Number(land[(y + dy) * width + x + dx]);
      return count >= 5;
    });
  const neighbours = (i: number) =>
    [
      i - width,
      i + width,
      ...(i % width ? [i - 1] : []),
      ...(i % width < width - 1 ? [i + 1] : []),
    ].filter((n) => n >= 0 && n < land.length);
  const flood = (start: number, match: (i: number) => boolean) => {
    const found = new Set<number>([start]),
      queue = [start];
    for (let k = 0; k < queue.length; k++)
      for (const n of neighbours(queue[k]!))
        if (!found.has(n) && match(n)) {
          found.add(n);
          queue.push(n);
        }
    return found;
  };
  const connected = flood(cy * width + cx, (i) => land[i]!);
  land = land.map((_, i) => connected.has(i));
  const sea = flood(0, (i) => !land[i]);
  land = land.map((v, i) => v || !sea.has(i));
  const distance: number[] = land.map((v) => (v ? 999 : 0)),
    queue = distance.flatMap((v, i) => (v === 0 ? [i] : []));
  for (let k = 0; k < queue.length; k++)
    for (const n of neighbours(queue[k]!))
      if (distance[n]! > distance[queue[k]!]! + 1) {
        distance[n] = distance[queue[k]!]! + 1;
        queue.push(n);
      }
  const ground = land.map((v, i) => {
    if (!v) return 0;
    const x = i % width,
      y = Math.floor(i / width);
    if (distance[i]! <= 1 + Number(valueNoise(x / 7, y / 7) > 0.58)) return 1;
    const yard =
      Math.hypot((x - cx) / 5.6, (y - (cy + 1)) / 4.4) + (valueNoise(x / 5, y / 5) - 0.5) * 0.4;
    return yard < 1 || valueNoise(x / 7, y / 6) > 0.74 ? 3 : 2;
  });
  const bounds = { x: (cx - 3) * 32, y: (cy - 3) * 32, width: 192, height: 96 };
  const door = { x: cx * 32, y: cy * 32 + 4 };
  return {
    id: 'island',
    width,
    height,
    tileSize: 32,
    ground,
    solids: ground.map((id) => !terrainAt(id).walkable),
    spawn: { x: door.x, y: door.y + 100 },
    door,
    zones: [
      {
        id: 'island',
        name: 'Мой остров',
        description: '',
        accent: '#83b86c',
        bounds: { x: 0, y: 0, width: width * 32, height: height * 32 },
        priority: 0,
      },
    ],
    // A shallow walkable door recess stays separate from the building walls.
    props: [
      { id: 'house-back', solid: true, bounds: { ...bounds, height: 80 } },
      {
        id: 'house-left',
        solid: true,
        bounds: { x: bounds.x, y: bounds.y + 80, width: 72, height: 16 },
      },
      {
        id: 'house-right',
        solid: true,
        bounds: { x: bounds.x + 120, y: bounds.y + 80, width: 72, height: 16 },
      },
    ],
    objects: [{ id: 'home', kind: 'house', bounds }],
  };
}
