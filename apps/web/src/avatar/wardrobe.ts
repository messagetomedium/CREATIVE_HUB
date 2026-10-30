/** Catalog extension around the approved editor; body/pose code remains unchanged. */
import {
  SavedAvatarSchema,
  type AvatarConfig,
  type AvatarCustomization,
} from '@creative-factory/contracts';
import source from '../../../../content/avatars/wardrobe.json';
import { constructorChoices, updateConstructor, randomAvatar } from './editor';
import { avatarCatalog } from './catalog';
export const WARDROBE = source;
export function updateWardrobe(config: AvatarConfig, patch: Partial<AvatarCustomization>) {
  const next = { ...constructorChoices(config), ...patch };
  // Keep catalog-v1 procedural IDs valid while independent imported slots extend past six.
  const projection = { ...next, top: ((next.top - 1) % 6) + 1 };
  const compatible = updateConstructor({ ...config, customization: projection }, projection);
  return SavedAvatarSchema.parse({ ...compatible, customization: next });
}
export function randomWardrobe(config: AvatarConfig) {
  const choose = (n: number) => Math.floor(Math.random() * n) + 1;
  return updateWardrobe(randomAvatar(avatarCatalog, config), {
    top: choose(WARDROBE.top.length),
    bottom: choose(WARDROBE.bottom.length),
    footwear: choose(WARDROBE.footwear.length),
    socks: choose(4) - 1,
  });
}
export function skinLegwear(config: AvatarConfig) {
  const c = constructorChoices(config);
  return (
    [6, 9].includes(c.bottom) && (c.legwearTone ?? (c.bottom === 9 ? 'skin' : 'color')) === 'skin'
  );
}
