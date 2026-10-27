import { z } from 'zod';
import { DirectionSchema } from '@creative-factory/contracts';
const PointSchema = z
  .object({ x: z.number().int().min(-64).max(64), y: z.number().int().min(-64).max(64) })
  .strict();
export const PartSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    parent: z.enum([
      'head',
      'torso',
      'pelvis',
      'armLeft',
      'armRight',
      'legLeft',
      'legRight',
      'footLeft',
      'footRight',
      'handLeft',
      'handRight',
    ]),
    pass: z.enum(['back', 'front']),
    material: z.enum([
      'skin',
      'hair',
      'top',
      'bottom',
      'footwear',
      'hat',
      'jewelry',
      'special',
      'fixed',
    ]),
    source: z
      .string()
      .regex(/^\/content\/[A-Za-z0-9._-]+\.png$/)
      .optional(),
    frameWidth: z.number().int().min(1).max(48),
    frameHeight: z.number().int().min(1).max(64),
    anchor: PointSchema,
    offset: PointSchema,
    fit: z.enum(['head', 'torso', 'pelvis', 'limb', 'fixed']),
    mirrorWest: z.boolean().default(false),
    sync: z.enum(['head', 'limb', 'body', 'static']),
    overrides: z
      .array(
        z.object({
          direction: DirectionSchema,
          phase: z.number().int().min(0).max(5),
          sourceFrame: z.number().int().min(0).max(63),
          offset: PointSchema.optional(),
        }),
      )
      .max(24)
      .default([]),
    secondary: z
      .object({
        mode: z.enum(['inherit', 'keyframes']),
        period: z.number().int().min(1).max(24),
        offsets: z.array(PointSchema).min(1).max(24),
      })
      .optional(),
  })
  .strict();
export type ModularPart = z.infer<typeof PartSchema>;

export const PartEntrySchema = PartSchema.extend({
  selection: z
    .object({
      field: z.enum([
        'bodyFeatures',
        'faceFeatures',
        'hair',
        'mouth',
        'eyes',
        'top',
        'bottom',
        'footwear',
        'hat',
        'jewelry',
        'special',
      ]),
      slot: z.number().int().min(1).max(12),
      gender: z.enum(['male', 'female']).optional(),
    })
    .strict(),
});
export type PartEntry = z.infer<typeof PartEntrySchema>;
