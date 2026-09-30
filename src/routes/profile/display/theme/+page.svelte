<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import {
		DEFAULT_RADIUS,
		deriveTokens,
		isHexColor,
		MAX_CUSTOM_THEMES,
		MAX_RADIUS,
		NAME_MAX_LENGTH,
		validateInput,
		type CustomTheme,
		type CustomThemeInput
	} from '$domain/custom-theme';
	import { checkTheme } from '$domain/theme-contrast';
	import type { ThemeMode } from '$domain/themes';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import ThemePreview from '$components/app/ThemePreview.svelte';
	import { Check, X } from '@lucide/svelte';

	const SWATCHES = ['#d55053', '#c8532a', '#4ea674', '#2a7550', '#3b82c4', '#6a4ba8', '#bd93f9', '#d7bd88'];
	const DEFAULT_SEED = '#4ea674';
	const DEFAULT_TONE = 0.5;

	let editingId = $state<string | null>(null);
	let name = $state('');
	let base = $state<ThemeMode>('light');
	let seed = $state(DEFAULT_SEED);
	let tone = $state(DEFAULT_TONE);
	let radius = $state(DEFAULT_RADIUS);
	let message = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const input = $derived<CustomThemeInput>({ name, base, seed, tone, radius });
	const problems = $derived(validateInput(input));
	const isSeedValid = $derived(isHexColor(seed));
	const isFull = $derived(editingId === null && settings.customThemes.length >= MAX_CUSTOM_THEMES);

	const preview = $derived<CustomTheme | null>(
		isSeedValid
			? { ...input, id: 'custom:preview', tokens: deriveTokens(input) }
			: null
	);
	const checks = $derived(preview ? checkTheme(preview.tokens) : []);

	function edit(theme: CustomTheme): void {
		editingId = theme.id;
		name = theme.name;
		base = theme.base;
		seed = theme.seed;
		tone = theme.tone;
		radius = theme.radius;
		message = null;
	}

	function reset(): void {
		editingId = null;
		name = '';
		base = 'light';
		seed = DEFAULT_SEED;
		tone = DEFAULT_TONE;
		radius = DEFAULT_RADIUS;
	}

	function save(): void {
		const result = settings.saveCustomTheme(input, editingId);

		if (result === 'full') {
			message = t('themes.full', { max: MAX_CUSTOM_THEMES });
			return;
		}
		if (result.length > 0) {
			message = t('themes.refused');
			return;
		}

		message = t('themes.saved');
		reset();
	}

	function download(): void {
		const blob = new Blob([settings.exportCustomThemes()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'familiste-themes.json';
		link.click();
		URL.revokeObjectURL(url);
	}

	async function upload(event: Event): Promise<void> {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;

		try {
			const added = settings.importCustomThemes(await file.text());
			message = added > 0 ? t('themes.imported', { count: added }) : t('themes.importEmpty');
		} catch {
			message = t('themes.importEmpty');
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<svelte:head>
	<title>{t('themes.create')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('themes.create')}</h1>
<p class="text-muted-foreground text-caption mt-1">{t('themes.intro')}</p>

<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<div class="fl-setting">
			<Label for="theme-name" class="text-label mb-2 font-medium">{t('themes.name')}</Label>
			<Input id="theme-name" bind:value={name} maxlength={NAME_MAX_LENGTH} data-test-id="theme-name" />
		</div>

		<fieldset class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('themes.base')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each ['light', 'dark'] as const as value (value)}
					<Label class="fl-choice">
						<input type="radio" name="theme-base" {value} bind:group={base} class="sr-only" data-test-id="theme-base-{value}" />
						{t(`themes.group.${value}`)}
					</Label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('themes.seed')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each SWATCHES as swatch (swatch)}
					<Label class="fl-choice" style="min-inline-size: 2.75rem; padding-inline: 0.5rem;">
						<input type="radio" name="theme-swatch" value={swatch} bind:group={seed} class="sr-only" />
						<span class="block size-6 rounded-full border" style="background:{swatch}" aria-hidden="true"></span>
						<span class="sr-only">{swatch}</span>
					</Label>
				{/each}
			</div>
			<div class="mt-3 flex items-center gap-2">
				<input type="color" bind:value={seed} aria-label={t('themes.seed')} class="size-11 rounded-md border" />
				<Input bind:value={seed} maxlength={7} aria-label={t('themes.hex')} data-test-id="theme-seed" class="max-w-32" />
			</div>
			{#if !isSeedValid}
				<p class="text-destructive text-caption mt-2" role="alert">{t('themes.seedInvalid')}</p>
			{/if}
		</fieldset>

		<div class="fl-setting">
			<Label for="theme-tone" class="text-label mb-2 font-medium">{t('themes.tone')}</Label>
			<input id="theme-tone" type="range" min="0" max="1" step="0.05" bind:value={tone} class="min-h-11 w-full" />
		</div>

		<div class="fl-setting">
			<Label for="theme-radius" class="text-label mb-2 font-medium">{t('themes.radius')}</Label>
			<input id="theme-radius" type="range" min="0" max={MAX_RADIUS} step="0.05" bind:value={radius} class="min-h-11 w-full" />
		</div>

		<div class="fl-setting">
			<p class="text-label mb-2 font-medium">{t('themes.preview')}</p>
			{#if preview}
				<ThemePreview themeId="custom:preview" custom={preview} />
			{/if}

			<p class="text-label mt-4 mb-2 font-medium">{t('themes.checks')}</p>
			<ul class="grid gap-1" data-test-id="theme-checks">
				{#each checks as check (check.id)}
					<li class="text-caption flex items-center gap-2">
						{#if check.isPass}
							<Check size={16} class="text-secondary shrink-0" aria-hidden="true" />
							<span class="sr-only">{t('themes.pass')}</span>
						{:else}
							<X size={16} class="text-destructive shrink-0" aria-hidden="true" />
							<span class="sr-only">{t('themes.fail')}</span>
						{/if}
						<span>{t(`themes.check.${check.id}`)}</span>
						<span class="text-muted-foreground ms-auto tabular-nums">{check.ratio.toFixed(1)}:1</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="fl-setting flex flex-wrap items-center gap-2">
			<Button onclick={save} disabled={problems.length > 0 || isFull} data-test-id="theme-save">
				{t('themes.save')}
			</Button>
			{#if editingId}
				<Button variant="outline" onclick={reset}>{t('themes.cancel')}</Button>
			{/if}
			{#if message}
				<p class="text-caption" role="status" data-test-id="theme-message">{message}</p>
			{/if}
		</div>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<div class="fl-setting">
			<p class="text-label mb-2 font-medium">
				{t('themes.mine', { count: settings.customThemes.length, max: MAX_CUSTOM_THEMES })}
			</p>
			<ul class="grid gap-2">
				{#each settings.customThemes as theme (theme.id)}
					<li class="flex flex-wrap items-center gap-2">
						<span class="me-auto">{theme.name}</span>
						<Button variant="outline" onclick={() => edit(theme)}>{t('themes.edit')}</Button>
						<Button variant="outline" onclick={() => settings.deleteCustomTheme(theme.id)} data-test-id="theme-delete-{theme.id}">
							{t('themes.delete')}
						</Button>
					</li>
				{/each}
			</ul>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button variant="outline" onclick={download} disabled={settings.customThemes.length === 0}>
					{t('themes.export')}
				</Button>
				<Button variant="outline" onclick={() => fileInput?.click()}>{t('themes.import')}</Button>
				<input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" tabindex="-1" onchange={upload} />
			</div>
		</div>
	</Card.Content>
</Card.Root>
