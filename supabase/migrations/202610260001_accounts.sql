-- Creative Factory, catalog v1. No email or administrative role in public tables.
begin;

create function public.cf_valid_line(value text, max_length integer, required boolean default false)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select value is not null and value = btrim(value)
    and char_length(value) between (case when required then 1 else 0 end) and max_length
    and value !~ '[[:cntrl:]]';
$$;

create function public.cf_valid_lines(items text[], max_items integer, max_length integer, links boolean default false)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  select items is not null and coalesce(array_ndims(items), 1) = 1
    and cardinality(items) <= max_items
    and not exists (
      select 1 from unnest(items) item where not coalesce(
        public.cf_valid_line(item, max_length, true)
        and (not links or item ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?([/?#][^[:space:][:cntrl:]]*)?$'), false)
    );
$$;

create function public.cf_valid_avatar(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and value ?& array['catalogVersion', 'presetId', 'parts', 'palette']
    and value - array['catalogVersion', 'presetId', 'parts', 'palette'] = '{}'::jsonb
    and value->'catalogVersion' = '1'::jsonb and value->>'presetId' = 'maker'
    and jsonb_typeof(value->'parts') = 'object'
    and (value->'parts') ?& array['body', 'hair', 'outfit', 'accessory']
    and (value->'parts') - array['body', 'hair', 'outfit', 'accessory'] = '{}'::jsonb
    and value->'parts'->>'body' in ('base-01', 'base-02')
    and value->'parts'->>'hair' in ('short-01', 'bob-01', 'curls-01')
    and value->'parts'->>'outfit' in ('workwear-01', 'jacket-01', 'dress-01')
    and (value->'parts'->'accessory' = 'null'::jsonb or value->'parts'->>'accessory' = 'headphones-01')
    and jsonb_typeof(value->'palette') = 'object'
    and (value->'palette') ?& array['skin', 'hair', 'outfit', 'shoes']
    and (value->'palette') - array['skin', 'hair', 'outfit', 'shoes'] = '{}'::jsonb
    and value->'palette'->>'skin' ~ '^#[0-9a-fA-F]{6}$'
    and value->'palette'->>'hair' ~ '^#[0-9a-fA-F]{6}$'
    and value->'palette'->>'outfit' ~ '^#[0-9a-fA-F]{6}$'
    and value->'palette'->>'shoes' ~ '^#[0-9a-fA-F]{6}$', false);
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (public.cf_valid_line(first_name, 60, true)),
  last_name text not null check (public.cf_valid_line(last_name, 60, true)),
  professional_role text not null check (professional_role in ('expert', 'educator')),
  specialization text not null default '' check (public.cf_valid_line(specialization, 100)),
  organization text not null default '' check (public.cf_valid_line(organization, 120)),
  competencies text[] not null default '{}' check (public.cf_valid_lines(competencies, 16, 60)),
  bio text not null default '' check (
    char_length(bio) <= 1000 and bio = btrim(bio)
    and regexp_replace(bio, E'[\n\r\t]', '', 'g') !~ '[[:cntrl:]]'
  ),
  portfolio_links text[] not null default '{}' check (public.cf_valid_lines(portfolio_links, 5, 300, true)),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'ru' check (locale in ('ru', 'en')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.avatar_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null check (public.cf_valid_avatar(config)),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.cf_bump_revision() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_revision before update on public.profiles
for each row execute function public.cf_bump_revision();
create trigger private_revision before update on public.profile_private
for each row execute function public.cf_bump_revision();
create trigger avatar_revision before update on public.avatar_configs
for each row execute function public.cf_bump_revision();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.profile_private enable row level security;
alter table public.profile_private force row level security;
alter table public.avatar_configs enable row level security;
alter table public.avatar_configs force row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy private_read on public.profile_private for select to authenticated using ((select auth.uid()) = user_id);
create policy private_insert on public.profile_private for insert to authenticated with check ((select auth.uid()) = user_id);
create policy private_update on public.profile_private for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy avatar_read on public.avatar_configs for select to authenticated using (true);
create policy avatar_insert on public.avatar_configs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy avatar_update on public.avatar_configs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.profile_private, public.avatar_configs from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.profile_private, public.avatar_configs to authenticated;
grant insert (user_id, first_name, last_name, professional_role, specialization, organization, competencies, bio, portfolio_links)
  on public.profiles to authenticated;
grant update (first_name, last_name, professional_role, specialization, organization, competencies, bio, portfolio_links)
  on public.profiles to authenticated;
grant insert (user_id, locale), update (locale) on public.profile_private to authenticated;
grant insert (user_id, config), update (config) on public.avatar_configs to authenticated;

-- Invoker functions: RLS applies, identity always comes from the JWT, never an argument.
-- expected_revision=0 creates a row; a stale save raises 40001 instead of overwriting.
create function public.save_profile(p_expected_revision integer, p_profile jsonb)
returns setof public.profiles language plpgsql security invoker set search_path = pg_catalog, public as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  p := jsonb_populate_record(null::public.profiles, p_profile);
  if p_expected_revision = 0 then
    begin
      return query insert into public.profiles
        (user_id, first_name, last_name, professional_role, specialization, organization, competencies, bio, portfolio_links)
        values (auth.uid(), p.first_name, p.last_name, p.professional_role, p.specialization, p.organization, p.competencies, p.bio, p.portfolio_links)
        returning *;
    exception when unique_violation then
      raise exception 'Revision conflict' using errcode = '40001';
    end;
  else
    return query update public.profiles set
      first_name = p.first_name, last_name = p.last_name, professional_role = p.professional_role,
      specialization = p.specialization, organization = p.organization, competencies = p.competencies,
      bio = p.bio, portfolio_links = p.portfolio_links
      where user_id = auth.uid() and revision = p_expected_revision returning *;
    if not found then raise exception 'Revision conflict' using errcode = '40001'; end if;
  end if;
  insert into public.profile_private (user_id) values (auth.uid()) on conflict do nothing;
end;
$$;

create function public.save_avatar(p_expected_revision integer, p_config jsonb)
returns setof public.avatar_configs language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    begin
      return query insert into public.avatar_configs (user_id, config) values (auth.uid(), p_config) returning *;
    exception when unique_violation then
      raise exception 'Revision conflict' using errcode = '40001';
    end;
  else
    return query update public.avatar_configs set config = p_config
      where user_id = auth.uid() and revision = p_expected_revision returning *;
    if not found then raise exception 'Revision conflict' using errcode = '40001'; end if;
  end if;
end;
$$;

revoke all on function public.cf_bump_revision() from public, anon, authenticated;
revoke all on function public.cf_valid_line(text, integer, boolean), public.cf_valid_lines(text[], integer, integer, boolean),
  public.cf_valid_avatar(jsonb), public.save_profile(integer, jsonb), public.save_avatar(integer, jsonb) from public, anon, authenticated;
grant execute on function public.cf_valid_line(text, integer, boolean), public.cf_valid_lines(text[], integer, integer, boolean),
  public.cf_valid_avatar(jsonb), public.save_profile(integer, jsonb), public.save_avatar(integer, jsonb) to authenticated;

comment on column public.profiles.professional_role is 'Profession only. Never an authorization or administrative role.';
comment on table public.profile_private is 'Owner-only settings. Email remains solely in Supabase Auth.';
commit;
