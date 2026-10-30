import { expect, test } from 'vitest';
import { SavedAvatarSchema } from '@creative-factory/contracts';
import { avatarCatalog } from './catalog';
import { updateWardrobe, skinLegwear } from './wardrobe';

test('expanded top slots remain editable through other choices and keep legacy procedural IDs valid', () => {
  const original = structuredClone(avatarCatalog.defaultAvatar);
  for (let top = 1; top <= 10; top++) {
    const selected = updateWardrobe(original, { top, bottom: 9, socks: 3, legwearTone: 'skin' });
    const changed = updateWardrobe(selected, {
      gender: 'female',
      colors: { ...selected.customization!.colors, socks: '#a294bd' },
    });
    expect(changed.customization).toMatchObject({
      top,
      bottom: 9,
      socks: 3,
      gender: 'female',
      legwearTone: 'skin',
    });
    expect(SavedAvatarSchema.safeParse(changed).success).toBe(true);
    expect(['workwear-01', 'jacket-01', 'dress-01']).toContain(changed.parts.outfit);
  }
  expect(original).toEqual(avatarCatalog.defaultAvatar);
});
test('skin tone is limited to tights/leggings and old saves get no new mandatory fields', () => {
  expect(skinLegwear(updateWardrobe(avatarCatalog.defaultAvatar, { bottom: 9 }))).toBe(true);
  expect(skinLegwear(updateWardrobe(avatarCatalog.defaultAvatar, { bottom: 6 }))).toBe(false);
  expect(
    skinLegwear(updateWardrobe(avatarCatalog.defaultAvatar, { bottom: 6, legwearTone: 'skin' })),
  ).toBe(true);
  expect(
    skinLegwear(updateWardrobe(avatarCatalog.defaultAvatar, { bottom: 8, legwearTone: 'skin' })),
  ).toBe(false);
  expect(SavedAvatarSchema.safeParse(avatarCatalog.defaultAvatar).success).toBe(true);
});
test('wardrobe rejects outside slots, arbitrary tones and invalid sock colors', () => {
  for (const patch of [
    { top: 11 },
    { bottom: 10 },
    { socks: 4 },
    { socks: -1 },
    { legwearTone: 'arbitrary' },
    {
      colors: {
        bottom: '#123456',
        hat: '#123456',
        jewelry: '#123456',
        special: '#123456',
        socks: 'red',
      },
    },
  ])
    expect(() => updateWardrobe(avatarCatalog.defaultAvatar, patch as never)).toThrow();
});
