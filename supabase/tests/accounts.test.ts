import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { avatarCatalog } from '../../apps/web/src/avatar/catalog';
import { profilePayload } from '../../apps/web/src/account/service';
import { updateConstructor } from '../../apps/web/src/avatar/editor';
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
  for (const file of (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
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
  test('extended constructor choices round-trip under owner RLS and reject malformed extensions', async () => {
    await as(A);
    const { revision: _, ...config } = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      age: 'adult',
      build: 'slim',
      bodyFeatures: [1, 12],
      faceFeatures: [1, 6],
      hair: { male: 6, female: 4 },
      hat: 3,
      mouth: 6,
    });
    for (const bad of [
      null,
      {},
      { ...config.customization, version: 2 },
      { ...config.customization, gender: null },
      { ...config.customization, mouth: '1' },
      { ...config.customization, eyes: 7 },
      { ...config.customization, top: 1.5 },
      { ...config.customization, footwear: null },
      { ...config.customization, hair: { male: 1, female: 7 } },
      { ...config.customization, hair: { male: 1 } },
      { ...config.customization, bodyFeatures: [1, 1] },
      { ...config.customization, bodyFeatures: [13] },
      { ...config.customization, faceFeatures: [7] },
      { ...config.customization, faceFeatures: 'bad' },
      { ...config.customization, colors: {} },
      { ...config.customization, colors: { ...config.customization!.colors, hat: 'red' } },
      { ...config.customization, externalUrl: 'https://example.com' },
    ])
      await expect(saveAvatar(0, { ...config, customization: bad })).rejects.toMatchObject({
        code: '23514',
      });
    await saveAvatar(0, config);
    expect(
      (await db.query<{ config: unknown }>('select config from avatar_configs')).rows[0]!.config,
    ).toEqual(config);
    await as(B);
    expect(
      (
        await db.query('update avatar_configs set config=$1::jsonb where user_id=$2 returning *', [
          JSON.stringify(config),
          A,
        ])
      ).rows,
    ).toHaveLength(0);
    await as(A);
    // Removing the optional extension remains valid, so legacy clients/saves are not locked out.
    expect((await saveAvatar(1, avatar)).rows[0]!.revision).toBe(2);
  });
  test('very slim build persists through the real SQL validator without changing other avatar fields', async () => {
    await as(A);
    const { revision: _, ...config } = updateConstructor(avatarCatalog.defaultAvatar, {
      build: 'very-slim',
    });
    await saveAvatar(0, config);
    expect(
      (await db.query<{ config: unknown }>('select config from avatar_configs')).rows[0]!.config,
    ).toEqual(config);
    await as(B);
    expect(
      (
        await db.query('update avatar_configs set config=$1::jsonb where user_id=$2 returning *', [
          JSON.stringify(config),
          A,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  test('SQL migration upgrades stored children and refuses new child payloads under RLS', async () => {
    // Reconstruct the previous validator so an actual legacy row exists before reapplying migration.
    await db.exec('reset role');
    const old = await readFile('supabase/migrations/202610270001_avatar_constructor.sql', 'utf8');
    const a = old.indexOf('create function public.cf_valid_customization'),
      b = old.indexOf('revoke all on function', a);
    await db.exec(old.slice(a, b).replace('create function', 'create or replace function'));
    await as(A);
    const { revision: _, ...config } = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      hair: { male: 2, female: 4 },
    });
    const child = { ...config, customization: { ...config.customization, age: 'child' } };
    await saveAvatar(0, child);
    await db.exec('reset role');
    await db.exec(await readFile('supabase/migrations/202610270002_adult_avatar_rig.sql', 'utf8'));
    await as(A);
    const row = (
      await db.query<{ config: unknown; revision: number }>(
        'select config,revision from avatar_configs',
      )
    ).rows[0]!;
    expect(row.config).toEqual(config);
    expect(row.revision).toBe(2);
    await expect(saveAvatar(2, child)).rejects.toMatchObject({ code: '23514' });
  });
});
