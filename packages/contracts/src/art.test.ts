import { describe, expect, test } from 'vitest';
import { SceneArtSchema, feetDepth, findPropArt, wallFrame } from './art';
import { AvatarCatalogSchema } from './index';
import artSource from '../../../content/art/scene-art.json';
import avatarSource from '../../../content/avatars/catalog.json';
describe('replaceable 3/4 art contracts', () => {
  test('feet and contact plane determine depth, independently of art height', () => {
    const art = SceneArtSchema.parse(artSource);
    const bench = findPropArt(art, 'bench', 64, 32);
    expect(bench.elevation).toBe(16);
    expect(feetDepth(632)).toBeLessThan(feetDepth(672));
    expect(feetDepth(680)).toBeGreaterThan(feetDepth(672));
    expect(() => findPropArt(art, 'bench', 200, 32)).toThrow('Нет формы');
  });
  test('atlas contains only ten reused prop shapes, with unique fitting cells', () => {
    const art = SceneArtSchema.parse(artSource);
    expect(art.props.entries).toHaveLength(10);
    expect(
      SceneArtSchema.safeParse({
        ...artSource,
        props: {
          ...artSource.props,
          entries: [...artSource.props.entries, artSource.props.entries[0]],
        },
      }).success,
    ).toBe(false);
    expect(
      SceneArtSchema.safeParse({
        ...artSource,
        props: { ...artSource.props, entries: [{ ...artSource.props.entries[0], elevation: 120 }] },
      }).success,
    ).toBe(false);
  });
  test('wall endpoints use four unrotated faces', () => {
    expect([
      wallFrame(true, true),
      wallFrame(false, true),
      wallFrame(true, false),
      wallFrame(false, false),
    ]).toEqual([0, 1, 2, 3]);
  });
  test('avatar sheets have four upright rows, 96×128 frames and common feet anchor', () => {
    const catalog = AvatarCatalogSchema.parse(avatarSource);
    expect(catalog.sprite).toMatchObject({
      frameWidth: 96,
      frameHeight: 128,
      anchor: { x: 48, y: 112 },
    });
    expect(catalog.defaultAvatar.catalogVersion).toBe(1);
    expect(
      Object.values(catalog.sprite.animations).flatMap((a) => [...a.idle, ...a.walk]),
    ).toHaveLength(24);
    expect(
      AvatarCatalogSchema.safeParse({
        ...avatarSource,
        sprite: { ...avatarSource.sprite, anchor: { x: 24, y: 80 } },
      }).success,
    ).toBe(false);
  });
  test('replacement URLs cannot refer to external resources', () => {
    expect(
      SceneArtSchema.safeParse({
        ...artSource,
        props: {
          ...artSource.props,
          source: { kind: 'spritesheet', url: 'https://external.example/props.png' },
        },
      }).success,
    ).toBe(false);
  });
});
