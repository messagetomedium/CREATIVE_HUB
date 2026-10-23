import { describe, expect, it } from 'vitest';
import { contentPath } from './contentPath';

describe('static hosting content paths', () => {
  it('keeps root hosting compatible', () => {
    expect(contentPath('/content/manifest.json', '/')).toBe('/content/manifest.json');
  });
  it('resolves every asset inside the GitHub Pages project directory', () => {
    for (const entry of [
      'manifest.json',
      'world-abcd.json',
      'avatars-abcd.json',
      'tiles-abcd.svg',
    ]) {
      expect(contentPath('/content/' + entry, '/CREATIVE_HUB/')).toBe(
        '/CREATIVE_HUB/content/' + entry,
      );
    }
  });
  it.each([
    'https://other.example/a.json',
    '//other.example/a.json',
    '/content/../a.json',
    '/content/%2e%2e/a.json',
    '/content/a.json?redirect=1',
  ])('rejects untrusted manifest entry %s', (entry) => {
    expect(() => contentPath(entry, '/CREATIVE_HUB/')).toThrow('Недопустимый путь');
  });
  it.each(['//other.example/', '/CREATIVE_HUB/../', 'CREATIVE_HUB/', '/CREATIVE_HUB'])(
    'rejects invalid base %s',
    (base) => {
      expect(() => contentPath('/content/manifest.json', base)).toThrow('базовый путь');
    },
  );
});
