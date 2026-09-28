<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import {
		clampStepIndex,
		isFirstStep,
		isLastStep,
		nextStepIndex,
		previousStepIndex,
		speechLangOf,
		stepPosition
	} from '$domain/cook-along';
	import { Button } from '$components/ui/button';
	import { X, ChevronRight, Volume2 } from '@lucide/svelte';
	import { ShoppingBasket, Mic, MicOff, Timer as TimerIcon, Plus } from '@lucide/svelte';
	import { timers } from '$stores/timers.svelte';
	import { formatClock, splitDuration } from '$domain/step-duration';
	import { remindersSupported } from '$native/reminders';
	import { tick } from 'svelte';
	import { ingredientsOfStep } from '$domain/step-ingredients';
	import { VOICE_COMMANDS, stepVolume, type VoiceCommand } from '$domain/voice-commands';
	import { VoiceControl } from '$stores/voice-control.svelte';
	import { keepScreenOn } from '$native/wake-lock';
	import { longpress } from '$components/app/longpress.svelte';
	import type { RecipeIngredient } from '$db/schema';

	let {
		recipeName,
		steps,
		ingredients = [],
		stepIngredientIds = [],
		recipeId,
		stepDurations = [],
		onClose
	}: {
		recipeName: string;
		steps: string[];
		/** The recipe's lines, and for each step the ids of those it uses (#308). */
		ingredients?: RecipeIngredient[];
		stepIngredientIds?: string[][];
		/** The recipe the timers belong to, and each step's duration in seconds (#310). */
		recipeId?: string;
		stepDurations?: (number | null)[];
		onClose: () => void;
	} = $props();

	let index = $state(0);

	let panelOpen = $state(false);
	/** The person asked to see the whole recipe rather than this step's lines. */
	let showAll = $state(false);
	let panelHeading = $state<HTMLElement | null>(null);
	let panelButton = $state<HTMLButtonElement | null>(null);

	const stepLines = $derived(ingredientsOfStep(stepIngredientIds[clampStepIndex(index, steps.length)] ?? [], ingredients));
	/** A step nobody linked falls back to the whole list, so the panel is never empty for an old recipe. */
	const hasStepLines = $derived(stepLines.length > 0);
	const shownLines = $derived(hasStepLines && !showAll ? stepLines : ingredients);

	const lineText = (line: RecipeIngredient) =>
		line.qty ? `${line.qty} ${t(`units.${line.unit}`)} ${line.name}` : line.name;

	async function openPanel(all = false) {
		panelOpen = true;
		showAll = all;
		await tick();
		panelHeading?.focus();
	}

	async function closePanel() {
		panelOpen = false;
		await tick();
		panelButton?.focus();
	}

	/** Only the lines on screen are read: short enough to follow while the hands are busy. */
	function speakIngredients() {
		speak(t('recipes.cookAlong.speakIngredients', { list: shownLines.map(lineText).join(', ') }));
	}

	/**
	 * `null` until we know: `SpeechSynthesis` is missing on some browsers (older Safari, some embedded
	 * webviews), and probing it once at mount rather than on every click keeps the speak button from
	 * flickering between two states.
	 */
	const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

	let speaking = $state(false);
	/** Muted is a choice the person makes; it stays true until they turn it back on, across steps. */
	let muted = $state(false);
	/** Set by voice only ("Famy, plus fort"): the buttons keep the device volume for that. */
	let volume = $state(1);

	const total = $derived(steps.length);
	const current = $derived(steps[clampStepIndex(index, total)] ?? '');
	const position = $derived(stepPosition(index, total));
	const atFirst = $derived(isFirstStep(index, total));
	const atLast = $derived(isLastStep(index, total));

	/** In a right-to-left language the next step sits on the left, so the arrow keys follow it. */
	function isRtl(): boolean {
		return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
	}

	function stop() {
		if (speechAvailable) window.speechSynthesis.cancel();
		speaking = false;
	}

	function speak(text: string) {
		if (!speechAvailable || muted || !text.trim()) return;

		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = speechLangOf(i18n.locale);
		utterance.volume = volume;
		utterance.onend = () => (speaking = false);
		utterance.onerror = () => (speaking = false);
		speaking = true;
		window.speechSynthesis.speak(utterance);
	}

	function go(to: number) {
		index = clampStepIndex(to, total);
		speak(current);
	}

	$effect(() => {
		// Reads the first step out loud as soon as the mode opens, the same way a person cooking with you
		// would start by telling you what to do first rather than waiting to be asked.
		speak(steps[clampStepIndex(0, steps.length)] ?? '');
		return stop;
	});

	$effect(() => keepScreenOn());

	const voiceLabel = (command: VoiceCommand) => t(`recipes.cookAlong.voice.labels.${command}`);

	const voice = new VoiceControl(
		() => ({
			wake: i18n.list('recipes.cookAlong.voice.wake'),
			commands: Object.fromEntries(
				VOICE_COMMANDS.map((command) => [command, i18n.list(`recipes.cookAlong.voice.commands.${command}`)])
			) as Record<VoiceCommand, string[]>
		}),
		() => speechLangOf(i18n.locale),
		runVoiceCommand
	);

	$effect(() => () => voice.stop());

	let introOpen = $state(false);
	let helpOpen = $state(false);
	let voiceButton = $state<HTMLButtonElement | null>(null);
	let introHeading = $state<HTMLElement | null>(null);
	let helpHeading = $state<HTMLElement | null>(null);

	/** The explanation comes once, before the browser's own permission prompt, not on every opening. */
	const INTRO_SEEN_KEY = 'familist:voice-intro-seen';
	/** The full list of commands (#375), shown once on its own — after the intro, before the first use. */
	const HELP_SEEN_KEY = 'familist:voice-help-seen';

	function seen(key: string): boolean {
		try {
			return localStorage.getItem(key) === '1';
		} catch {
			return false;
		}
	}

	function markSeen(key: string) {
		try {
			localStorage.setItem(key, '1');
		} catch {
			// private window: the explanation simply comes back next time
		}
	}

	/** Shown automatically the first time only; afterwards a long press on the mic button reaches it. */
	async function maybeShowHelpFirstTime() {
		if (seen(HELP_SEEN_KEY)) return;
		markSeen(HELP_SEEN_KEY);
		await openHelp();
	}

	async function toggleVoice() {
		if (voice.active) {
			voice.stop();
			return;
		}

		if (!seen(INTRO_SEEN_KEY)) {
			introOpen = true;
			await tick();
			introHeading?.focus();
			return;
		}

		void voice.start();
		void maybeShowHelpFirstTime();
	}

	async function acceptIntro() {
		markSeen(INTRO_SEEN_KEY);
		introOpen = false;
		await tick();
		voiceButton?.focus();
		void voice.start();
		void maybeShowHelpFirstTime();
	}

	async function closeIntro() {
		introOpen = false;
		await tick();
		voiceButton?.focus();
	}

	async function openHelp() {
		helpOpen = true;
		await tick();
		helpHeading?.focus();
	}

	async function closeHelp() {
		helpOpen = false;
		await tick();
		voiceButton?.focus();
	}

	const stepDuration = $derived(stepDurations[clampStepIndex(index, steps.length)] ?? null);
	const recipeTimers = $derived(recipeId ? timers.ofRecipe(recipeId) : []);
	const stepTimer = $derived(recipeId ? timers.forStep(recipeId, clampStepIndex(index, total)) : undefined);
	/** Written only on request (a tap, "Famy, temps restant"): a countdown read out every second is noise. */
	let timerNotice = $state('');

	function startTimer() {
		if (!recipeId) return;
		if (!stepDuration) {
			timerNotice = t('timers.noDuration');
			return speak(timerNotice);
		}

		timers.start({
			recipeId,
			recipeName,
			stepIndex: clampStepIndex(index, total),
			step: current,
			seconds: stepDuration
		});
	}

	/** The ringing one first, then this step's, then the last one started. */
	function stopTimer() {
		const target = timers.ringing[0] ?? stepTimer ?? recipeTimers.at(-1);
		if (target) timers.stop(target.id);
	}

	function spokenDuration(seconds: number): string {
		const { hours, minutes, seconds: rest } = splitDuration(Math.ceil(seconds));
		const parts: string[] = [];
		if (hours) parts.push(t('timers.hours', { count: hours }));
		if (minutes) parts.push(t('timers.minutes', { count: minutes }));
		if (!hours && (rest || !minutes)) parts.push(t('timers.seconds', { count: rest }));

		return parts.join(' ');
	}

	function announceTimers() {
		timerNotice = recipeTimers.length
			? recipeTimers
					.map((timer) =>
						t('timers.remaining', { time: spokenDuration(timers.remaining(timer)), rank: timer.stepIndex + 1 })
					)
					.join(' ')
			: t('timers.none');
		speak(timerNotice);
	}

	function runVoiceCommand(command: VoiceCommand) {
		switch (command) {
			case 'next':
				return go(nextStepIndex(index, total));
			case 'previous':
				return go(previousStepIndex(index, total));
			case 'repeat':
				return speak(current);
			case 'stepIngredients':
			case 'allIngredients':
				if (ingredients.length === 0) return;
				void openPanel(command === 'allIngredients').then(speakIngredients);
				return;
			case 'louder':
			case 'quieter':
				volume = stepVolume(volume, command === 'louder' ? 'up' : 'down');
				return speak(t('recipes.cookAlong.voice.volume', { percent: Math.round(volume * 100) }));
			case 'mute':
				muted = true;
				return stop();
			case 'unmute':
				muted = false;
				return speak(current);
			case 'stopListening':
				return voice.stop();
			case 'help':
				void openHelp();
				return speak(
					t('recipes.cookAlong.voice.speakHelp', { list: VOICE_COMMANDS.map(voiceLabel).join(', ') })
				);
			case 'startTimer':
				return startTimer();
			case 'stopTimer':
				return stopTimer();
			case 'timeLeft':
				return announceTimers();
			case 'close':
				return close();
		}
	}

	const voiceNotice = $derived.by(() => {
		switch (voice.status) {
			case 'listening':
				return t('recipes.cookAlong.voice.listening');
			case 'awake':
				return t('recipes.cookAlong.voice.awake');
			case 'denied':
			case 'unsupported':
			case 'failed':
				return t(`recipes.cookAlong.voice.${voice.status}`);
			default:
				return '';
		}
	});

	const voiceHeard = $derived(
		!voice.active || !voice.lastHeard
			? ''
			: voice.lastHeard.kind === 'command'
				? t('recipes.cookAlong.voice.understood', { command: voiceLabel(voice.lastHeard.command) })
				: t('recipes.cookAlong.voice.notUnderstood', { text: voice.lastHeard.text })
	);

	function close() {
		stop();
		voice.stop();
		onClose();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight';
		const back = isRtl() ? 'ArrowRight' : 'ArrowLeft';

		if (event.key === 'Escape') {
			if (introOpen) void closeIntro();
			else if (helpOpen) void closeHelp();
			else if (panelOpen) void closePanel();
			else close();
		} else if (event.key === forward || event.key === back) {
			// The page behind the dialog would otherwise scroll sideways along with the step.
			event.preventDefault();
			go(event.key === forward ? nextStepIndex(index, total) : previousStepIndex(index, total));
		}
	}}
