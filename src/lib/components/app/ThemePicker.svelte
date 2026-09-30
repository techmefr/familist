<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { THEME_PRESETS } from '$domain/themes';
	import { t } from '$i18n/index.svelte';
	import { Label } from '$components/ui/label';
	import ThemePreview from './ThemePreview.svelte';
	import { Plus } from '@lucide/svelte';

	const lightPresets = THEME_PRESETS.filter(preset => preset.mode !== 'dark');
	const darkPresets = THEME_PRESETS.filter(preset => preset.mode === 'dark');
	const lightCustom = $derived(settings.customThemes.filter(theme => theme.base === 'light'));
	const darkCustom = $derived(settings.customThemes.filter(theme => theme.base === 'dark'));

	interface Group {
		id: 'light' | 'dark';
		presets: typeof THEME_PRESETS;
		custom: typeof settings.customThemes;
	}

	const groups = $derived<Group[]>([
		{ id: 'light', presets: lightPresets, custom: lightCustom },
		{ id: 'dark', presets: darkPresets, custom: darkCustom }
	]);
</script>

<fieldset id="setting-palette" tabindex="-1" class="fl-setting">
	<legend class="text-label mb-2 font-medium">{t('profile.palette')}</legend>

	{#each groups as group (group.id)}
		<p class="text-caption text-muted-foreground mt-3 mb-2 font-medium" data-test-id="palette-group-{group.id}">
			{t(`themes.group.${group.id}`)}
		</p>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each group.presets as preset (preset.id)}
				<Label class="fl-choice flex-col items-stretch gap-2 py-2">
					<input
						type="radio"
						name="palette"
						value={preset.id}
						checked={settings.themeId === preset.id}
						onchange={() => settings.setThemeId(preset.id)}
						data-test-id="palette-{preset.id}"
						class="sr-only"
					/>
					<ThemePreview themeId={preset.id} />
					<span>{t(preset.label)}</span>
				</Label>
			{/each}

			{#each group.custom as theme (theme.id)}
				<Label class="fl-choice flex-col items-stretch gap-2 py-2">
					<input
						type="radio"
						name="palette"
						value={theme.id}
						checked={settings.themeId === theme.id}
						onchange={() => settings.setThemeId(theme.id)}
						data-test-id="palette-{theme.id}"
						class="sr-only"
					/>
					<ThemePreview themeId={theme.id} custom={theme} />
					<span>{theme.name}</span>
				</Label>
			{/each}
		</div>
	{/each}

	<a
		href="/profile/display/theme"
		class="fl-press text-primary text-label mt-4 inline-flex min-h-11 items-center gap-2 font-medium"
		data-test-id="palette-create"
	>
		<Plus size={18} aria-hidden="true" />
		{t('themes.create')}
	</a>
</fieldset>
