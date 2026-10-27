import {
  SavedAvatarSchema,
  type AvatarCatalog,
  type AvatarConfig,
} from '@creative-factory/contracts';
export const AVATAR_PALETTES = {
  skin: ['#f4d4b0', '#dcae86', '#b98058', '#805436', '#503727'],
  hair: ['#273a36', '#75513a', '#c19a60', '#e3d9ca', '#9e5140'],
  outfit: ['#cf6546', '#577a66', '#6e7da4', '#c2a653', '#a57e99'],
  shoes: ['#f1e9d8', '#253e37', '#7e5140', '#7b8797', '#bc9e6e'],
};
export function appearanceKey(a: AvatarConfig): string {
  return JSON.stringify([
    a.catalogVersion,
    a.presetId,
    a.parts.body,
    a.parts.hair,
    a.parts.outfit,
    a.parts.accessory,
    a.palette.skin,
    a.palette.hair,
    a.palette.outfit,
    a.palette.shoes,
  ]);
}
export function randomAvatar(
  catalog: AvatarCatalog,
  previous: AvatarConfig,
  random = Math.random,
): AvatarConfig {
  const choose = <T>(items: readonly T[]): T =>
    items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))]!;
  const avatar = structuredClone(previous);
  for (const key of ['body', 'hair', 'outfit'] as const)
    avatar.parts[key] = choose(catalog.parts[key]!).id;
  avatar.parts.accessory = choose([null, ...(catalog.parts.accessory ?? []).map((p) => p.id)]);
  for (const key of ['skin', 'hair', 'outfit', 'shoes'] as const)
    avatar.palette[key] = choose(AVATAR_PALETTES[key]);
  if (appearanceKey(avatar) === appearanceKey(previous)) {
    const index = AVATAR_PALETTES.skin.indexOf(avatar.palette.skin);
    avatar.palette.skin = AVATAR_PALETTES.skin[(index + 1) % AVATAR_PALETTES.skin.length]!;
  }
  return SavedAvatarSchema.parse(avatar);
}
