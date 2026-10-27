import { expect, test } from 'vitest';
import { SavedAvatarSchema } from '@creative-factory/contracts';
import { avatarCatalog } from './catalog';
import { appearanceKey, AVATAR_PALETTES, randomAvatar } from './editor';
test('randomized appearances only use catalog parts/palette colors and preserve save revision', () => {
  for (let i = 0; i < 100; i++) {
    const value = randomAvatar(avatarCatalog, { ...avatarCatalog.defaultAvatar, revision: 7 });
    expect(SavedAvatarSchema.safeParse(value).success).toBe(true);
    expect(value.revision).toBe(7);
    for (const key of ['body', 'hair', 'outfit'] as const)
      expect(avatarCatalog.parts[key]?.some((p) => p.id === value.parts[key])).toBe(true);
    for (const key of ['skin', 'hair', 'outfit', 'shoes'] as const)
      expect(AVATAR_PALETTES[key]).toContain(value.palette[key]);
  }
});
test('dirty comparison includes all visual fields but ignores storage revision', () => {
  const a = avatarCatalog.defaultAvatar;
  expect(appearanceKey(a)).toBe(appearanceKey({ ...a, revision: 99 }));
  expect(appearanceKey(a)).not.toBe(
    appearanceKey({ ...a, palette: { ...a.palette, shoes: '#123456' } }),
  );
});
test('random action still changes the appearance if every initial choice matched', () => {
  const value = structuredClone(avatarCatalog.defaultAvatar);
  for (const key of ['skin', 'hair', 'outfit', 'shoes'] as const)
    value.palette[key] = AVATAR_PALETTES[key][0]!;
  expect(appearanceKey(randomAvatar(avatarCatalog, value, () => 0))).not.toBe(appearanceKey(value));
});
