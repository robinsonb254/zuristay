-- Partner property publication review workflow.
alter table public.properties
  add column if not exists publication_status text not null default 'draft',
  add column if not exists publication_submitted_at timestamptz,
  add column if not exists publication_reviewed_at timestamptz,
  add column if not exists publication_reviewed_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.properties'::regclass and conname = 'properties_publication_status_check') then
    alter table public.properties add constraint properties_publication_status_check
      check (publication_status in ('draft','pending_review','published','changes_requested'));
  end if;
end $$;

update public.properties set publication_status = case when is_active then 'published' else 'draft' end
where publication_status = 'draft';

create or replace function public.reset_property_publication_for_partner_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_property_id uuid;
begin
  if tg_table_name = 'properties' then
    if (to_jsonb(new) - array['updated_at','publication_status','publication_submitted_at','publication_reviewed_at','publication_reviewed_by','is_active'])
       is distinct from
       (to_jsonb(old) - array['updated_at','publication_status','publication_submitted_at','publication_reviewed_at','publication_reviewed_by','is_active']) then
      new.publication_status := 'draft';
      new.publication_submitted_at := null;
      new.publication_reviewed_at := null;
      new.publication_reviewed_by := null;
      new.is_active := false;
    end if;
    return new;
  end if;

  if tg_table_name in ('property_units','property_images','property_amenities') then
    if tg_op = 'DELETE' then target_property_id := old.property_id;
    else target_property_id := new.property_id;
    end if;
    if target_property_id is not null then
      update public.properties set publication_status = 'draft', publication_submitted_at = null,
        publication_reviewed_at = null, publication_reviewed_by = null, is_active = false
      where id = target_property_id and status = 'approved' and is_archived = false;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.reset_property_publication_for_partner_changes() from public, anon, authenticated;

drop trigger if exists reset_property_publication_on_partner_edit on public.properties;
create trigger reset_property_publication_on_partner_edit
before update of name, property_type, description, address, city, county, country, currency, contact_phone, contact_email, has_conference_rooms, conference_room_capacity, conference_room_details
on public.properties for each row execute function public.reset_property_publication_for_partner_changes();

drop trigger if exists reset_property_publication_on_unit_change on public.property_units;
create trigger reset_property_publication_on_unit_change after insert or update or delete on public.property_units
for each row execute function public.reset_property_publication_for_partner_changes();

drop trigger if exists reset_property_publication_on_image_change on public.property_images;
create trigger reset_property_publication_on_image_change after insert or update or delete on public.property_images
for each row execute function public.reset_property_publication_for_partner_changes();

drop trigger if exists reset_property_publication_on_amenity_change on public.property_amenities;
create trigger reset_property_publication_on_amenity_change after insert or update or delete on public.property_amenities
for each row execute function public.reset_property_publication_for_partner_changes();