/>

<div
	transition:fade={{ duration: motionMs(180) }}
	class="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black text-white"
	role="dialog"
	aria-modal="true"
	aria-label={t('recipes.cookAlong.title', { name: recipeName })}
	data-test-id="cook-along"
>
	<div class="flex items-center gap-3 px-4 pt-6 pb-2">
		<button
			type="button"
			onclick={close}
			aria-label={t('common.close')}
			data-test-id="cook-along-close"
			class="grid size-12 min-w-[48px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
		>
			<X size={20} aria-hidden="true" />
		</button>
		<p class="text-product min-w-0 flex-1 text-center font-semibold break-words">{recipeName}</p>

		{#if ingredients.length > 0}
			<button
				bind:this={panelButton}
				type="button"
				onclick={() => openPanel()}
				aria-expanded={panelOpen}
				aria-controls="cook-along-ingredients"
				aria-label={hasStepLines
					? t('recipes.cookAlong.stepIngredientsCount', { count: stepLines.length })
					: t('recipes.cookAlong.ingredients')}
				data-test-id="cook-along-ingredients-open"
				class="grid size-12 min-w-[48px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
			>
				<ShoppingBasket size={20} aria-hidden="true" />
			</button>
		{:else}
			<span class="size-12 min-w-[48px] shrink-0"></span>
		{/if}
	</div>

	<nav aria-label={t('recipes.cookAlong.steps')} class="px-6 pt-6">
		<p
			class="text-product text-center font-semibold text-[#d6d6d6]"
			aria-live="polite"
			aria-atomic="true"
			data-test-id="cook-along-position"
		>
			{t('recipes.cookAlong.position', { current: position.current, total: position.total })}
		</p>

		<!--
			A thin progress bar replaces the numbered dots (#375): the dots read well up to six or seven steps,
			then wrap or shrink past readability on a real recipe. A bar says the same "how far along" at any
			length, and the text above it already gives the exact step, spoken and written.
		-->
		<div
			class="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/15"
			role="progressbar"
			aria-hidden="true"
			data-test-id="cook-along-progress-bar"
		>
			<div
				class="h-full rounded-full bg-white transition-[width]"
				style="width: {(position.current / position.total) * 100}%"
			></div>
		</div>
	</nav>

	<div class="relative flex flex-1 items-center justify-center px-6 py-8">
		{#if total > 0}
			<p
				data-test-id="cook-along-step"
				class="pointer-events-none relative z-10 text-center text-3xl leading-snug font-semibold break-words"
			>
				{current}
			</p>

			<!--
				The whole step half-screen doubles as previous/next, on top of the arrow buttons below: a hand busy
				cooking can tap anywhere left or right of the text instead of aiming for a small button at the
				bottom. Decorative — the labelled buttons underneath are what a screen reader and the keyboard use.
			-->
			<button
				type="button"
				tabindex="-1"
				aria-hidden="true"
				disabled={atFirst}
				onclick={() => go(previousStepIndex(index, total))}
				data-test-id="cook-along-tap-previous"
				class="absolute inset-y-0 start-0 z-0 w-1/2 disabled:pointer-events-none"
			></button>
			<button
				type="button"
				tabindex="-1"
				aria-hidden="true"
				disabled={atLast}
				onclick={() => go(nextStepIndex(index, total))}
				data-test-id="cook-along-tap-next"
				class="absolute inset-y-0 end-0 z-0 w-1/2 disabled:pointer-events-none"
			></button>
		{:else}
			<p class="text-center text-white/70">{t('recipes.cookAlong.empty')}</p>
		{/if}
	</div>

	<div class="mx-auto flex w-full max-w-md flex-col gap-3 px-6 pb-4">
		{#if recipeId && (stepDuration || recipeTimers.length > 0)}
			<section aria-label={t('timers.running')} class="space-y-3" data-test-id="cook-along-timers">
				{#if stepDuration && !stepTimer}
					<Button
						onclick={startTimer}
						data-test-id="cook-along-timer-start"
						class="fl-press h-auto min-h-14 w-full py-2 text-lg whitespace-normal"
					>
						<TimerIcon size={22} aria-hidden="true" />
						{t('timers.start', { time: formatClock(stepDuration) })}
					</Button>
				{/if}

				{#each recipeTimers as timer (timer.id)}
					<div class="rounded-xl border border-white/20 bg-white/10 p-3" data-test-class="cook-along-timer">
						<p id="cook-along-timer-{timer.id}" class="text-label break-words text-white/80">
							{t('timers.stepLabel', { rank: timer.stepIndex + 1 })} · {timer.label}
						</p>
						<p
							role="timer"
							dir="ltr"
							aria-describedby="cook-along-timer-{timer.id}"
							class="text-4xl font-semibold tabular-nums"
							data-test-class="cook-along-timer-clock"
						>
							{formatClock(timers.remaining(timer))}
						</p>
						<div class="mt-2 flex flex-col gap-2 sm:flex-row">
							<Button
								variant="outline"
								onclick={() => timers.addMinute(timer.id)}
								aria-describedby="cook-along-timer-{timer.id}"
								data-test-class="cook-along-timer-add"
								class="fl-press h-auto min-h-12 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
							>
								<Plus size={20} aria-hidden="true" />
								{t('timers.addMinute')}
							</Button>
							<Button
								variant="outline"
								onclick={() => timers.stop(timer.id)}
								aria-describedby="cook-along-timer-{timer.id}"
								data-test-class="cook-along-timer-stop"
								class="fl-press h-auto min-h-12 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
							>
								<X size={20} aria-hidden="true" />
								{t('timers.stop')}
							</Button>
						</div>
					</div>
				{/each}

				{#if recipeTimers.length > 0}
					<Button
						variant="outline"
						onclick={announceTimers}
						data-test-id="cook-along-timer-announce"
						class="fl-press h-auto min-h-14 w-full py-2 whitespace-normal border-white/20 bg-white/10 text-white"
					>
						<Volume2 size={22} aria-hidden="true" />
						{t('timers.announce')}
					</Button>
					{#if !remindersSupported()}
						<p class="text-label break-words text-white/70" data-test-id="cook-along-timer-web-hint">
							{t('timers.webHint')}
						</p>
					{/if}
				{/if}
			</section>
		{/if}
		<p role="status" class="text-label break-words text-center" data-test-id="cook-along-timer-notice">
			{timerNotice}
		</p>

		<!--
			Removed compared to before (#375): the full-width "Ingredients" button — the basket icon in the
			header opens the same panel — and the full-width "Voice commands" button — the help sheet is shown
			automatically the first time, then reached by a long press on the mic button below.
		-->
		<div role="status" aria-live="polite" class="space-y-1 text-center" data-test-id="cook-along-voice-status">
			{#if voiceNotice}
				<p
					class="text-label flex items-center justify-center gap-2 font-semibold"
					data-test-id="cook-along-voice-notice"
					data-test-state={voice.status}
				>
					{#if voice.active}
						<span
							class="grid size-6 shrink-0 place-items-center rounded-full bg-white text-black motion-safe:animate-pulse"
							aria-hidden="true"
						>
							<Mic size={14} />
						</span>
					{/if}
					<span class="min-w-0 break-words">{voiceNotice}</span>
				</p>
			{/if}
			{#if voiceHeard}
				<p class="text-label break-words text-white/80" data-test-id="cook-along-voice-heard">{voiceHeard}</p>
			{/if}
		</div>
	</div>

	{#if introOpen}
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="cook-along-voice-intro-title"
			data-test-id="cook-along-voice-intro"
			class="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/20 bg-neutral-900 p-5 pb-8 md:inset-x-auto md:start-1/2 md:w-[36rem] md:-translate-x-1/2 md:rounded-2xl rtl:md:translate-x-1/2"
		>
			<h2
				id="cook-along-voice-intro-title"
				bind:this={introHeading}
				tabindex="-1"
				class="text-h2 font-semibold break-words hyphens-auto outline-none"
			>
				{t('recipes.cookAlong.voice.introTitle')}
			</h2>
			<p class="text-product mt-3 break-words">{t('recipes.cookAlong.voice.introBody')}</p>
			<p class="text-label mt-3 break-words text-white/75">{t('recipes.cookAlong.voice.introPrivacy')}</p>
			<div class="mt-5 flex flex-col gap-3 sm:flex-row">
				<Button
					variant="outline"
					onclick={closeIntro}
					data-test-id="cook-along-voice-intro-cancel"
					class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
				>
					{t('recipes.cookAlong.voice.introCancel')}
				</Button>
				<Button
					onclick={acceptIntro}
					data-test-id="cook-along-voice-intro-accept"
					class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal"
				>
					<Mic size={22} aria-hidden="true" />
					{t('recipes.cookAlong.voice.introAccept')}
				</Button>
			</div>
		</div>
	{/if}

	{#if helpOpen}
		<div
			id="cook-along-voice-help"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cook-along-voice-help-title"
			data-test-id="cook-along-voice-help"
			class="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/20 bg-neutral-900 p-5 pb-8 md:inset-x-auto md:start-1/2 md:w-[36rem] md:-translate-x-1/2 md:rounded-2xl rtl:md:translate-x-1/2"
		>
			<h2
				id="cook-along-voice-help-title"
				bind:this={helpHeading}
				tabindex="-1"
				class="text-h2 font-semibold break-words hyphens-auto outline-none"
			>
				{t('recipes.cookAlong.voice.helpTitle')}
			</h2>
			<dl class="mt-4 space-y-3">
				{#each VOICE_COMMANDS as command (command)}
					<div class="border-b border-white/15 pb-2 last:border-0" data-test-class="cook-along-voice-command">
						<dt class="text-product font-semibold break-words">{voiceLabel(command)}</dt>
						<dd class="text-label break-words text-white/75">
							{i18n
								.list(`recipes.cookAlong.voice.commands.${command}`)
								.slice(0, 3)
								.join(' · ')}
						</dd>
					</div>
				{/each}
			</dl>
			<Button
				onclick={closeHelp}
				data-test-id="cook-along-voice-help-close"
				class="fl-press mt-5 h-auto min-h-14 w-full py-2 whitespace-normal"
			>
				<X size={22} aria-hidden="true" />
				{t('common.close')}
			</Button>
		</div>
	{/if}

	{#if panelOpen}
		<div
			id="cook-along-ingredients"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cook-along-ingredients-title"
			data-test-id="cook-along-ingredients"
			class="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/20 bg-neutral-900 p-5 pb-8 md:inset-x-auto md:start-1/2 md:w-[36rem] md:-translate-x-1/2 md:rounded-2xl rtl:md:translate-x-1/2"
		>
			<h2
				id="cook-along-ingredients-title"
				bind:this={panelHeading}
				tabindex="-1"
				class="text-h2 font-semibold break-words hyphens-auto outline-none"
			>
				{hasStepLines && !showAll
					? t('recipes.cookAlong.ingredientsOfStep', { current: stepPosition(index, total).current })
					: t('recipes.cookAlong.allIngredients')}
			</h2>

			{#if !hasStepLines}
				<p class="text-label mt-1 text-white/70" data-test-id="cook-along-ingredients-fallback">
					{t('recipes.cookAlong.noStepIngredients')}
				</p>
			{/if}

			<ul class="mt-4 space-y-2" data-test-id="cook-along-ingredients-list">
				{#each shownLines as line (line.id)}
					<li
						class="text-product flex items-baseline justify-between gap-3 border-b border-white/15 pb-2 last:border-0"
						data-test-class="cook-along-ingredient"
					>
						<span class="min-w-0 break-words">{line.name}</span>
						{#if line.qty}
							<span class="shrink-0 font-semibold">{line.qty} {t(`units.${line.unit}`)}</span>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="mt-5 flex flex-col gap-3 sm:flex-row">
				{#if hasStepLines}
					<Button
						variant="outline"
						onclick={() => (showAll = !showAll)}
						aria-pressed={showAll}
						data-test-id="cook-along-ingredients-all"
						class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
					>
						{showAll ? t('recipes.cookAlong.showStepIngredients') : t('recipes.cookAlong.showAllIngredients')}
					</Button>
				{/if}
				{#if speechAvailable}
					<Button
						variant="outline"
						onclick={speakIngredients}
						data-test-id="cook-along-ingredients-speak"
						class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
					>
						<Volume2 size={22} aria-hidden="true" />
						{t('recipes.cookAlong.readIngredients')}
					</Button>
				{/if}
				<Button
					onclick={closePanel}
					data-test-id="cook-along-ingredients-close"
					class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal"
				>
					<X size={22} aria-hidden="true" />
					{t('common.close')}
				</Button>
			</div>
		</div>
	{/if}

	<!--
		Only two controls left (#375): voice mode and "Next". "Previous" is gone — the tap zones over the step
		text and the arrow keys already go back — and voice mode itself merges what used to be two separate
		buttons (read-aloud, voice commands) into the one microphone people actually look for.
	-->
	<div class="flex items-center justify-center gap-3 px-6 pb-10">
		<button
			bind:this={voiceButton}
			use:longpress={openHelp}
			type="button"
			onclick={toggleVoice}
			aria-pressed={voice.active}
			aria-label={t(voice.active ? 'recipes.cookAlong.voice.stop' : 'recipes.cookAlong.voice.start')}
			aria-describedby="cook-along-voice-long-press-hint"
			data-test-id="cook-along-voice-toggle"
			class="fl-press grid size-16 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 aria-pressed:border-white aria-pressed:bg-white/25"
		>
			{#if voice.active}
				<Mic size={26} aria-hidden="true" />
			{:else}
				<MicOff size={26} aria-hidden="true" />
			{/if}
		</button>
		<span id="cook-along-voice-long-press-hint" class="sr-only">{t('recipes.cookAlong.voice.longPressHint')}</span>

		<Button
			disabled={atLast}
			onclick={() => go(nextStepIndex(index, total))}
			data-test-id="cook-along-next"
			class="fl-press h-16 flex-1 rounded-full bg-[#0b6b3a] text-xl font-semibold text-white hover:bg-[#0b6b3a]/90"
		>
			{t('recipes.cookAlong.next')}
			<ChevronRight size={24} aria-hidden="true" class="rtl:rotate-180" />
		</Button>
	</div>
</div>
