<script lang="ts">
	import { Settings2 as PageIcon } from '@lucide/svelte';
	import PageHeading from '$components/app/PageHeading.svelte';
	import { t } from '$i18n/index.svelte';
	import ConnectionSetup from '$components/app/ConnectionSetup.svelte';
</script>

<svelte:head>
	<title>{t('connection.title')} — {t('app.name')}</title>
</svelte:head>

<PageHeading icon={PageIcon} class="text-h1 font-semibold">{t('connection.title')}</PageHeading>
<p class="text-muted-foreground mt-1">{t('connection.subtitle')}</p>

<div class="mt-6">
	<ConnectionSetup />
</div>
