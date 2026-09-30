-- Colour palettes (theme presets) and the person's own themes follow them across devices.
--
-- `theme` stays light / dark / system: it is the switch of the adaptive default palette. `theme_id` names
-- the palette itself. The id is not constrained to a list here on purpose: the list of shipped presets
-- lives in the application and grows with it, and the client revalidates whatever it reads.
--
-- `custom_themes` holds at most five themes made in the creator. Only their inputs are stored (name, base,
-- seed, tone, radius); the client derives the tokens again on read, so a hand-edited row cannot slip a
-- low-contrast palette past the contrast validator.
--
-- Reversible: alter table public.profiles drop column theme_id, drop column custom_themes;

alter table public.profiles
  add column if not exists theme_id text not null default 'cream-forest'
    check (char_length(theme_id) between 1 and 40),
  add column if not exists custom_themes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(custom_themes) = 'array' and jsonb_array_length(custom_themes) <= 5);

grant update (theme_id, custom_themes) on public.profiles to authenticated;
