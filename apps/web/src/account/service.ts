import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  EmailSchema,
  ProfileInputSchema,
  PublicProfileSchema,
  SavedAvatarSchema,
  type AvatarConfig,
  type ProfileInput,
  type PublicProfile,
} from '@creative-factory/contracts';

export class AccountError extends Error {
  constructor(
    public readonly kind:
      | 'conflict'
      | 'auth'
      | 'invalid'
      | 'rate'
      | 'expired'
      | 'network'
      | 'storage',
  ) {
    super(
      {
        conflict:
          'Данные изменились в другой вкладке. Загрузите сохранённую версию и повторите правки.',
        auth: 'Сессия завершилась. Войдите ещё раз.',
        invalid: 'Не удалось сохранить данные. Проверьте поля и настройки таблиц Supabase.',
        rate: 'Слишком много попыток. Подождите минуту перед повторной отправкой.',
        expired: 'Код неверен или срок его действия истёк. Проверьте код либо запросите новый.',
        network: 'Сервис недоступен. Проверьте соединение и попробуйте снова.',
        storage:
          'Браузер не разрешил сохранить демоданные. Разрешите локальное хранилище и попробуйте снова.',
      }[kind],
    );
    this.name = 'AccountError';
  }
}
export function safeAccountError(error: unknown): AccountError {
  if (error instanceof AccountError) return error;
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (code === '40001') return new AccountError('conflict');
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return new AccountError('rate');
  if (code === 'otp_expired' || code === 'otp_disabled') return new AccountError('expired');
  if (status === 401 || code === 'PGRST301' || code === 'refresh_token_not_found')
    return new AccountError('auth');
  if (code?.startsWith('22') || code?.startsWith('23') || code === '42501' || code === 'PGRST202')
    return new AccountError('invalid');
  return new AccountError('network');
}
export interface Identity {
  userId: string;
  email: string;
}
export interface AccountData {
  profile: PublicProfile | null;
  avatar: AvatarConfig | null;
  notice?: string;
}
export interface AccountService {
  enterDemo?(): Promise<void>;
  session(): Promise<Identity | null>;
  subscribe(listener: (identity: Identity | null) => void): () => void;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  logout(): Promise<void>;
  load(userId: string): Promise<AccountData>;
  saveProfile(input: ProfileInput, revision: number): Promise<PublicProfile>;
  saveAvatar(config: AvatarConfig): Promise<AvatarConfig>;
}
const identity = (user: { id: string; email?: string } | undefined): Identity | null =>
  user ? { userId: user.id, email: user.email ?? '' } : null;

export const profilePayload = (input: ProfileInput) => {
  const p = ProfileInputSchema.parse(input);
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    professional_role: p.role,
    specialization: p.specialization,
    organization: p.organization,
    competencies: p.competencies,
    bio: p.bio,
    portfolio_links: p.portfolioLinks,
  };
};
export function readProfile(value: unknown): PublicProfile {
  const p = value as Record<string, unknown>;
  return PublicProfileSchema.parse({
    userId: p.user_id,
    firstName: p.first_name,
    lastName: p.last_name,
    role: p.professional_role,
    specialization: p.specialization,
    organization: p.organization,
    competencies: p.competencies,
    bio: p.bio,
    portfolioLinks: p.portfolio_links,
    revision: p.revision,
  });
}
export function readAvatar(value: unknown): AvatarConfig {
  const row = value as { config: object; revision: number };
  return SavedAvatarSchema.parse({ ...row.config, revision: row.revision });
}
export function supabaseService(client: SupabaseClient): AccountService {
  const checked = <T>(result: { data: T; error: unknown }): T => {
    if (result.error) throw safeAccountError(result.error);
    return result.data;
  };
  return {
    async session() {
      const { data, error } = await client.auth.getSession();
      if (error) throw safeAccountError(error);
      return identity(data.session?.user);
    },
    subscribe(listener) {
      // No asynchronous Supabase calls inside onAuthStateChange (avoids Auth lock deadlocks).
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(identity(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },
    async requestCode(email) {
      checked(
        await client.auth.signInWithOtp({
          email: EmailSchema.parse(email),
          options: { shouldCreateUser: true },
        }),
      );
    },
    async verifyCode(email, token) {
      if (!/^\d{6,10}$/.test(token)) throw new AccountError('expired');
      checked(
        await client.auth.verifyOtp({ email: EmailSchema.parse(email), token, type: 'email' }),
      );
    },
    async logout() {
      // Revoke this browser's refresh token. Auth clears local state even for a revoked session.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        // A network failure must not resurrect this session on reload. Reset the in-memory
        // SDK as well as persisted credentials; server revocation requires connectivity.
        await client.auth.stopAutoRefresh();
        try {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          /* Storage may be disabled. */
        }
        window.location.reload();
        throw safeAccountError(error);
      }
    },
    async load(userId) {
      const [profile, avatar] = await Promise.all([
        client.from('profiles').select('*').eq('user_id', userId).retry(false).maybeSingle(),
        client
          .from('avatar_configs')
          .select('config,revision')
          .eq('user_id', userId)
          .retry(false)
          .maybeSingle(),
      ]);
      const p = checked(profile),
        a = checked(avatar);
      return { profile: p ? readProfile(p) : null, avatar: a ? readAvatar(a) : null };
    },
    async saveProfile(input, revision) {
      const data = checked(
        await client
          .rpc('save_profile', {
            p_expected_revision: revision,
            p_profile: profilePayload(input),
          })
          .single(),
      );
      return readProfile(data);
    },
    async saveAvatar(config) {
      const { revision, ...payload } = SavedAvatarSchema.parse(config);
      const data = checked(
        await client
          .rpc('save_avatar', {
            p_expected_revision: revision,
            p_config: payload,
          })
          .single(),
      );
      return readAvatar(data);
    },
  };
}

export interface AuthConfig {
  mode: 'demo' | 'supabase';
  service: AccountService | null;
  message: string;
  otpExpirySeconds: number;
  otpLength: number;
}
export const AUTH_STORAGE_KEY = 'creative-factory-auth-v1';
export function configureAuth(env: Record<string, string | boolean | undefined>): AuthConfig {
  const seconds = Number(env.VITE_AUTH_OTP_EXPIRY_SECONDS ?? 600);
  const length = Number(env.VITE_AUTH_OTP_LENGTH ?? 6);
  const base = { mode: 'supabase' as const, otpExpirySeconds: seconds, otpLength: length };
  const url = String(env.VITE_SUPABASE_URL ?? '');
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '');
  if (!url || !key)
    return {
      ...base,
      service: null,
      message:
        'Вход пока не подключён. Владельцу сайта нужно настроить Supabase. Локальная прогулка доступна без аккаунта.',
    };
  try {
    const parsed = new URL(url);
    const loopback = env.DEV && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/'
    )
      throw new Error('URL');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Key');
    if (
      !Number.isInteger(seconds) ||
      seconds < 60 ||
      seconds > 3600 ||
      !Number.isInteger(length) ||
      length < 6 ||
      length > 10
    )
      throw new Error('OTP settings');
    return {
      ...base,
      service: supabaseService(
        createClient(url, key, {
          global: {
            fetch: (input, init) => {
              const timeout = AbortSignal.timeout(15000);
              return fetch(input, {
                ...init,
                signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
              });
            },
          },
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: AUTH_STORAGE_KEY,
          },
        }),
      ),
      message: '',
    };
  } catch {
    return {
      ...base,
      service: null,
      message:
        'Вход недоступен: проверьте публичные настройки Supabase и Email OTP. Инструкция: docs/supabase-setup.md.',
    };
  }
}
