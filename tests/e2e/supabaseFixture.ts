import { expect, type Page } from '@playwright/test';
import { EMPTY_PROFILE } from '@creative-factory/contracts';
import { profilePayload } from '../../apps/web/src/account/service';
export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
const email = 'maker@example.test';
export const fixtureProfile = () => ({
  user_id: TEST_USER_ID,
  ...profilePayload({ ...EMPTY_PROFILE, firstName: 'Анна', lastName: 'Иванова' }),
  revision: 1,
});
/** Controlled HTTP dependencies around the REAL Supabase JS client.
 * No fake Auth implementation is shipped in the application. No mail is delivered here.
 * PostgreSQL RLS is tested separately using the actual migration.
 */
export async function installSupabaseFixture(page: Page, options: { existing?: boolean } = {}) {
  const state = {
    profile: options.existing
      ? fixtureProfile()
      : (null as ReturnType<typeof fixtureProfile> | null),
    avatar: null as { user_id: string; config: Record<string, unknown>; revision: number } | null,
    requests: 0,
    verifications: 0,
    profileSaves: 0,
    avatarSaves: 0,
    conflict: false,
    rateLimit: false,
    loadError: false,
    revoked: false,
    logoutFailure: false,
  };
  const user = {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: { provider: 'email' },
    user_metadata: {},
    identities: [],
  };
  const session = () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    // Deliberately unsigned TEST token, accepted only by this intercepted endpoint.
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    return {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: TEST_USER_ID, aud: 'authenticated', exp })}.test-signature`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      refresh_token: 'test-fixture-refresh-not-a-real-credential',
      user,
    };
  };
  await page.route('https://creative-factory-test.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const body =
      request.method() === 'POST' ? (request.postDataJSON() as Record<string, unknown>) : {};
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: {
          'x-supabase-api-version': '2024-01-01',
          'access-control-expose-headers': 'X-Supabase-Api-Version',
        },
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    if (url.pathname === '/auth/v1/otp') {
      state.requests++;
      expect(body.email).toBe(email);
      expect(body.create_user).toBe(true);
      return state.rateLimit
        ? reply({ code: 'over_email_send_rate_limit', msg: 'Rate limited' }, 429)
        : reply({});
    }
    if (url.pathname === '/auth/v1/verify') {
      state.verifications++;
      expect(body.type).toBe('email');
      expect(body.email).toBe(email);
      if (body.token !== '123456')
        return reply({ code: 'otp_expired', msg: 'Token invalid or expired' }, 403);
      state.revoked = false;
      return reply(session());
    }
    if (url.pathname === '/auth/v1/logout') {
      if (state.logoutFailure)
        return reply({ code: 'unexpected_failure', msg: 'Unavailable' }, 503);
      state.revoked = true;
      return reply({});
    }
    if (url.pathname === '/auth/v1/user')
      return state.revoked ? reply({ msg: 'Expired' }, 401) : reply(user);
    if (url.pathname === '/auth/v1/token')
      return state.revoked
        ? reply({ code: 'refresh_token_not_found', msg: 'Revoked' }, 400)
        : reply(session());
    if (url.pathname === '/rest/v1/profiles' || url.pathname === '/rest/v1/avatar_configs') {
      if (state.loadError) return reply({ code: 'TEST_UNAVAILABLE', message: 'Unavailable' }, 503);
      expect(url.searchParams.get('user_id')).toBe(`eq.${TEST_USER_ID}`);
      // maybeSingle defaults to application/json + an array in current postgrest-js.
      const row = url.pathname.endsWith('/profiles') ? state.profile : state.avatar;
      return reply(row ? [row] : []);
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      if (state.conflict) return reply({ code: '40001', message: 'Revision conflict' }, 409);
      if (url.pathname.endsWith('/save_profile')) {
        expect(body.p_expected_revision).toBe(state.profile?.revision ?? 0);
        expect(body.p_profile).not.toHaveProperty('user_id');
        expect(body.p_profile).not.toHaveProperty('email');
        state.profileSaves++;
        state.profile = {
          ...(body.p_profile as ReturnType<typeof profilePayload>),
          user_id: TEST_USER_ID,
          revision: (state.profile?.revision ?? 0) + 1,
        };
        return reply(state.profile);
      }
      if (url.pathname.endsWith('/save_avatar')) {
        expect(body.p_expected_revision).toBe(state.avatar?.revision ?? 0);
        expect(body.p_config).not.toHaveProperty('revision');
        state.avatarSaves++;
        state.avatar = {
          user_id: TEST_USER_ID,
          config: body.p_config as Record<string, unknown>,
          revision: (state.avatar?.revision ?? 0) + 1,
        };
        return reply(state.avatar);
      }
    }
    throw new Error(`Unexpected test request path: ${url.pathname}`);
  });
  return state;
}
export async function signIn(page: Page) {
  await page.goto('/#/login');
  await page.getByLabel('Электронная почта').fill(email);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить и войти' }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/#\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
