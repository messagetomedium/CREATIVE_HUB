import { z } from 'zod';
import {
  SavedAvatarSchema,
  type AvatarCatalog,
  type AvatarConfig,
} from '@creative-factory/contracts';
import { AccountError, type AccountService, type AuthConfig, type Identity } from './service';
export const DEMO_SESSION_KEY = 'creative-factory-demo-session-v1';
export const DEMO_AVATAR_KEY = 'creative-factory-demo-avatar-v1';
export const DEMO_ID = 'local-demo';
export const DEMO_NAME = 'Администратор (демо)';
const SessionSchema = z
  .object({ formatVersion: z.literal(1), active: z.literal(true), kind: z.literal('demo') })
  .strict();
const SaveSchema = z.object({ formatVersion: z.literal(1), avatar: SavedAvatarSchema }).strict();
export function demoService(
  storage: Storage,
  catalog: AvatarCatalog,
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>,
): AccountService {
  const listeners = new Set<(identity: Identity | null) => void>();
  const who = { userId: DEMO_ID, email: '' }; // Local identifier only, never a Supabase identity or role.
  let recovered = false;
  const read = (key: string): unknown => {
    try {
      const value = storage.getItem(key);
      return value === null ? null : JSON.parse(value);
    } catch {
      return undefined;
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      throw new AccountError('storage');
    }
  };
  const session = () => (SessionSchema.safeParse(read(DEMO_SESSION_KEY)).success ? who : null);
  const assertSession = () => {
    if (!session()) throw new AccountError('auth');
  };
  const readAvatar = (): AvatarConfig => {
    const raw = read(DEMO_AVATAR_KEY),
      parsed = SaveSchema.safeParse(raw);
    if (parsed.success) {
      const avatar = parsed.data.avatar;
      const known = Object.entries(avatar.parts).every(
        ([part, id]) => id === null || catalog.parts[part]?.some((p) => p.id === id),
      );
      if (known) {
        const original = raw as { avatar?: { customization?: { age?: string } } };
        if (original.avatar?.customization?.age === 'child')
          write(DEMO_AVATAR_KEY, { formatVersion: 1, avatar });
        return avatar;
      }
    }
    recovered = raw !== null;
    const fallback = structuredClone(catalog.defaultAvatar);
    // Recover a malformed/obsolete envelope. Blocked storage is reported on login/save.
    try {
      write(DEMO_AVATAR_KEY, { formatVersion: 1, avatar: fallback });
    } catch {
      /* Read-only fallback. */
    }
    return fallback;
  };
  const emit = () => listeners.forEach((listener) => listener(session()));
  const changed = (event: Event) => {
    if ((event as StorageEvent).key === DEMO_SESSION_KEY || (event as StorageEvent).key === null)
      emit();
  };
  return {
    async session() {
      return session();
    },
    subscribe(listener) {
      if (!listeners.size) events?.addEventListener('storage', changed);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) events?.removeEventListener('storage', changed);
      };
    },
    async enterDemo() {
      readAvatar();
      write(DEMO_SESSION_KEY, { formatVersion: 1, active: true, kind: 'demo' });
      emit();
    },
    async logout() {
      try {
        storage.removeItem(DEMO_SESSION_KEY);
      } catch {
        throw new AccountError('storage');
      }
      emit(); // Avatar is intentionally retained, in its own namespace.
    },
    async load(userId) {
      assertSession();
      if (userId !== DEMO_ID) throw new AccountError('auth');
      const avatar = readAvatar();
      return {
        profile: null,
        avatar,
        notice: recovered
          ? 'Локальные данные персонажа повреждены или устарели. Восстановлен безопасный образ.'
          : undefined,
      };
    },
    async saveAvatar(value) {
      assertSession();
      const parsed = SavedAvatarSchema.safeParse(value);
      if (!parsed.success) throw new AccountError('invalid');
      const current = readAvatar();
      if (value.revision !== current.revision) throw new AccountError('conflict');
      const avatar = { ...parsed.data, revision: current.revision + 1 };
      write(DEMO_AVATAR_KEY, { formatVersion: 1, avatar });
      recovered = false;
      return structuredClone(avatar);
    },
    async saveProfile() {
      throw new AccountError('invalid');
    },
    async requestCode() {
      throw new AccountError('invalid');
    },
    async verifyCode() {
      throw new AccountError('invalid');
    },
  };
}
export function configureDemo(
  storage: Storage,
  catalog: AvatarCatalog,
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>,
): AuthConfig {
  return {
    mode: 'demo',
    service: demoService(storage, catalog, events),
    message: '',
    otpExpirySeconds: 600,
    otpLength: 6,
  };
}
