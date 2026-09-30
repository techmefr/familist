<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto, onNavigate, afterNavigate } from '$app/navigation';
	import { trackPageview } from '$native/analytics';
	import { i18n, t } from '$i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { settings } from '$stores/settings.svelte';
	import { ai } from '$stores/ai.svelte';
	import { imageBanks } from '$stores/image-banks.svelte';
	import { placeCredentials } from '$stores/place-credentials.svelte';
	import { navDirection } from '$domain/motion';
	import { isLegalRoute } from '$domain/legal';
	import { releasesSince } from '$domain/changelog';
	import { RELEASES } from '$lib/changelog/releases';
	import { version as appVersion } from '../../package.json';
	import { pushAppearance, syncAppearance } from '$sync/appearance';
	import { registerServiceWorker } from '$native/pwa';
	import { registerPush } from '$native/push';
	import { watchCrashes } from '$crash/reporter';
	import { install } from '$stores/install.svelte';
	import { reminderPlans } from '$domain/reminder';
	import { applyReminders } from '$native/reminders';
	import { applyNearbyWatch } from '$native/nearby';
	import AppShell from '$components/app/AppShell.svelte';
	import { NAV } from '$components/app/nav-entries';
	import CreateMenu from '$components/app/CreateMenu.svelte';
	import Logo from '$components/app/Logo.svelte';
	import ChangelogModal from '$components/app/ChangelogModal.svelte';
	import Toaster from '$components/app/Toaster.svelte';
	import SearchSheet from '$components/app/SearchSheet.svelte';
	import SetupNeeded from '$components/app/SetupNeeded.svelte';
	import TimerAlarm from '$components/app/TimerAlarm.svelte';
	import { isConfigured } from '$db/supabase';

	let { children } = $props();

	let menu = $state<CreateMenu | null>(null);
	let search = $state<SearchSheet | null>(null);



	i18n.init();
	registerServiceWorker();

	// The session is the first thing that calls the database. On an instance that has none, opening it
	// would only produce failed requests behind the setup screen, and a session stuck on loading.
	if (isConfigured) session.init();

	/**
	 * The error nets, set up before anything else on the page.
	 *
	 * A crash at startup is the most costly — the application does not open at all — and it is exactly
	 * the one we would miss by hooking the listeners later. The two listeners cost nothing as long as
	 * nothing breaks.
	 */
	watchCrashes();

	/**
	 * The opening counter starts here, at launch, and not when the banner appears: what we want to
	 * measure is precisely the fact of coming back. The `beforeinstallprompt` listener must be set up
	 * right away too — the event only passes once, and missed, it is lost for the whole session.
	 */
	install.init();

	/**
	 * The date reminders, re-set as a whole on every change.
	 *
	 * Here and not on the lists page because the device must stay up to date even if you never go back
	 * there: a date chosen by somebody else in the household arrives through the sync, and it is this
	 * effect that turns it into an alarm. Each device schedules its own reminders from its copy — nobody
	 * sends anything to anyone, and everybody is warned.
	 *
	 * Replayed at launch, it also catches up what the system lost: a phone restart or a reinstall empties
	 * the pending alarms.
	 */
	$effect(() => {
		const plans = reminderPlans(
			data.lists.map((list) => {
				const items = data.itemsOf(list.id);

				return {
					listId: list.id,
					name: list.name,
					eventDate: list.eventDate,
					total: items.length,
					done: items.filter((item) => item.checked).length
				};
			}),
			new Date()
		);

		void applyReminders(plans, (plan) => ({
			title: t('lists.reminderTitle', { name: plan.name }),
			body: t('lists.reminderBody', {
				date: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long' }).format(
					new Date(plan.eventDate)
				)
			})
		}));
	});

	/**
	 * The proximity watch, re-set on every change.
	 *
	 * Here and not on the cards page: you pass a shop while doing something else, and the cards page is
	 * precisely the one you do not open when you have forgotten you had a card. The effect only passes on
	 * the current state — shops, cards, setting — and the native layer alone decides whether there is a
	 * watch to start or to stop.
	 */
	$effect(() => {
		void applyNearbyWatch(settings.nearbyCards && session.isApproved, {
			shops: data.shops.map((shop) => ({
				shopId: shop.id,
				name: shop.name,
				brand: shop.brand,
				lat: shop.lat,
				lng: shop.lng
			})),
			cards: data.cards.map((card) => ({
				cardId: card.id,
				name: card.name,
				shopId: card.shopId,
				brand: card.brand
			})),
			texts: (alert) => ({
				title: t('cards.nearbyTitle', { shop: alert.shopName }),
				body: t('cards.nearbyBody', { card: alert.cardName })
			}),
			onOpen: (cardId) => goto(`/cards?card=${cardId}`)
		});
	});

	// Exact comparison: /auth/pending speaks about an account, so it assumes a session. A
	// startsWith('/auth') would make it public and leave the waiting screen up after a sign-out.
	const PUBLIC_ROUTES = ['/auth', '/auth/reset', '/welcome'];
	const isPublic = $derived(PUBLIC_ROUTES.includes(page.url.pathname));

	/**
	 * First opening: we go through the welcome journey, which lets the text size be set before asking
	 * anything. The order is what matters — someone who cannot read the sign-in form cannot read the link
	 * to the settings either.
	 */
	const signedOutHome = $derived(settings.hasSeenWelcome ? '/auth' : '/welcome');

	/**
	 * The access lock is in the database: an unapproved account reads nothing, even calling the API
	 * directly. This redirect is only here to avoid showing an empty shell.
	 */
	$effect(() => {
		if (session.loading) return;

		if (isLegalRoute(page.url.pathname)) return;

		if (!session.isSignedIn) {
			if (!isPublic) goto(signedOutHome);
			return;
		}

		/**
		 * A recovery link signs a person in on purpose, to let them set a new password — not because they
		 * proved they know one. This session is confined to that one screen regardless of where the link's
		 * redirect actually landed: checking the current route alone (`pathname === '/auth/reset'`) would
		 * only protect a person who happens to already be there, and grant full access to anyone who isn't
		 * — a misconfigured redirect-URL allowlist on the Supabase project, for one, falls back to the
		 * site's root.
		 */
		if (session.isPasswordRecovery) {
			if (page.url.pathname !== '/auth/reset') goto('/auth/reset');
			return;
		}

		/**
		 * The session exists but stopped at the password, while the account requires a second factor. This
		 * is not an account awaiting approval: sending them to the waiting screen would tell them something
		 * false, and above all would not give them the field to type their code in.
		 *
		 * The database already refuses every read in this state; this detour additionally avoids starting
		 * the sync, which empties the local tables before filling them.
		 */
		if (session.needsSecondFactor) {
			if (page.url.pathname !== '/auth/mfa') goto('/auth/mfa');
			return;
		}

		if (!session.isApproved) {
			if (page.url.pathname !== '/auth/pending') goto('/auth/pending');
			return;
		}

		if (isPublic || page.url.pathname.startsWith('/auth')) goto('/');
	});

	$effect(() => {
		if (session.isApproved) data.load();
	});

	/**
	 * The AI key is re-read for each account, and forgotten between two.
	 *
	 * The id is read inside the effect so that an account change on the same device re-triggers it:
	 * without it, the previous person's key would stay in memory, and the recipes screen would offer to
	 * spend their credit for somebody else.
	 */
	$effect(() => {
		const id = session.user?.id;

		if (!session.isApproved || !id) {
			ai.reset();
			return;
		}

		ai.load();
		imageBanks.load();
		placeCredentials.load();
	});

	/**
	 * Whether the changelog modal is about to claim the screen: same conditions as `ChangelogModal`'s own
	 * effect, read here so the guided tour does not start underneath it. Both are driven by independent
	 * effects that fire on the same mount, and a native `<dialog>` opening over a driver.js overlay traps
	 * pointer events between the two — Escape closes the dialog, but nothing on either was clickable until
	 * then.
	 */
	const changelogPending = $derived(
		session.isApproved &&
			settings.hasSeenWelcome &&
			settings.lastSeenChangelogVersion !== appVersion &&
			releasesSince(RELEASES, settings.lastSeenChangelogVersion).length > 0
	);

	/**
	 * The tour plays once, on the home screen, once the account is approved.
	 *
	 * driver.js and its stylesheet are loaded on demand: they only serve once in the life of an account,
	 * and making them come down on every opening would be paid by everyone for nobody. The delay lets the
	 * list paint — a bubble pointing at a button not yet rendered lands in the void.
	 *
	 * Being shown counts as seen, abandonment included: offering it again on every start would turn help
	 * into an obstacle. It can be replayed from the profile.
	 */
	$effect(() => {
		if (!session.isApproved || settings.hasSeenTour) return;
		if (page.url.pathname !== '/') return;
		// The changelog modal takes precedence: it is dismissed with a click that this effect's own retries
		// would otherwise race against, and re-runs once `lastSeenChangelogVersion` changes.
		if (changelogPending) return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout>;

		// Up to five tries, three quarters of a second apart: `startTour` reports back when it found no
		// target at all, which happens when the delay landed before the navigation bar had finished
		// painting. Giving up after one silent miss would leave the account stuck without a tour and no way
		// to know it — retrying a few times covers a slow first paint without polling forever.
		const attempt = (triesLeft: number) => {
			timer = setTimeout(async () => {
				const { startTour } = await import('$tour');
				if (cancelled) return;

				const started = startTour(page.url.pathname, () => settings.setTourSeen(true));
				if (!started && triesLeft > 1) attempt(triesLeft - 1);
			}, 700);
		};

		attempt(5);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	/**
	 * This account's first contact with this device: we decide once and for all which of the device or
	 * the database carries the most recent preferences.
	 *
	 * This effect depends only on the id, never on the settings themselves: re-reading it on every colour
	 * change would restart an arbitration in the middle of an edit.
	 */
	$effect(() => {
		const id = session.user?.id;
		if (id) void syncAppearance(settings, id);
	});

	/**
	 * The device hands its push token to the signed-in account when the permission was already given (it is
	 * never asked here, only on the notifications screen), and taps on a notification open the right screen.
	 * The language is kept in the synced settings so the server words each push for this person.
	 */
	$effect(() => {
		const id = session.user?.id;
		if (!id) return;

		settings.setNotificationLocale(i18n.locale);
		void registerPush(
			id,
			path => void goto(path),
			key => t(`notifications.channels.${key}`)
		);
	});

	/**
	 * Then every changed setting goes back to the database. The delay groups bursts — dragging the size
	 * slider crosses six steps, which would make six writes for a single gesture.
	 */
	$effect(() => {
		// Explicit read: it is what subscribes the effect to the whole of the settings.
		settings.snapshot();

		const id = session.user?.id;
		if (!id) return;

		const timer = setTimeout(() => void pushAppearance(settings, id), 600);
		return () => clearTimeout(timer);
	});


	/**
	 * Ctrl+K, ⌘K on Mac: the shortcut everyone already tries in order to search. It doubles the header
	 * button, it does not replace it — on a phone there is no keyboard to type it, and that is where the
	 * application serves most.
	 */
	function surRaccourci(event: KeyboardEvent) {
		if (event.key !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
		if (!session.isApproved) return;

		event.preventDefault();
		void search?.show();
	}


	/**
	 * Page transition through the View Transitions API: the browser photographs the screen, lets
	 * SvelteKit replace the content, then animates the two images. Nothing stays transformed afterwards,
	 * unlike an animated container around the page — the prototype's created a stacking context that
	 * trapped the magnifier and the full-screen card.
	 *
	 * What slides is the root capture, and the navigation bar is named so as to be excluded from it (see
	 * app.css): naming `<main>` would make it a stacking context, and the trap would close the same way.
	 *
	 * The slide direction is set on <html> before starting: the CSS only has to read it. Without browser
	 * support, or with motion refused, navigation stays instant.
	 */
	// Cookie-free audience counting (#GoatCounter), a no-op wherever the instance never set a site — see
	// $native/analytics. `afterNavigate` fires once on mount as well as on every later route change, which
	// is what a single-page app needs since there is no full page load per screen to count on its own.
	afterNavigate((navigation) => {
		if (navigation.to?.url) trackPageview(navigation.to.url.pathname);
	});

	onNavigate((navigation) => {
		if (!settings.animates || !document.startViewTransition) return;
		if (!navigation.to?.url) return;

		document.documentElement.dataset.nav = navDirection(
			navigation.from?.url.pathname ?? '',
			navigation.to.url.pathname,
			NAV.map((entry) => entry.href)
		);

		return new Promise((resolve) => {
			const transition = document.startViewTransition!(async () => {
				resolve();
				await navigation.complete;
			});

			// An interrupted transition rejects its promises — a redirect chained by the access lock, a hidden
			// tab, the next navigation taking over. Without these nets, the console gets an unhandled error
			// while the navigation itself did happen.
			//
			// No "one transition at a time" lock here: the second replaces the first, and a flag to reset always
			// ends up stuck on a promise that never settles — a hidden page, for instance — which would remove
			// transitions for the rest of the session.
			void transition.ready.catch(() => {});
			void transition.updateCallbackDone.catch(() => {});
			void transition.finished.catch(() => {});
		});
	});
</script>

<svelte:window onkeydown={surRaccourci} />

{#if !isConfigured}
	<SetupNeeded />
{:else if session.loading}
	<main class="grid min-h-dvh place-items-center px-4">
		<p class="text-muted-foreground">{t('common.loading')}</p>
	</main>
{:else if !session.isApproved}
	<!--
		The signed-out screens fit in a single card: set at the top, they left two thirds of a page empty
		below them on a large screen. `safe` is the whole rule — when the content exceeds the available
		height, the alignment falls back to the top instead of cutting off the start, which happens as soon
		as a software keyboard opens.
	-->
	<div class="grid min-h-dvh w-full md:grid-cols-2">
		<div
			class="fl-auth-brand relative hidden flex-col justify-between overflow-hidden p-12 md:flex"
			aria-hidden="true"
		>
			<div class="flex items-center gap-3">
				<div class="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white">
					<Logo class="h-6" />
				</div>
				<p class="text-label font-semibold tracking-tight text-white">{t('app.name')}</p>
			</div>

			<div class="mt-auto">
				<h1 class="text-display max-w-md text-balance font-semibold tracking-tight text-white">
					{t('auth.brandHeadline')}
					<span class="text-[#e8885e]">{t('auth.brandHeadlineAccent')}</span>
				</h1>
				<p class="mt-4 max-w-sm text-balance text-white/70">
					{t('auth.brandTagline')}
				</p>
			</div>

			<p class="text-caption mt-8 max-w-sm text-white/40">{t('auth.brandFooter')}</p>
		</div>

		<main class="fl-rise mx-auto flex w-full max-w-md flex-col justify-center-safe px-4 py-10">
			{@render children()}
		</main>
	</div>
{:else}
	<AppShell onCreate={() => menu?.show()} onSearch={() => void search?.show()}>
		{@render children()}
	</AppShell>

	<CreateMenu bind:this={menu} />
	<SearchSheet bind:this={search} />
	<ChangelogModal />
	<Toaster />
	<TimerAlarm />
{/if}
