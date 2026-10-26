import { expect, test } from 'vitest';
import { parseRoute, ROUTES } from './router';
test('every screen has a reloadable hash address; unknown/external paths do not redirect externally', () => {
  for (const route of ROUTES) expect(parseRoute('#' + route)).toBe(route);
  expect(parseRoute('')).toBe('/');
  for (const path of ['#//evil.com', '#/unknown', '#/avatar/../profile', '#javascript:alert(1)'])
    expect(parseRoute(path)).toBeNull();
});
