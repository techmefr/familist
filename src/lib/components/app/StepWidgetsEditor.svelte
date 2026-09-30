<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import {
		APPLIANCES,
		emptyWidget,
		MAX_TEMPERATURE,
		MAX_WIDGETS_PER_STEP,
		STEP_WIDGET_TYPES,
		type StepWidget,
		type StepWidgetType
	} from '$domain/step-widgets';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Plus, Trash2 } from '@lucide/svelte';

	let {
		widgets = $bindable(),
		rank,
		onQuickTimer
	}: {
		widgets: StepWidget[];
		rank: number;
		/** Sets the step's timer, in minutes: the one widget that is a single tap away. */
		onQuickTimer: (minutes: number) => void;
	} = $props();

	const QUICK_MINUTES = [5, 10, 15, 30];
	const SECONDS_PER_HOUR = 3600;

	const isFull = $derived(widgets.length >= MAX_WIDGETS_PER_STEP);

	function add(type: StepWidgetType) {
		if (isFull) return;
		widgets = [...widgets, emptyWidget(type)];
	}

	function remove(position: number) {
		widgets = widgets.filter((_, index) => index !== position);
	}

	function hoursOf(seconds: number): number {
		return Math.round((seconds / SECONDS_PER_HOUR) * 10) / 10;
	}
</script>

<fieldset class="min-w-0 sm:rounded-lg sm:border sm:p-3" data-test-class="recipe-step-widgets">
	<legend class="text-label mb-2 font-semibold sm:px-1">
		{t('recipes.widgets.title', { rank })}
	</legend>

	<div class="flex flex-wrap gap-2" role="group" aria-label={t('recipes.widgets.quickTimer')}>
		{#each QUICK_MINUTES as minutes (minutes)}
			<Button
				type="button"
				variant="outline"
				onclick={() => onQuickTimer(minutes)}
				data-test-class="recipe-step-quick-timer"
				class="fl-press min-h-[max(2.75rem,44px)]"
			>
				{t('recipes.widgets.quickMinutes', { count: minutes })}
			</Button>
		{/each}
	</div>

	{#if widgets.length > 0}
		<ul class="mt-3 space-y-3">
			{#each widgets as widget, position (position)}
				<li class="bg-muted/40 rounded-lg border p-3" data-test-class="recipe-step-widget">
					<div class="flex items-center justify-between gap-2">
						<p class="text-label font-medium">{t(`recipes.widgets.type.${widget.type}`)}</p>
						<Button
							type="button"
							variant="outline"
							onclick={() => remove(position)}
							aria-label={t('recipes.widgets.remove', { type: t(`recipes.widgets.type.${widget.type}`) })}
							class="fl-press"
						>
							<Trash2 size={16} aria-hidden="true" />
						</Button>
					</div>

					{#if widget.type === 'appliance'}
						<div class="mt-2 grid gap-3 sm:grid-cols-3">
							<div>
								<Label for="widget-{rank}-{position}-appliance">{t('recipes.widgets.appliance')}</Label>
								<select
									id="widget-{rank}-{position}-appliance"
									bind:value={widget.appliance}
									class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border px-2"
								>
									{#each APPLIANCES as appliance (appliance)}
										<option value={appliance}>{t(`recipes.widgets.appliances.${appliance}`)}</option>
									{/each}
								</select>
							</div>
							<div>
								<Label for="widget-{rank}-{position}-temperature">{t('recipes.widgets.temperature')}</Label>
								<Input
									id="widget-{rank}-{position}-temperature"
									type="number"
									min="1"
									max={MAX_TEMPERATURE}
									inputmode="numeric"
									value={widget.temperature ?? ''}
									oninput={event => {
										const parsed = Number(event.currentTarget.value);
										widget.temperature = parsed > 0 ? parsed : undefined;
									}}
								/>
							</div>
							<div>
								<Label for="widget-{rank}-{position}-setting">{t('recipes.widgets.setting')}</Label>
								<Input id="widget-{rank}-{position}-setting" bind:value={widget.setting} maxlength={200} />
							</div>
						</div>
					{:else if widget.type === 'alert'}
						<div class="mt-2">
							<Label for="widget-{rank}-{position}-alert">{t('recipes.widgets.alertText')}</Label>
							<Input id="widget-{rank}-{position}-alert" bind:value={widget.text} maxlength={200} />
						</div>
					{:else if widget.type === 'wait'}
						<div class="mt-2 grid gap-3 sm:grid-cols-2">
							<div>
								<Label for="widget-{rank}-{position}-hours">{t('recipes.widgets.waitHours')}</Label>
								<Input
									id="widget-{rank}-{position}-hours"
									type="number"
									min="0.1"
									step="0.1"
									inputmode="decimal"
									value={hoursOf(widget.seconds)}
									oninput={event => {
										const parsed = Number(event.currentTarget.value);
										if (parsed > 0) widget.seconds = Math.round(parsed * SECONDS_PER_HOUR);
									}}
								/>
							</div>
							<div>
								<Label for="widget-{rank}-{position}-label">{t('recipes.widgets.waitLabel')}</Label>
								<Input id="widget-{rank}-{position}-label" bind:value={widget.label} maxlength={200} />
							</div>
						</div>
					{:else}
						<div class="mt-2">
							<Label for="widget-{rank}-{position}-caption">{t('recipes.widgets.caption')}</Label>
							<Input id="widget-{rank}-{position}-caption" bind:value={widget.caption} maxlength={200} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('recipes.widgets.add')}>
		{#each STEP_WIDGET_TYPES as type (type)}
			<Button
				type="button"
				variant="outline"
				disabled={isFull}
				onclick={() => add(type)}
				data-test-class="recipe-step-widget-add-{type}"
				class="fl-press min-h-[max(2.75rem,44px)]"
			>
				<Plus size={16} aria-hidden="true" />
				{t(`recipes.widgets.type.${type}`)}
			</Button>
		{/each}
	</div>
</fieldset>
