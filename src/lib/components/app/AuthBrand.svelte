<script lang="ts">
	import Logo from './Logo.svelte';
	import { t } from '$i18n/index.svelte';
	import { Check, CookingPot, CalendarDays, Users } from '@lucide/svelte';
</script>

<aside class="fl-access-story" aria-hidden="true">
	<div class="fl-access-story-brand"><Logo class="h-10" /><span class="fl-wordmark">{t('app.name')}</span></div>
	<div class="fl-access-story-content">
		<p class="fl-access-story-heading">{t('auth.brandHeadline')}<span>{t('auth.brandHeadlineAccent')}</span></p>
		<p class="fl-access-story-caption">{t('auth.brandTagline')}</p>
		<div class="fl-access-scene">
			<div class="fl-access-list">
				<div class="fl-access-list-title"><span>🛒</span><strong>{t('lists.title')}</strong><Users size={20} /></div>
				{#each [72, 90, 55] as width, index (index)}
					<div class="fl-access-list-row"><span class:checked={index === 0}>{#if index === 0}<Check size={16} />{/if}</span><i style="width: {width}%"></i></div>
				{/each}
				<div class="fl-access-progress"><span></span></div>
			</div>
			<div class="fl-access-mini"><CookingPot size={24} /><span>{t('nav.recipes')}</span><span class="fl-access-mini-emoji">🥕</span></div>
			<div class="fl-access-mini"><CalendarDays size={24} /><span>{t('nav.mealPlan')}</span><span class="fl-access-mini-emoji">🥗</span></div>
		</div>
	</div>
	<p class="fl-access-story-footer">{t('auth.brandFooter')}</p>
</aside>
