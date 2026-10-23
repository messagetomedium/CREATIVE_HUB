import { z } from 'zod';
import {
  WorldSchema,
  WorkshopsSchema,
  type World,
  type WorldProp,
  type Zone,
} from '@creative-factory/contracts';
import { canOccupy } from '@creative-factory/world-core';
const objectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.literal(0),
  visible: z.literal(true),
  ellipse: z.literal(false).optional(),
  point: z.literal(false).optional(),
  polygon: z.never().optional(),
  polyline: z.never().optional(),
  text: z.never().optional(),
  gid: z.never().optional(),
  properties: z
    .array(z.object({ name: z.string(), value: z.union([z.string(), z.boolean(), z.number()]) }))
    .default([]),
});
const layerTransform = {
  x: z.literal(0),
  y: z.literal(0),
  visible: z.literal(true),
  opacity: z.literal(1),
  offsetx: z.literal(0).optional(),
  offsety: z.literal(0).optional(),
};
const layerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tilelayer'),
    name: z.string(),
    width: z.number().int(),
    height: z.number().int(),
    data: z.array(z.number().int().min(0).max(8)),
    ...layerTransform,
  }),
  z.object({
    type: z.literal('objectgroup'),
    name: z.string(),
    objects: z.array(objectSchema),
    ...layerTransform,
  }),
]);
const mapSchema = z.object({
  type: z.literal('map'),
  orientation: z.literal('orthogonal'),
  infinite: z.literal(false),
  width: z.number().int().min(1).max(512),
  height: z.number().int().min(1).max(512),
  tilewidth: z.literal(32),
  tileheight: z.literal(32),
  layers: z.array(layerSchema),
  tilesets: z
    .array(
      z.object({
        firstgid: z.literal(1),
        image: z.literal('placeholder-tiles.svg'),
        columns: z.literal(8),
        tilewidth: z.literal(32),
        tileheight: z.literal(32),
      }),
    )
    .length(1),
});
export function compileMap(source: unknown, definitions: unknown): World {
  const map = mapSchema.parse(source),
    workshops = WorkshopsSchema.parse(definitions);
  if (new Set(workshops.map((w) => w.id)).size !== workshops.length)
    throw new Error('Повторный workshopId');
  if (new Set(map.layers.map((l) => l.name)).size !== map.layers.length)
    throw new Error('Имена слоёв должны быть уникальны');
  const tileLayer = (name: string) => {
    const layer = map.layers.find((l) => l.type === 'tilelayer' && l.name === name);
    if (
      !layer ||
      layer.type !== 'tilelayer' ||
      layer.width !== map.width ||
      layer.height !== map.height ||
      layer.data.length !== map.width * map.height
    )
      throw new Error('Некорректный слой ' + name);
    return layer.data;
  };
  const objects = (name: string) => {
    const layer = map.layers.find((l) => l.type === 'objectgroup' && l.name === name);
    if (!layer || layer.type !== 'objectgroup') throw new Error('Нет object layer ' + name);
    return layer.objects;
  };
  const bounds = (o: z.infer<typeof objectSchema>) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  });
  const props: WorldProp[] = objects('world-props').map((o) => {
    const values = Object.fromEntries(o.properties.map((p) => [p.name, p.value]));
    return { id: o.name, bounds: bounds(o), ...values } as WorldProp;
  });
  const zones: Zone[] = objects('interactions').map((o) => {
    const values = Object.fromEntries(o.properties.map((p) => [p.name, p.value]));
    return { id: o.name, bounds: bounds(o), ...values } as Zone;
  });
  const spawn = objects('spawns').find((o) => o.name === 'entrance');
  if (!spawn) throw new Error('Нет входа entrance');
  const ground = tileLayer('ground');
  if (ground.some((id) => id === 0)) throw new Error('Пол не может содержать пустые клетки');
  const world = WorldSchema.parse({
    version: 1,
    mapId: 'creative-factory',
    width: map.width,
    height: map.height,
    tileSize: 32,
    ground: ground.map((id) => id - 1),
    solids: tileLayer('solids').map((id) => id > 0),
    spawn: { x: spawn.x + spawn.width / 2, y: spawn.y + spawn.height / 2 },
    zones,
    props,
    workshops,
  });
  if (new Set(props.map((p) => p.id)).size !== props.length) throw new Error('Повторный propId');
  for (const item of [...world.props.map((p) => p.bounds), ...world.zones.map((z) => z.bounds)]) {
    if (item.x + item.width > world.width * 32 || item.y + item.height > world.height * 32)
      throw new Error('Объект за границами карты');
  }
  for (const workshop of workshops) {
    if (!zones.some((zone) => zone.id === workshop.id))
      throw new Error('У цеха нет зоны: ' + workshop.id);
    const { room, door } = workshop;
    if (
      !Object.values(room).every(Number.isInteger) ||
      room.x + room.width > world.width ||
      room.y + room.height > world.height ||
      door.offset + door.width >= room.width
    )
      throw new Error('Некорректные границы цеха: ' + workshop.id);
  }
  if (!canOccupy(world, world.spawn)) throw new Error('Spawn заблокирован');
  return world;
}
