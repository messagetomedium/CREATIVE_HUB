import { expect, test } from 'vitest';
import {
  canOccupy,
  initialPlayer,
  stepPlayer,
  NEUTRAL_INPUT,
  PLAYER_SPEED,
  FIXED_STEP_MS,
} from '@creative-factory/world-core';
import type { GameLocation } from '@creative-factory/contracts';
import { generateIsland } from './island';
import { createHouseInterior } from './house';
import { WorldStore, islandStorageKey } from './storage';
import { followAxis } from '../camera';
import { ProximityInteraction } from '../interactions';
import { avatarAnimation } from '../avatarSheet';

function reachable(world: GameLocation) {
  const start = Math.floor(world.spawn.y / 32) * world.width + Math.floor(world.spawn.x / 32),
    seen = new Set([start]),
    queue = [start];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!,
      x = i % world.width,
      y = Math.floor(i / world.width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx! < 0 || ny! < 0 || nx! >= world.width || ny! >= world.height) continue;
      const n = ny! * world.width + nx!;
      if (!seen.has(n) && canOccupy(world, { x: nx! * 32 + 16, y: ny! * 32 + 16 })) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}
test('seeded coherent islands keep a connected landmass, dry house and accessible beach/door for 40 seeds', () => {
  const shapes = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    const world = generateIsland(seed);
    expect(generateIsland(seed)).toEqual(world);
    shapes.add(JSON.stringify(world.ground));
    expect(canOccupy(world, world.spawn)).toBe(true);
    expect(canOccupy(world, world.door)).toBe(true);
    const seen = reachable(world);
    expect(
      seen.has(Math.floor(world.door.y / 32) * world.width + Math.floor(world.door.x / 32)),
    ).toBe(true);
    for (let y = 0; y < world.height; y++)
      for (let x = 0; x < world.width; x++) {
        const i = y * world.width + x;
        if (world.ground[i] === 0)
          expect(canOccupy(world, { x: x * 32 + 16, y: y * 32 + 16 })).toBe(false);
        else if (canOccupy(world, { x: x * 32 + 16, y: y * 32 + 16 }))
          expect(seen.has(i)).toBe(true);
        if (world.ground[i] === 2)
          for (const n of [i - 1, i + 1, i - world.width, i + world.width])
            expect(world.ground[n]).not.toBe(0);
      }
    for (const p of world.props)
      for (let y = p.bounds.y; y < p.bounds.y + p.bounds.height; y += 16)
        for (let x = p.bounds.x; x < p.bounds.x + p.bounds.width; x += 16)
          expect(world.ground[Math.floor(y / 32) * world.width + Math.floor(x / 32)]).not.toBe(0);
  }
  expect(shapes.size).toBe(40);
});
test('three rooms connect through genuine doorways; stairs, partitions and coast use the unchanged solver', () => {
  const world = createHouseInterior(),
    seen = reachable(world);
  for (const p of [
    { x: 12, y: 5 },
    { x: 34, y: 5 },
    { x: 24, y: 26 },
    { x: 12, y: 18 },
    { x: 35, y: 18 },
  ])
    expect(seen.has(p.y * world.width + p.x)).toBe(true);
  expect(canOccupy(world, { x: 24 * 32 + 16, y: 6 * 32 + 16 })).toBe(false);
  expect(canOccupy(world, { x: 41 * 32, y: 5 * 32 })).toBe(false);
  expect(canOccupy(world, { x: 0, y: 0 })).toBe(false);
  const initial = initialPlayer(world);
  const next = stepPlayer(initial, { ...NEUTRAL_INPUT, left: true }, world);
  expect(initial.x - next.x).toBeCloseTo((PLAYER_SPEED * FIXED_STEP_MS) / 1000);
});
test('versioned per-user saves preserve generated tiles, objects, both positions and transition/reload', () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  const a = new WorldStore('user-a', storage, 19),
    original = structuredClone(a.data.island);
  a.update('island', { ...a.position('island'), x: a.data.island.spawn.x + 32 });
  a.flush();
  const position = a.position('island');
  a.transition('house');
  const resumed = new WorldStore('user-a', storage, 99);
  expect(resumed.data.island).toEqual(original);
  expect(resumed.position('island')).toEqual(position);
  resumed.transition('island');
  expect(canOccupy(original, resumed.position('island'))).toBe(true);
  const b = new WorldStore('user-b', storage, 77);
  expect(b.data.seed).toBe(77);
  expect(a.data.seed).toBe(19);
  expect(values.size).toBe(2);
  expect([...values.keys()].every((k) => k.startsWith('creative-factory:world:v1:'))).toBe(true);
  const key = islandStorageKey('user-a'),
    raw = values.get(key)!;
  values.set(key, raw.replace('"generatorVersion":1', '"generatorVersion":999'));
  expect(() => new WorldStore('user-a', storage)).toThrow('неподдерживаемом');
  expect(values.get(key)).toContain('"generatorVersion":999');
});
test('interaction opens once on entry, respects dismissal and closes when leaving; click can reopen', () => {
  const p = new ProximityInteraction(),
    door = { x: 100, y: 100 };
  p.update(door, door);
  expect(p.opened).toBe('approach');
  p.close();
  p.update(door, door);
  expect(p.opened).toBeUndefined();
  p.click();
  expect(p.opened).toBe('click');
  p.update({ x: 900, y: 100 }, door);
  expect(p.opened).toBe('click');
  p.close();
  p.update(door, door);
  expect(p.opened).toBe('approach');
  p.update({ x: 900, y: 100 }, door);
  expect(p.opened).toBeUndefined();
});
test('camera integrates floating target with frame-rate-independent easing and pixel-aligned output', () => {
  const run = (frames: number) => {
    let current = 0;
    for (let i = 0; i < frames; i++) current = followAxis(current, 100, 1000 / frames, 2).value;
    return current;
  };
  expect(run(30)).toBeCloseTo(run(60), 2);
  let current = 0,
    last = 0;
  for (let i = 0; i < 300; i++) {
    const next = followAxis(current, i < 90 ? i : 90, 16.666, 2);
    expect((next.display * 2) % 1).toBe(0);
    expect(next.display - last).toBeLessThanOrEqual(1.5);
    expect(next.display).toBeGreaterThanOrEqual(last);
    current = next.value;
    last = next.display;
  }
  expect(last).toBe(90);
});
test('game animation uses editor frame numbers and exact held timings for every direction', () => {
  for (const [row, direction] of (['north', 'east', 'south', 'west'] as const).entries()) {
    expect(avatarAnimation(direction, 'idle')).toEqual([
      { frame: row * 6, duration: 500 },
      { frame: row * 6 + 1, duration: 500 },
    ]);
    expect(avatarAnimation(direction, 'walk')).toEqual(
      [125, 175, 125, 175].map((duration, i) => ({ frame: row * 6 + 2 + i, duration })),
    );
  }
});
