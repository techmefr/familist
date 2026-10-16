<script lang="ts">
	import PageHeading from '$components/app/PageHeading.svelte';
	import { t } from '$i18n/index.svelte';
	import Logo from '$components/app/Logo.svelte';
	import AuthForm from '$components/app/AuthForm.svelte';
	import { LEGAL_DOCUMENTS, legalPath } from '$domain/legal';

	/**
	 * The title follows the chosen tab: the page announced "Sign in" above a sign-up form, which is exactly
	 * the kind of detail that makes you doubt you clicked in the right place.
	 */
	let mode = $state<'signin' | 'signup'>('signin');

	const title = $derived(mode === 'signin' ? t('auth.title') : t('auth.signUp'));
	const body = $derived(mode === 'signin' ? t('auth.signInBody') : t('auth.signUpBody'));
</script>

<svelte:head>
	<title>{title} — {t('app.name')}</title>
</svelte:head>

<div class="fl-access-page">
	<a href="/welcome" class="fl-access-brand" aria-label={t('app.name')}>
		<Logo class="fl-access-logo" />
		<span class="fl-wordmark">{t('app.name')}</span>
	</a>

	<div class="fl-access-intro">
		<PageHeading>{title}</PageHeading>
		<p>{body}</p>
	</div>

	<div class="fl-access-form">
		<AuthForm bind:mode />
	</div>

	<nav aria-label={t('legal.title')} class="fl-access-legal">
		<ul>
			{#each LEGAL_DOCUMENTS as id (id)}
				<li><a href={legalPath(id)} data-test-id="auth-legal-link-{id}">{t(`legal.${id}`)}</a></li>
			{/each}
		</ul>
	</nav>
</div>
