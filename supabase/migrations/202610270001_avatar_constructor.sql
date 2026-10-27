-- Constructor choices are an optional extension: existing catalog-v1 saves stay valid.
-- This migration changes validation only. Owner RLS, RPC identity and revisions stay intact.
begin;
create function public.cf_valid_customization(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare key text; items jsonb; item jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if not value ?& array['version','gender','age','build','bodyFeatures','mouth','eyes','faceFeatures','hair','top','bottom','footwear','hat','jewelry','special','colors']
    or value - array['version','gender','age','build','bodyFeatures','mouth','eyes','faceFeatures','hair','top','bottom','footwear','hat','jewelry','special','colors'] <> '{}'::jsonb
    or value->'version' <> '1'::jsonb
    or value->>'gender' not in ('male','female')
    or value->>'age' not in ('child','adult')
    or value->>'build' not in ('slim','average','sturdy') then return false; end if;
  if jsonb_typeof(value->'gender') <> 'string' or jsonb_typeof(value->'age') <> 'string' or jsonb_typeof(value->'build') <> 'string' then return false; end if;
  foreach key in array array['mouth','eyes','top','bottom','footwear','hat','jewelry','special'] loop
    item := value->key;
    if key in ('hat','jewelry','special') and item = 'null'::jsonb then continue; end if;
    if item not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb,'6'::jsonb) then return false; end if;
  end loop;
  foreach key in array array['bodyFeatures','faceFeatures'] loop
    items := value->key;
    if jsonb_typeof(items) <> 'array' then return false; end if;
    if jsonb_array_length(items) > (case when key = 'bodyFeatures' then 12 else 6 end) then return false; end if;
    if (select count(distinct e) from jsonb_array_elements(items) e) <> jsonb_array_length(items) then return false; end if;
    for item in select * from jsonb_array_elements(items) loop
      if jsonb_typeof(item) <> 'number' or not (item <@ '[1,2,3,4,5,6,7,8,9,10,11,12]'::jsonb)
        or (key = 'faceFeatures' and not (item <@ '[1,2,3,4,5,6]'::jsonb)) then return false; end if;
    end loop;
  end loop;
  items := value->'hair';
  if jsonb_typeof(items) <> 'object' or not items ?& array['male','female'] or items - array['male','female'] <> '{}'::jsonb then return false; end if;
  foreach key in array array['male','female'] loop
    if items->key not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb,'6'::jsonb) then return false; end if;
  end loop;
  items := value->'colors';
  if jsonb_typeof(items) <> 'object' or not items ?& array['bottom','hat','jewelry','special'] or items - array['bottom','hat','jewelry','special'] <> '{}'::jsonb then return false; end if;
  foreach key in array array['bottom','hat','jewelry','special'] loop
    if jsonb_typeof(items->key) <> 'string' or items->>key !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.cf_valid_customization(jsonb) from public, anon, authenticated;
grant execute on function public.cf_valid_customization(jsonb) to authenticated;
create or replace function public.cf_valid_avatar(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select (not (value ? 'customization') or public.cf_valid_customization(value->'customization'))
    and coalesce(
    jsonb_typeof(value) = 'object'
    and value ?& array['catalogVersion', 'presetId', 'parts', 'palette']
    and value - array['catalogVersion', 'presetId', 'parts', 'palette', 'customization'] = '{}'::jsonb
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

commit;
