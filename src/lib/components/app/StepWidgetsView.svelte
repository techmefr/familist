<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import type { StepWidget } from '$domain/step-widgets';
	import { splitDuration } from '$domain/step-duration';
	import { Camera, Flame, Hourglass, TriangleAlert } from '@lucide/svelte';

	let { widgets }: { widgets: StepWidget[] } = $props();

	function waitText(seconds: number): string {
		const { hours, minutes } = splitDuration(seconds);
		const parts: string[] = [];
		if (hours) parts.push(t('timers.hours', { count: hours }));
		if (minutes) parts.push(t('timers.minutes', { count: minutes }));
		return parts.join(' ') || t('timers.minutes', { count: 1 });
	}
</script>

<!--
	The extras of a step, read-only, under its text on the dark cook-along surface. Each one says what it is
	in words next to its icon, and a value the AI import was unsure of says so: the colour never carries it.
-->
{#if widgets.length > 0}
	<ul class="mt-6 flex flex-col items-center gap-3" data-test-id="cook-along-widgets">
		{#each widgets as widget, position (position)}
			<li
				class="text-product flex max-w-full items-start gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-white"
				data-test-class="cook-along-widget"
				data-widget-type={widget.type}
			>
				{#if widget.type === 'appliance'}
					<Flame size={20} class="mt-1 shrink-0" aria-hidden="true" />
					<span class="break-words">
						{t(`recipes.widgets.appliances.${widget.appliance}`)}
						{#if widget.temperature}· {widget.temperature}°C{/if}
						{#if widget.setting}· {widget.setting}{/if}
						{#if widget.toVerify}<strong> · {t('recipes.widgets.toVerify')}</strong>{/if}
					</span>
				{:else if widget.type === 'alert'}
					<TriangleAlert size={20} class="mt-1 shrink-0" aria-hidden="true" />
					<span class="break-words"><strong>{t('recipes.widgets.type.alert')} :</strong> {widget.text}</span>
				{:else if widget.type === 'wait'}
					<Hourglass size={20} class="mt-1 shrink-0" aria-hidden="true" />
					<span class="break-words">
						{t('recipes.widgets.type.wait')} · {waitText(widget.seconds)}
						{#if widget.label}· {widget.label}{/if}
						{#if widget.toVerify}<strong> · {t('recipes.widgets.toVerify')}</strong>{/if}
					</span>
				{:else}
					<Camera size={20} class="mt-1 shrink-0" aria-hidden="true" />
					<span class="break-words">{widget.caption}</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
