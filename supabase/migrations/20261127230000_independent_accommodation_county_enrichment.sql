alter table public.independent_accommodations
  add column if not exists county_source text,
  add column if not exists county_checked_at timestamptz;

comment on column public.independent_accommodations.county_source is
  'Provenance for an administratively assigned county; not a property-owner verification.';
comment on column public.independent_accommodations.county_checked_at is
  'Timestamp when county membership was assigned from a county boundary dataset.';

create or replace function public.apply_independent_county_enrichment(assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if jsonb_typeof(assignments) <> 'array' then
    raise exception 'assignments must be a JSON array';
  end if;

  update public.independent_accommodations as a
  set county = x.county,
      county_source = 'WWF-Kenya county boundary layer (Survey of Kenya source)',
      county_checked_at = now(),
      updated_at = now()
  from jsonb_to_recordset(assignments) as x(id uuid, county text)
  where a.id = x.id
    and (a.county is null or lower(trim(a.county)) = 'kenya')
    and x.county in (
      'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa',
      'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
      'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
      'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Murang'a',
      'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri',
      'Samburu','Siaya','Taita Taveta','Tana River','Tharaka-Nithi',
      'Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.apply_independent_county_enrichment(jsonb) from public, anon, authenticated;
grant execute on function public.apply_independent_county_enrichment(jsonb) to service_role;
