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

test('legacy saves acquire constructor choices only after an explicit edit', async () => {
  const { constructorChoices, updateConstructor } = await import('./editor');
  const legacy = structuredClone(avatarCatalog.defaultAvatar);
  const before = JSON.stringify(legacy);
  const inferred = constructorChoices(legacy);
  expect(inferred.build).toBe('average');
  expect(JSON.stringify(legacy)).toBe(before);
  const next = updateConstructor(legacy, { build: 'slim', age: 'adult', mouth: 6, hat: 4 });
  expect(next.customization).toMatchObject({
    version: 1,
    build: 'slim',
    age: 'adult',
    mouth: 6,
    hat: 4,
  });
  expect(appearanceKey(next)).not.toBe(appearanceKey(legacy));
  expect(SavedAvatarSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
test('gender changes preserve both hair choices; age does not replace the hairstyle', async () => {
  const { constructorChoices, updateConstructor } = await import('./editor');
  let value = updateConstructor(avatarCatalog.defaultAvatar, { hair: { male: 6, female: 4 } });
  const male = value.parts.hair;
  value = updateConstructor(value, { gender: 'female' });
  expect(constructorChoices(value).hair).toEqual({ male: 6, female: 4 });
  const female = value.parts.hair;
  value = updateConstructor(value, { age: 'adult' });
  expect(value.parts.hair).toBe(female);
  expect(updateConstructor(value, { gender: 'male' }).parts.hair).toBe(male);
});
test('new choices are bounded and strict, including feature sets, colors and versions', async () => {
  const { updateConstructor } = await import('./editor');
  const config = updateConstructor(avatarCatalog.defaultAvatar, {});
  for (const bad of [
    { version: 2 },
    { mouth: 0 },
    { eyes: 7 },
    { footwear: 1.5 },
    { hat: 'url' },
    { bodyFeatures: [13] },
    { bodyFeatures: [1, 1] },
    { faceFeatures: [8] },
    { hair: { male: 7, female: 1 } },
    { hair: { male: 1 } },
    { colors: { ...config.customization!.colors, bottom: 'red' } },
    { externalUrl: 'https://example.com' },
  ])
    expect(
      SavedAvatarSchema.safeParse({ ...config, customization: { ...config.customization, ...bad } })
        .success,
    ).toBe(false);
  expect(AVATAR_PALETTES.skin).toHaveLength(10);
  expect(AVATAR_PALETTES.hair).toHaveLength(12);
  expect(AVATAR_PALETTES.outfit).toHaveLength(12);
  expect(AVATAR_PALETTES.shoes).toHaveLength(12);
});
