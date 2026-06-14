create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  date date not null,
  amount integer not null check (amount > 0),
  title text not null,
  category text not null,
  person_id uuid references people(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

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

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  category text not null,
  name text not null,
  amount integer not null check (amount >= 0),
  created_at timestamptz default now()
);

alter table households enable row level security;
alter table household_members enable row level security;
alter table people enable row level security;
alter table transactions enable row level security;
alter table fixed_items enable row level security;
alter table assets enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on households to authenticated;
grant select, insert, update, delete on household_members to authenticated;
grant select, insert, update, delete on people to authenticated;
grant select, insert, update, delete on transactions to authenticated;
grant select, insert, update, delete on fixed_items to authenticated;
grant select, insert, update, delete on assets to authenticated;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "members can view households" on households;
drop policy if exists "users can create households" on households;
drop policy if exists "members can view household members" on household_members;
drop policy if exists "users can join households" on household_members;
drop policy if exists "members can view people" on people;
drop policy if exists "members can manage people" on people;
drop policy if exists "members can view transactions" on transactions;
drop policy if exists "members can manage transactions" on transactions;
drop policy if exists "members can view fixed items" on fixed_items;
drop policy if exists "members can manage fixed items" on fixed_items;
drop policy if exists "members can view assets" on assets;
drop policy if exists "members can manage assets" on assets;

create policy "members can view households"
on households for select
using (public.is_household_member(id));

create policy "users can create households"
on households for insert
with check (created_by = auth.uid());

create policy "members can view household members"
on household_members for select
using (public.is_household_member(household_id));

create policy "users can join households"
on household_members for insert
with check (user_id = auth.uid());

create policy "members can view people"
on people for select
using (public.is_household_member(household_id));

create policy "members can manage people"
on people for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can view transactions"
on transactions for select
using (public.is_household_member(household_id));

create policy "members can manage transactions"
on transactions for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can view fixed items"
on fixed_items for select
using (public.is_household_member(household_id));

create policy "members can manage fixed items"
on fixed_items for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members can view assets"
on assets for select
using (public.is_household_member(household_id));

create policy "members can manage assets"
on assets for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
