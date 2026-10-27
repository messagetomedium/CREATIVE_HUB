import { z } from 'zod';

export const ArtSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('procedural') }),
  z.object({
    kind: z.literal('spritesheet'),
    url: z.string().regex(/^\/content\/[a-zA-Z0-9._-]+\.png$/),
  }),
]);
const PropArtEntrySchema = z.object({
  assetId: z.enum(['worktable', 'console', 'cutting-table', 'model-table', 'bench', 'plant']),
  width: z.number().int().positive(),
  depth: z.number().int().positive(),
  elevation: z.number().int().nonnegative(),
  frame: z.number().int().min(0).max(11),
});
export const SceneArtSchema = z
  .object({
    version: z.literal(1),
    projection: z.literal('three-quarter'),
    floors: z.object({ source: ArtSourceSchema }),
    props: z.object({
      source: ArtSourceSchema,
      frameWidth: z.literal(160),
      frameHeight: z.literal(128),
      columns: z.literal(4),
      rows: z.literal(3),
      anchor: z.object({ x: z.literal(80), y: z.literal(112) }),
      entries: z.array(PropArtEntrySchema).min(1),
    }),
    walls: z.object({
      source: ArtSourceSchema,
      frameWidth: z.literal(32),
      frameHeight: z.literal(64),
      columns: z.literal(4),
      rows: z.literal(1),
      anchor: z.object({ x: z.literal(16), y: z.literal(64) }),
      elevation: z.literal(32),
    }),
  })
  .superRefine((art, ctx) => {
    const keys = art.props.entries.map((p) => `${p.assetId}:${p.width}:${p.depth}`);
    if (
      new Set(keys).size !== keys.length ||
      new Set(art.props.entries.map((p) => p.frame)).size !== keys.length
    )
      ctx.addIssue({ code: 'custom', message: 'Повторные формы/кадры предметов' });
    for (const p of art.props.entries)
      if (p.width > art.props.frameWidth || p.depth + p.elevation > art.props.anchor.y)
        ctx.addIssue({ code: 'custom', message: 'Форма предмета выходит за кадр' });
  });
export type SceneArt = z.infer<typeof SceneArtSchema>;
export type PropArtEntry = z.infer<typeof PropArtEntrySchema>;

// All sorted objects use their contact with the floor, independently of image height.
export const FLOOR_DEPTH = 0;
export const SHADOW_DEPTH = 500;
export function feetDepth(y: number): number {
  return 1000 + y;
}
export function wallFrame(left: boolean, right: boolean): number {
  return (left ? 0 : 1) + (right ? 0 : 2);
}
export function findPropArt(
  art: SceneArt,
  assetId: string,
  width: number,
  depth: number,
): PropArtEntry {
  const entry = art.props.entries.find(
    (p) => p.assetId === assetId && p.width === width && p.depth === depth,
  );
  if (!entry) throw new Error(`Нет формы предмета ${assetId} ${width}×${depth}`);
  return entry;
}
