create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  category text not null,
  name text not null,
  amount integer not null check (amount >= 0),
  created_at timestamptz default now()
);

alter table assets enable row level security;

grant select, insert, update, delete on assets to authenticated;

drop policy if exists "members can view assets" on assets;
drop policy if exists "members can manage assets" on assets;

create policy "members can view assets"
on assets for select
using (public.is_household_member(household_id));

create policy "members can manage assets"
on assets for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
