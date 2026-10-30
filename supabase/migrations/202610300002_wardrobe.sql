-- Expanded clothing catalog and optional socks/tights. Existing saves and RLS remain valid.
begin;
create or replace function public.cf_valid_customization(value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare key text; items jsonb; item jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if not value ?& array['version','gender','age','build','bodyFeatures','mouth','eyes','faceFeatures','hair','top','bottom','footwear','hat','jewelry','special','colors']
    or value - array['version','gender','age','build','bodyFeatures','mouth','eyes','faceFeatures','hair','top','bottom','footwear','hat','jewelry','special','colors','socks','legwearTone'] <> '{}'::jsonb
    or value->'version' <> '1'::jsonb
    or value->>'gender' not in ('male','female')
    or value->>'age' <> 'adult'
    or value->>'build' not in ('very-slim','slim','average','sturdy') then return false; end if;
  if jsonb_typeof(value->'gender') <> 'string' or jsonb_typeof(value->'age') <> 'string' or jsonb_typeof(value->'build') <> 'string' then return false; end if;
  foreach key in array array['mouth','eyes','top','bottom','footwear','hat','jewelry','special'] loop
    item := value->key;
    if key in ('hat','jewelry','special') and item = 'null'::jsonb then continue; end if;
    if key in ('top','bottom') then
      if jsonb_typeof(item) <> 'number' or not (item <@ (case when key='top' then '[1,2,3,4,5,6,7,8,9,10]'::jsonb else '[1,2,3,4,5,6,7,8,9]'::jsonb end)) then return false; end if;
    else
    if item not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb,'6'::jsonb) then return false; end if;
    end if;
  end loop;
  if value ? 'socks' and value->'socks' not in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb) then return false; end if;
  if value ? 'legwearTone' and value->'legwearTone' not in ('"skin"'::jsonb,'"color"'::jsonb) then return false; end if;
  foreach key in array array['bodyFeatures','faceFeatures'] loop
    items := value->key;
    if jsonb_typeof(items) <> 'array' then return false; end if;
    if jsonb_array_length(items) > (case when key = 'bodyFeatures' then 12 else 7 end) then return false; end if;
    if (select count(distinct e) from jsonb_array_elements(items) e) <> jsonb_array_length(items) then return false; end if;
    for item in select * from jsonb_array_elements(items) loop
      if jsonb_typeof(item) <> 'number' or not (item <@ '[1,2,3,4,5,6,7,8,9,10,11,12]'::jsonb)
        or (key = 'faceFeatures' and not (item <@ '[1,2,3,4,5,6,7]'::jsonb)) then return false; end if;
    end loop;
  end loop;
  items := value->'hair';
  if jsonb_typeof(items) <> 'object' or not items ?& array['male','female'] or items - array['male','female'] <> '{}'::jsonb then return false; end if;
  foreach key in array array['male','female'] loop
    if items->key not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb,'6'::jsonb) then return false; end if;
  end loop;
  items := value->'colors';
  if jsonb_typeof(items) <> 'object' or not items ?& array['bottom','hat','jewelry','special'] or items - array['bottom','hat','jewelry','special','socks'] <> '{}'::jsonb then return false; end if;
  foreach key in array array['bottom','hat','jewelry','special'] loop
    if jsonb_typeof(items->key) <> 'string' or items->>key !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
  end loop;
  if items ? 'socks' and (jsonb_typeof(items->'socks') <> 'string' or items->>'socks' !~ '^#[0-9a-fA-F]{6}$') then return false; end if;
  return true;
end;
$$;

commit;
