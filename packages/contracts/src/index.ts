import { z } from 'zod';
export * from './account';
export * from './art';

export const DirectionSchema = z.enum(['north', 'east', 'south', 'west']);
export type Direction = z.infer<typeof DirectionSchema>;
export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
export interface PlayerState extends Point {
  direction: Direction;
  moving: boolean;
}
const finite = z.number().finite();
export const RectSchema = z.object({
  x: finite.nonnegative(),
  y: finite.nonnegative(),
  width: finite.positive(),
  height: finite.positive(),
});
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
export const WorkshopSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  code: z.string(),
  name: z.string(),
  discipline: z.string(),
  description: z.string(),
  accent: hexColor,
  floorTile: z.number().int().min(2).max(5),
  room: RectSchema,
  door: z.object({
    side: z.enum(['north', 'south']),
    offset: z.number().int().positive(),
    width: z.number().int().positive(),
  }),
});
export const WorkshopsSchema = z.array(WorkshopSchema).min(1);
export type Workshop = z.infer<typeof WorkshopSchema>;
export const PropSchema = z.object({
  id: z.string(),
  assetId: z.enum(['worktable', 'console', 'cutting-table', 'model-table', 'plant', 'bench']),
  bounds: RectSchema,
  accent: hexColor,
  solid: z.boolean(),
});
export type WorldProp = z.infer<typeof PropSchema>;
export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  accent: hexColor,
  bounds: RectSchema,
  priority: z.number().int(),
});
export type Zone = z.infer<typeof ZoneSchema>;
export const WorldSchema = z
  .object({
    version: z.literal(1),
    mapId: z.string(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512),
    tileSize: z.literal(32),
    ground: z.array(z.number().int().min(0).max(7)),
    solids: z.array(z.boolean()),
    spawn: z.object({ x: finite.nonnegative(), y: finite.nonnegative() }),
    zones: z.array(ZoneSchema),
    props: z.array(PropSchema),
    workshops: WorkshopsSchema,
  })
  .superRefine((world, ctx) => {
    const size = world.width * world.height;
    if (world.ground.length !== size || world.solids.length !== size)
      ctx.addIssue({ code: 'custom', message: 'Размер слоёв не совпадает с размером карты' });
    if (new Set(world.zones.map((z) => z.id)).size !== world.zones.length)
      ctx.addIssue({ code: 'custom', message: 'zoneId должен быть уникальным' });
  });
export type World = z.infer<typeof WorldSchema>;
export const AvatarConfigSchema = z.object({
  catalogVersion: z.literal(1),
  presetId: z.string(),
  revision: z.number().int().nonnegative(),
  parts: z.object({
    body: z.string(),
    hair: z.string(),
    outfit: z.string(),
    accessory: z.string().nullable(),
  }),
  palette: z.object({ skin: hexColor, hair: hexColor, outfit: hexColor, shoes: hexColor }),
});
export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;
// Shared with the original procedural provider and the database's catalog-v1 constraint.
export const AVATAR_PART_IDS = {
  body: ['base-01', 'base-02'],
  hair: ['short-01', 'bob-01', 'curls-01'],
  outfit: ['workwear-01', 'jacket-01', 'dress-01'],
  accessory: ['headphones-01'],
} as const;
export const SavedAvatarSchema = AvatarConfigSchema.extend({
  presetId: z.literal('maker'),
  parts: z
    .object({
      body: z.enum(AVATAR_PART_IDS.body),
      hair: z.enum(AVATAR_PART_IDS.hair),
      outfit: z.enum(AVATAR_PART_IDS.outfit),
      accessory: z.enum(AVATAR_PART_IDS.accessory).nullable(),
    })
    .strict(),
  palette: AvatarConfigSchema.shape.palette.strict(),
}).strict();
export const AvatarCatalogSchema = z.object({
  version: z.literal(1),
  defaultAvatar: AvatarConfigSchema,
  parts: z.record(z.string(), z.array(z.object({ id: z.string(), label: z.string() }))),
  sprite: z.object({
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('procedural'), id: z.literal('factory-worker-blockout-v2') }),
      z.object({
        kind: z.literal('spritesheet'),
        url: z.string().regex(/^\/content\/[a-zA-Z0-9._-]+\.png$/),
      }),
      z.object({
        kind: z.literal('layered-sheets'),
        layers: z
          .array(
            z.object({
              part: z.enum(['body', 'shoes', 'outfit', 'hair', 'accessory']),
              partId: z.string(),
              bodyId: z.string().optional(),
              url: z.string().regex(/^\/content\/[a-zA-Z0-9._-]+\.png$/),
              tint: z.enum(['skin', 'hair', 'outfit', 'shoes']).nullable(),
            }),
          )
          .min(1),
      }),
    ]),
    frameWidth: z.literal(48),
    frameHeight: z.literal(64),
    anchor: z.object({ x: z.literal(24), y: z.literal(56) }),
    animations: z.record(
      DirectionSchema,
      z.object({ idle: z.array(z.number().int()).min(1), walk: z.array(z.number().int()).min(2) }),
    ),
  }),
});
export type AvatarCatalog = z.infer<typeof AvatarCatalogSchema>;
export const ManifestSchema = z.object({
  version: z.literal(1),
  worldUrl: z.string(),
  worldHash: z.string().length(64),
  avatarsUrl: z.string(),
  avatarsHash: z.string().length(64),
  tilesUrl: z.string(),
  sceneArtUrl: z.string(),
  sceneArtHash: z.string().length(64),
});
export type ContentManifest = z.infer<typeof ManifestSchema>;

// Reserved for the future Colyseus adapter; Auth lives outside the movement/session contract.
export interface WorldSession {
  mode: 'local' | 'online';
  sendInput(input: MovementInput): void;
  dispose(): void;
}
export interface ProfileSummary {
  userId: string;
  displayName: string;
  disciplines: string[];
  revision: number;
}
export const CONTENT_VERSION = 1;
