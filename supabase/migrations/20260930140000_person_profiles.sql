-- Private profiles of the people a household plans meals around: allergies with severity, diets, tastes,
-- portion size. Health and belief-adjacent data (GDPR art. 9), so it is readable by its creator only.
--
-- The roster itself (household_persons: a name, optionally a linked account) stays readable by the whole
-- household, as before. What was sensitive there, the free-text `dietary_notes`, moves here into `notes`,
-- owned by the account that wrote it. Rows whose author has since deleted their account keep their notes in
-- household_persons rather than lose them, since nobody is left to own them here.
--
-- Data minimisation: diets are rules ("halal", "no-pork"), never a religion field; age is a birth year, not a
-- date. A profile belongs to exactly one household: the same real person in two households has two
-- independent profiles, and deleting a household deletes its profiles.
--
-- Reversible: drop function public.household_person_warnings(uuid); drop table public.person_profiles;
-- (the copied notes stay in household_persons.dietary_notes only for rows that could not be migrated).

alter table public.household_persons
  drop constraint if exists household_persons_id_household_key;
alter table public.household_persons
  add constraint household_persons_id_household_key unique (id, household_id);

create table if not exists public.person_profiles (
  person_id uuid primary key,
  household_id uuid not null,
  -- The account that wrote the profile. Only this account reads it.
  owner_id uuid not null references auth.users on delete cascade,
  allergies jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allergies) = 'array' and jsonb_array_length(allergies) <= 40),
  diets text[] not null default '{}' check (cardinality(diets) <= 20),
  likes text[] not null default '{}' check (cardinality(likes) <= 60),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 60),
  birth_year integer check (birth_year is null or (birth_year between 1900 and 2100)),
  portion_factor numeric(3, 2) not null default 1 check (portion_factor between 0.25 and 3),
  guest boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Off by default: when on, the other members see that a dish "contains peanut" for this person, never
  -- the severity, the notes or anything else.
  share_warnings boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (person_id, household_id)
    references public.household_persons (id, household_id) on delete cascade
);

create index if not exists person_profiles_owner_idx on public.person_profiles (owner_id);
create index if not exists person_profiles_household_idx on public.person_profiles (household_id);

alter table public.person_profiles enable row level security;

drop policy if exists person_profiles_owner on public.person_profiles;
create policy person_profiles_owner on public.person_profiles for all
  using (owner_id = (select auth.uid()) and public.is_household_member(household_id))
  with check (owner_id = (select auth.uid()) and public.is_household_member(household_id));

grant select, insert, update, delete on public.person_profiles to authenticated;

-- Move the existing free text to its author, then empty the shared column for the rows that moved.
insert into public.person_profiles (person_id, household_id, owner_id, notes, guest)
select id, household_id, created_by, dietary_notes, (linked_user_id is null)
from public.household_persons
where created_by is not null
  and dietary_notes is not null
  and btrim(dietary_notes) <> ''
on conflict (person_id) do nothing;

update public.household_persons hp
set dietary_notes = null
where exists (
  select 1 from public.person_profiles pp
  where pp.person_id = hp.id and pp.owner_id = hp.created_by
);

-- What the other members may see of a profile whose owner switched sharing on: which allergens and diets to
-- warn about, nothing else. Security definer because the table itself is closed to them; it checks the
-- caller's membership and exposes only the warning fields.
create or replace function public.household_person_warnings(p_household uuid)
returns table (person_id uuid, allergens text[], diets text[])
language sql
stable
security definer
set search_path = public
as $$
  select pp.person_id,
         coalesce(array(select a ->> 'label' from jsonb_array_elements(pp.allergies) a), '{}'),
         pp.diets
  from public.person_profiles pp
  where pp.household_id = p_household
    and pp.share_warnings
    and public.is_household_member(p_household);
$$;

revoke all on function public.household_person_warnings(uuid) from public;
grant execute on function public.household_person_warnings(uuid) to authenticated;
