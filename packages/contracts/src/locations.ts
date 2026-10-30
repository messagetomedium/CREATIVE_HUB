import { z } from 'zod';
const point = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
});
const rect = point.extend({ width: z.number().positive(), height: z.number().positive() });
export const LocationSchema = z
  .object({
    id: z.enum(['island', 'house']),
    width: z.number().int().min(24).max(128),
    height: z.number().int().min(20).max(128),
    tileSize: z.literal(32),
    ground: z.array(z.number().int().min(0).max(255)).max(16384),
    solids: z.array(z.boolean()).max(16384),
    spawn: point,
    zones: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          accent: z.string(),
          bounds: rect,
          priority: z.number().int(),
        }),
      )
      .max(16),
    props: z.array(z.object({ id: z.string(), solid: z.boolean(), bounds: rect })).max(256),
    objects: z
      .array(
        z.object({
          id: z.string(),
          kind: z.enum(['house', 'stairs']),
          bounds: rect,
        }),
      )
      .max(128),
    door: point,
  })
  .superRefine((world, ctx) => {
    if (
      world.ground.length !== world.width * world.height ||
      world.solids.length !== world.ground.length
    )
      ctx.addIssue({ code: 'custom', message: 'Размер сохранённых слоёв не совпадает с картой' });
  });
export type GameLocation = z.infer<typeof LocationSchema>;
const position = point.extend({ direction: z.enum(['north', 'east', 'south', 'west']) });
export const IslandSaveSchema = z.object({
  version: z.literal(1),
  generatorVersion: z.literal(1),
  id: z.string().max(100),
  seed: z.number().int().min(0).max(0xffffffff),
  island: LocationSchema,
  house: LocationSchema,
  positions: z.object({ island: position, house: position }),
});
export type IslandSave = z.infer<typeof IslandSaveSchema>;
