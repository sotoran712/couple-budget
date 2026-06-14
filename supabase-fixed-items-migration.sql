create table if not exists fixed_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  day_of_month integer not null check (day_of_month between 1 and 31),
  amount integer not null check (amount > 0),
  title text not null,
  category text not null,
  person_id uuid references people(id) on delete set null,
  created_by uuid references auth.users(id),
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table transactions add column if not exists fixed_item_id uuid references fixed_items(id) on delete set null;

alter table fixed_items enable row level security;

grant select, insert, update, delete on fixed_items to authenticated;

drop policy if exists "members can view fixed items" on fixed_items;
drop policy if exists "members can manage fixed items" on fixed_items;

create policy "members can view fixed items"
on fixed_items for select
using (public.is_household_member(household_id));

create policy "members can manage fixed items"
on fixed_items for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
