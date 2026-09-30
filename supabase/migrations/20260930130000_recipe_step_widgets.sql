-- Typed widgets on a recipe step: oven or hob settings, a warning, a long wait, a photo.
--
-- The timer and the linked ingredients already have their columns (`duration_seconds`, `ingredient_ids`) and
-- stay there, so each fact has one home. What is stored here is validated again by the client on every read.
-- Existing steps get an empty list.
--
-- Reversible: alter table public.recipe_steps drop column widgets;

alter table public.recipe_steps
  add column if not exists widgets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(widgets) = 'array' and jsonb_array_length(widgets) <= 6);
