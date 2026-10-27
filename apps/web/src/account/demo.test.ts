import { describe, expect, test } from 'vitest';
import { demoService, DEMO_AVATAR_KEY, DEMO_SESSION_KEY, DEMO_ID } from './demo';
import { avatarCatalog } from '../avatar/catalog';
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  touched = new Set<string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    this.touched.add(key);
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.touched.add(key);
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.touched.add(key);
    this.data.delete(key);
  }
}
describe('local demo adapter, no remote authorization', () => {
  test('one local entry creates a default avatar and restores a versioned session', async () => {
    const storage = new MemoryStorage(),
      service = demoService(storage, avatarCatalog);
    expect(await service.session()).toBeNull();
    await expect(service.load(DEMO_ID)).rejects.toMatchObject({ kind: 'auth' });
    await service.enterDemo!();
    expect(await service.session()).toEqual({ userId: DEMO_ID, email: '' });
    expect((await demoService(storage, avatarCatalog).load(DEMO_ID)).avatar).toEqual(
      avatarCatalog.defaultAvatar,
    );
    expect(JSON.parse(storage.getItem(DEMO_SESSION_KEY)!)).toEqual({
      formatVersion: 1,
      active: true,
      kind: 'demo',
    });
  });
  test('save survives reload, logout and reentry; stale revisions cannot overwrite a newer save', async () => {
    const storage = new MemoryStorage(),
      service = demoService(storage, avatarCatalog);
    await service.enterDemo!();
    const avatar = structuredClone(avatarCatalog.defaultAvatar);
    avatar.parts.hair = 'curls-01';
    const saved = await service.saveAvatar(avatar);
    expect(saved.revision).toBe(1);
    await expect(service.saveAvatar(avatar)).rejects.toMatchObject({ kind: 'conflict' });
    await service.logout();
    expect(await service.session()).toBeNull();
    expect(storage.getItem(DEMO_AVATAR_KEY)).toBeTruthy();
    const next = demoService(storage, avatarCatalog);
    await next.enterDemo!();
    expect((await next.load(DEMO_ID)).avatar).toEqual(saved);
  });
  test.each([
    'not json',
    JSON.stringify({ formatVersion: 99, avatar: avatarCatalog.defaultAvatar }),
    JSON.stringify({
      formatVersion: 1,
      avatar: {
        ...avatarCatalog.defaultAvatar,
        parts: { ...avatarCatalog.defaultAvatar.parts, hair: 'untrusted' },
      },
    }),
  ])('recovers damaged or incompatible avatar data %s', async (value) => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_AVATAR_KEY, value);
    const service = demoService(storage, avatarCatalog);
    await service.enterDemo!();
    const data = await service.load(DEMO_ID);
    expect(data.avatar).toEqual(avatarCatalog.defaultAvatar);
    expect(data.notice).toContain('повреждены');
    expect(JSON.parse(storage.getItem(DEMO_AVATAR_KEY)!).formatVersion).toBe(1);
  });
  test('corrupt session does not sign in; real-account storage is never read or changed', async () => {
    const storage = new MemoryStorage();
    storage.data.set('creative-factory-auth-v1', 'real-account-owned-data');
    storage.data.set(DEMO_SESSION_KEY, '{broken');
    const service = demoService(storage, avatarCatalog);
    expect(await service.session()).toBeNull();
    await service.enterDemo!();
    await service.logout();
    expect(storage.data.get('creative-factory-auth-v1')).toBe('real-account-owned-data');
    expect(
      [...storage.touched].every((key) => [DEMO_AVATAR_KEY, DEMO_SESSION_KEY].includes(key)),
    ).toBe(true);
    await expect(service.requestCode('test@example.test')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
  test('blocked storage reports a local error rather than claiming a saved session', async () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const service = demoService(storage, avatarCatalog);
    await expect(service.enterDemo!()).rejects.toMatchObject({ kind: 'storage' });
    expect(await service.session()).toBeNull();
  });
});
