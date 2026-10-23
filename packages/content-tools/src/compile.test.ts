import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canOccupy, zoneAt } from '@creative-factory/world-core';
import { AvatarCatalogSchema } from '@creative-factory/contracts';
import { compileMap } from './compile.js';
const source = JSON.parse(readFileSync('content/maps/factory.tmj', 'utf8'));
const workshops = JSON.parse(readFileSync('content/maps/workshops.json', 'utf8'));
describe('authored factory content', () => {
  it('has a clear spawn and a traversable path to every workshop', () => {
    const world = compileMap(source, workshops),
      visited = new Set<string>(),
      queue = [world.spawn];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [
        [32, 0],
        [-32, 0],
        [0, 32],
        [0, -32],
      ]) {
        const next = { x: p.x + dx!, y: p.y + dy! },
          key = `${next.x},${next.y}`;
        if (!visited.has(key) && canOccupy(world, next)) {
          visited.add(key);
          queue.push(next);
        }
      }
    }
    expect(world.workshops).toHaveLength(4);
    expect(zoneAt(world, world.spawn)?.id).toBe('hall');
    for (const workshop of world.workshops)
      expect(queue.some((p) => zoneAt(world, p)?.id === workshop.id)).toBe(true);
  });
  it('rejects isometric and infinite maps', () => {
    expect(() => compileMap({ ...source, orientation: 'isometric' }, workshops)).toThrow();
    expect(() => compileMap({ ...source, infinite: true }, workshops)).toThrow();
  });
  it('rejects malformed layer data and duplicate identifiers', () => {
    const broken = structuredClone(source);
    broken.layers[0].data.pop();
    expect(() => compileMap(broken, workshops)).toThrow('Некорректный слой');
    expect(() => compileMap(source, [...workshops, workshops[0]])).toThrow('workshopId');
  });
  it('rejects missing spawn, unknown assets and rotated objects', () => {
    const missing = structuredClone(source);
    missing.layers.find((l: { name: string }) => l.name === 'spawns').objects = [];
    expect(() => compileMap(missing, workshops)).toThrow('entrance');
    const bad = structuredClone(source);
    bad.layers
      .find((l: { name: string }) => l.name === 'world-props')
      .objects[0].properties.find((p: { name: string }) => p.name === 'assetId').value =
      'untrusted-remote-script';
    expect(() => compileMap(bad, workshops)).toThrow();
    const rotated = structuredClone(source);
    rotated.layers.find((l: { name: string }) => l.name === 'world-props').objects[0].rotation = 45;
    expect(() => compileMap(rotated, workshops)).toThrow();
  });
  it('provides direction-specific idle/walk frames and replaceable avatar parts', () => {
    const catalog = AvatarCatalogSchema.parse(
      JSON.parse(readFileSync('content/avatars/catalog.json', 'utf8')),
    );
    for (const key of ['body', 'hair', 'outfit'] as const)
      expect(catalog.parts[key]?.some((part) => part.id === catalog.defaultAvatar.parts[key])).toBe(
        true,
      );
    const frames = Object.values(catalog.sprite.animations).flatMap((a) => [...a.idle, ...a.walk]);
    expect(new Set(frames).size).toBe(24);
    expect(Math.max(...frames)).toBe(23);
  });
});
