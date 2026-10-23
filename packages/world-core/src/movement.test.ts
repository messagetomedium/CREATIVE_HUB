import { describe, expect, it } from 'vitest';
import type { MovementInput, PlayerState, World } from '@creative-factory/contracts';
import {
  canOccupy,
  initialPlayer,
  NEUTRAL_INPUT,
  PLAYER_SPEED,
  stepPlayer,
  zoneAt,
} from './index.js';
const fixture = (): World => ({
  version: 1,
  mapId: 'test',
  width: 20,
  height: 20,
  tileSize: 32,
  ground: Array<number>(400).fill(0),
  solids: Array<boolean>(400).fill(false),
  spawn: { x: 48, y: 48 },
  zones: [],
  props: [],
  workshops: [],
});
const run = (world: World, state: PlayerState, input: Partial<MovementInput>, ticks = 30) => {
  for (let i = 0; i < ticks; i++) state = stepPlayer(state, { ...NEUTRAL_INPUT, ...input }, world);
  return state;
};
describe('shared fixed-step movement', () => {
  it('moves at the declared speed independently from rendering', () => {
    const world = fixture(),
      start = initialPlayer(world),
      end = run(world, start, { right: true });
    expect(end.x - start.x).toBeCloseTo(PLAYER_SPEED, 6);
    expect(end.y).toBe(start.y);
    expect(end.direction).toBe('east');
  });
  it('normalizes diagonal movement', () => {
    const world = fixture(),
      start = initialPlayer(world),
      end = run(world, start, { right: true, down: true });
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('stops on neutral or opposing input without losing facing', () => {
    const world = fixture(),
      state = { ...initialPlayer(world), direction: 'west' as const };
    expect(stepPlayer(state, NEUTRAL_INPUT, world)).toEqual({ ...state, moving: false });
    expect(stepPlayer(state, { ...NEUTRAL_INPUT, left: true, right: true }, world).x).toBe(state.x);
  });
  it('cannot cross a full wall during prolonged movement', () => {
    const world = fixture();
    for (let y = 0; y < 20; y++) world.solids[y * 20 + 3] = true;
    const end = run(world, initialPlayer(world), { right: true }, 500);
    expect(end.x).toBeLessThanOrEqual(86);
    expect(end.x).toBeGreaterThan(83);
    expect(end.moving).toBe(false);
  });
  it('slides along a wall instead of getting stuck at an angle', () => {
    const world = fixture();
    for (let y = 0; y < 20; y++) world.solids[y * 20 + 3] = true;
    const end = run(world, initialPlayer(world), { right: true, down: true });
    expect(end.x).toBeLessThanOrEqual(86);
    expect(end.y).toBeGreaterThan(150);
  });
  it('respects all world edges', () => {
    const world = fixture(),
      start = initialPlayer(world);
    expect(run(world, start, { left: true }, 300).x).toBeGreaterThanOrEqual(10);
    expect(run(world, start, { up: true }, 300).y).toBeGreaterThanOrEqual(8);
    expect(run(world, start, { right: true }, 300).x).toBeLessThanOrEqual(630);
    expect(run(world, start, { down: true }, 300).y).toBeLessThanOrEqual(632);
  });
  it('does not tunnel through even a thin solid object', () => {
    const world = fixture();
    world.props.push({
      id: 'thin',
      assetId: 'bench',
      bounds: { x: 70, y: 20, width: 1, height: 70 },
      accent: '#000000',
      solid: true,
    });
    const end = run(world, initialPlayer(world), { right: true }, 300);
    expect(end.x).toBeLessThanOrEqual(60);
    expect(end.x).toBeGreaterThan(57);
  });
  it('rejects invalid or blocked spawn coordinates', () => {
    const world = fixture();
    expect(canOccupy(world, { x: NaN, y: 48 })).toBe(false);
    expect(canOccupy(world, { x: Infinity, y: 48 })).toBe(false);
    world.solids[21] = true;
    expect(() => initialPlayer(world)).toThrow('заблокирована');
  });
  it('selects the most specific zone with stable half-open boundaries', () => {
    const world = fixture();
    world.zones = [
      {
        id: 'hall',
        name: 'Hall',
        description: '',
        accent: '#ffffff',
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        priority: 0,
      },
      {
        id: 'room',
        name: 'Room',
        description: '',
        accent: '#ffffff',
        bounds: { x: 32, y: 32, width: 32, height: 32 },
        priority: 10,
      },
    ];
    expect(zoneAt(world, { x: 48, y: 48 })?.id).toBe('room');
    expect(zoneAt(world, { x: 64, y: 48 })?.id).toBe('hall');
  });
});
