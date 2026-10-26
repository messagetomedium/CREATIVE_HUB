import { describe, expect, test } from 'vitest';
import { configureAuth, profilePayload, readProfile, safeAccountError } from './service';
import { EMPTY_PROFILE } from '@creative-factory/contracts';
describe('public Supabase configuration and account boundary', () => {
  test('without configured Auth the application cannot claim working mail delivery', () => {
    const config = configureAuth({});
    expect(config.service).toBeNull();
    expect(config.message).toContain('Вход пока не подключён');
  });
  test.each([
    { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_deliberately_invalid_test' },
    { VITE_SUPABASE_URL: 'http://example.com' },
    { VITE_SUPABASE_URL: 'https://user:pass@example.com' },
    { VITE_AUTH_OTP_LENGTH: '0' },
    { VITE_AUTH_OTP_EXPIRY_SECONDS: '-1' },
  ])('rejects an insecure or invalid public configuration %j', (override) => {
    expect(
      configureAuth({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture_only',
        ...override,
      }).service,
    ).toBeNull();
  });
  test('writes contain no client-selected identity or auth details; reads discard unexpected email', () => {
    const input = { ...EMPTY_PROFILE, firstName: 'Анна', lastName: 'Иванова' };
    const payload = profilePayload(input);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('email');
    const profile = readProfile({
      ...payload,
      user_id: '00000000-0000-4000-8000-000000000001',
      revision: 1,
      email: 'must-not-be-public@example.test',
    });
    expect(profile).not.toHaveProperty('email');
  });
  test('error text never echoes raw server details or tokens', () => {
    const error = safeAccountError({ code: '40001', message: 'sensitive server content' });
    expect(error.kind).toBe('conflict');
    expect(error.message).not.toContain('sensitive');
    expect(safeAccountError({ code: 'otp_expired' }).kind).toBe('expired');
    expect(safeAccountError({ status: 429 }).kind).toBe('rate');
  });
});
