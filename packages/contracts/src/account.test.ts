import { describe, expect, test } from 'vitest';
import { EMPTY_PROFILE, HttpsLinkSchema, ProfileInputSchema } from './account';
import { SavedAvatarSchema } from './index';
import catalog from '../../../content/avatars/catalog.json';
describe('profile and avatar input boundaries', () => {
  test('names are mandatory, normalized, nonunique text; no administrative role or auth fields', () => {
    const p = { ...EMPTY_PROFILE, firstName: ' Анна ', lastName: 'Иванова' };
    expect(ProfileInputSchema.parse(p).firstName).toBe('Анна');
    for (const bad of [
      { firstName: '  ' },
      { lastName: '' },
      { role: 'admin' },
      { email: 'a@example.com' },
      { userId: 'another-user' },
      { firstName: 'a'.repeat(61) },
      { competencies: Array(17).fill('x') },
      { bio: 'x'.repeat(1001) },
    ])
      expect(ProfileInputSchema.safeParse({ ...p, ...bad }).success).toBe(false);
  });
  test.each([
    'http://example.com',
    'javascript:alert(1)',
    'data:text/plain,x',
    'https://u:p@example.com',
    'https://example.com/a b',
    'https://example.com:99999',
    '/portfolio',
  ])('rejects unsafe or invalid link %s', (url) => {
    expect(HttpsLinkSchema.safeParse(url).success).toBe(false);
  });
  test('accepts a bounded HTTPS portfolio and valid own avatar', () => {
    expect(HttpsLinkSchema.parse('https://example.com/portfolio?q=1#art')).toBeTruthy();
    expect(SavedAvatarSchema.parse(catalog.defaultAvatar)).toEqual(catalog.defaultAvatar);
    expect(
      SavedAvatarSchema.safeParse({
        ...catalog.defaultAvatar,
        parts: { ...catalog.defaultAvatar.parts, body: 'untrusted' },
      }).success,
    ).toBe(false);
  });
  test('international portfolio domains and paths are saved in canonical HTTPS form', () => {
    expect(HttpsLinkSchema.parse('https://пример.рф/работы')).toBe(
      new URL('https://пример.рф/работы').href,
    );
  });
});
