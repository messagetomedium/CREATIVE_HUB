import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { avatarCatalog } from '../../apps/web/src/avatar/catalog';
import { profilePayload } from '../../apps/web/src/account/service';
import { EMPTY_PROFILE } from '@creative-factory/contracts';

// Runs the ACTUAL migration/constraints/RLS in PostgreSQL WASM, with simulated JWT identity.
// This is not a test of GoTrue, SMTP, PostgREST, or the hosted Supabase project's grants.
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
let db: PGlite;
const profile = profilePayload({ ...EMPTY_PROFILE, firstName: 'Анна', lastName: 'Иванова' });
const { revision: _revision, ...avatar } = avatarCatalog.defaultAvatar;
async function as(id: string | null) {
  await db.exec(`reset role; set role ${id ? 'authenticated' : 'anon'};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
}
const saveProfile = (revision = 0, value: unknown = profile) =>
  db.query<{ revision: number; user_id: string }>(
    'select * from public.save_profile($1, $2::jsonb)',
    [revision, JSON.stringify(value)],
  );
const saveAvatar = (revision = 0, value: unknown = avatar) =>
  db.query<{ revision: number }>('select * from public.save_avatar($1, $2::jsonb)', [
    revision,
    JSON.stringify(value),
  ]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(await readFile('supabase/migrations/202610260001_accounts.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec(
    'reset role; truncate public.profiles, public.profile_private, public.avatar_configs;',
  );
});
afterAll(async () => {
  await db?.close();
});
describe('real migration under authenticated/anon PostgreSQL roles', () => {
  test('two equal names have distinct immutable Auth IDs; email is not in any app table', async () => {
    await as(A);
    expect((await saveProfile()).rows[0]).toMatchObject({ user_id: A, revision: 1 });
    await as(B);
    expect((await saveProfile()).rows[0]).toMatchObject({ user_id: B, revision: 1 });
    expect((await db.query('select first_name from profiles')).rows).toHaveLength(2);
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name in ('profiles','profile_private','avatar_configs')",
    );
    expect(columns.rows.map((r) => r.column_name)).not.toContain('email');
  });
  test('A can read B public profile/avatar but cannot read B private settings or update B', async () => {
    await as(B);
    await saveProfile();
    await saveAvatar();
    await as(A);
    await saveProfile();
    expect((await db.query('select * from profiles')).rows).toHaveLength(2);
    expect((await db.query('select * from avatar_configs')).rows).toHaveLength(1);
    expect(
      (await db.query<{ user_id: string }>('select * from profile_private')).rows.map(
        (r) => r.user_id,
      ),
    ).toEqual([A]);
    expect(
      (
        await db.query('update profiles set first_name=$1 where user_id=$2 returning user_id', [
          'Чужое',
          B,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'update avatar_configs set config=$1::jsonb where user_id=$2 returning user_id',
          [JSON.stringify(avatar), B],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update profile_private set locale='en' where user_id=$1 returning user_id",
          [B],
        )
      ).rows,
    ).toHaveLength(0);
  });
  test('anon cannot select app tables or invoke save functions', async () => {
    await as(null);
    for (const table of ['profiles', 'profile_private', 'avatar_configs'])
      await expect(db.query(`select * from ${table}`)).rejects.toMatchObject({ code: '42501' });
    await expect(saveProfile()).rejects.toMatchObject({ code: '42501' });
    await expect(saveAvatar()).rejects.toMatchObject({ code: '42501' });
  });
  test('spoofed owner and administrative role are rejected; RPC derives identity from Auth', async () => {
    await as(A);
    await expect(
      db.query('insert into avatar_configs(user_id,config) values($1,$2::jsonb)', [
        B,
        JSON.stringify(avatar),
      ]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(saveProfile(0, { ...profile, professional_role: 'admin' })).rejects.toMatchObject({
      code: '23514',
    });
    await saveProfile(0, { ...profile, user_id: B } as typeof profile);
    expect((await db.query('select user_id from profiles')).rows).toEqual([{ user_id: A }]);
    await expect(
      db.query('update profiles set user_id=$1 where user_id=$2', [B, A]),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('update profiles set revision=999')).rejects.toMatchObject({
      code: '42501',
    });
  });
  test('revision increases atomically and stale initial/update saves cannot overwrite either record', async () => {
    await as(A);
    await saveProfile();
    await saveAvatar();
    expect((await saveProfile(1, { ...profile, first_name: 'Аня' })).rows[0]?.revision).toBe(2);
    expect((await saveAvatar(1)).rows[0]?.revision).toBe(2);
    for (const revision of [0, 1]) {
      await expect(saveProfile(revision)).rejects.toMatchObject({ code: '40001' });
      await expect(saveAvatar(revision)).rejects.toMatchObject({ code: '40001' });
    }
    expect((await db.query('select first_name from profiles')).rows).toEqual([
      { first_name: 'Аня' },
    ]);
  });
  test('database validates required names, limits, competencies, HTTPS and professional role', async () => {
    await as(A);
    for (const bad of [
      { first_name: '' },
      { first_name: 'x'.repeat(61) },
      { last_name: null },
      { organization: 'x'.repeat(121) },
      { bio: 'x'.repeat(1001) },
      { competencies: Array(17).fill('дизайн') },
      { competencies: [null] },
      { portfolio_links: ['javascript:alert(1)'] },
      { portfolio_links: ['http://example.com'] },
      { portfolio_links: ['https://example.com:99999'] },
      { portfolio_links: ['https://name:password@example.com'] },
      { portfolio_links: Array(6).fill('https://example.com') },
    ])
      await expect(saveProfile(0, { ...profile, ...bad } as typeof profile)).rejects.toMatchObject({
        code: expect.stringMatching(/^23/),
      });
    await saveProfile(0, {
      ...profile,
      professional_role: 'educator',
      portfolio_links: ['https://example.com/work?q=design#project'],
    });
  });
  test('unknown, missing or malformed catalog parts/colors fail; every original variant is accepted', async () => {
    await as(A);
    const bad = [
      { ...avatar, parts: { ...avatar.parts, hair: 'external-image-url' } },
      { ...avatar, palette: { ...avatar.palette, skin: 'red' } },
      { ...avatar, catalogVersion: 2 },
      { ...avatar, parts: {} },
      { ...avatar, palette: {} },
      { ...avatar, revision: 100 },
      { ...avatar, parts: { ...avatar.parts, accessory: 'script' } },
    ];
    for (const value of bad)
      await expect(saveAvatar(0, value)).rejects.toMatchObject({ code: '23514' });
    let revision = 0;
    for (const key of ['body', 'hair', 'outfit', 'accessory'] as const) {
      for (const option of avatarCatalog.parts[key] ?? []) {
        const result = await saveAvatar(revision, {
          ...avatar,
          parts: { ...avatar.parts, [key]: option.id },
        });
        revision = result.rows[0]!.revision;
      }
    }
  });
});
