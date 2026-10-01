-- Distinguishing a meal-plan list from a shopping list (#359): the two are read differently on the
-- overview, and the household needs a way to keep them apart in the filter.

alter table public.lists add column kind text not null default 'shopping'
  check (kind in ('shopping', 'meal-plan'));

notify pgrst, 'reload schema';
