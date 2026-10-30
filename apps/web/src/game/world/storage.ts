import {
  IslandSaveSchema,
  type IslandSave,
  type GameLocation,
  type PlayerState,
} from '@creative-factory/contracts';
import { canOccupy } from '@creative-factory/world-core';
import { generateIsland, GENERATOR_VERSION } from './island';
import { createHouseInterior } from './house';
import { terrainAt } from './terrain';
export const islandStorageKey = (userId: string) =>
  `creative-factory:world:v1:${encodeURIComponent(userId)}`;
export class WorldStore {
  readonly data: IslandSave;
  private key: string;
  private dirty = false;
  constructor(
    userId: string,
    private storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    seed?: number,
  ) {
    this.key = islandStorageKey(userId);
    const raw = storage.getItem(this.key);
    if (raw) {
      // Never silently regenerate an existing island on malformed/future saves.
      const result = IslandSaveSchema.safeParse(JSON.parse(raw));
      if (!result.success)
        throw new Error(
          'Остров сохранён в неподдерживаемом формате. Сохранение оставлено без изменений.',
        );
      this.data = result.data;
      if (this.data.island.id !== 'island' || this.data.house.id !== 'house')
        throw new Error('Повреждены данные локаций');
      for (const world of [this.data.island, this.data.house]) {
        world.ground.forEach(terrainAt);
        if (!canOccupy(world, world.spawn) || !canOccupy(world, world.door))
          throw new Error('Точка входа локации заблокирована');
      }
    } else {
      const value = seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
      const island = generateIsland(value),
        house = createHouseInterior();
      this.data = {
        version: 1,
        generatorVersion: GENERATOR_VERSION,
        id: `island-${value.toString(16)}`,
        seed: value,
        island,
        house,
        positions: {
          island: { ...island.spawn, direction: 'north' },
          house: { ...house.spawn, direction: 'north' },
        },
      };
      this.dirty = true;
      this.flush();
    }
  }
  location(id: GameLocation['id']) {
    return this.data[id];
  }
  position(id: GameLocation['id']): PlayerState {
    const saved = this.data.positions[id],
      world = this.location(id);
    return {
      ...(canOccupy(world, saved) ? saved : { ...world.spawn, direction: 'north' as const }),
      moving: false,
    };
  }
  update(id: GameLocation['id'], state: PlayerState) {
    const old = this.data.positions[id];
    if (state.x === old.x && state.y === old.y && state.direction === old.direction) return;
    if (!canOccupy(this.location(id), state)) return;
    this.data.positions[id] = { x: state.x, y: state.y, direction: state.direction };
    this.dirty = true;
  }
  transition(target: GameLocation['id']) {
    const world = this.location(target);
    const point = target === 'house' ? world.spawn : { x: world.door.x, y: world.door.y + 64 };
    this.update(target, {
      ...point,
      direction: target === 'house' ? 'north' : 'south',
      moving: false,
    });
    this.flush();
  }
  flush() {
    if (!this.dirty) return;
    this.storage.setItem(this.key, JSON.stringify(this.data));
    this.dirty = false;
  }
}
