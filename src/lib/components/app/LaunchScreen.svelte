<script lang="ts">
 import Logo from './Logo.svelte';
 import { t } from '$i18n/index.svelte';
</script>

<main class="fl-launch" aria-busy="true" aria-label={t('common.loading')}>
 <div class="fl-launch-brand">
  <Logo class="fl-launch-logo" />
  <h1 class="fl-wordmark">{t('app.name')}</h1>
 </div>
 <p class="sr-only" role="status">{t('common.loading')}</p>
 <div class="fl-launch-dots" aria-hidden="true"><span></span><span></span><span></span></div>
</main>

<style>
 .fl-launch {
  min-block-size: 100dvh;
  display: grid;
  place-items: center;
  position: relative;
  padding: 2rem 1.5rem 6rem;
  background: #f1ede5;
  color: #24513b;
 }
 .fl-launch-brand { text-align: center; }
 .fl-launch-brand :global(.fl-launch-logo) { height: clamp(7rem, 24vw, 10rem); margin-inline: auto; }
 h1 { margin-block-start: 1rem; font-size: clamp(2rem, 8vw, 2.75rem); line-height: 1.2; overflow-wrap: anywhere; }
 .fl-launch-dots { position: absolute; inset-block-end: max(3rem, env(safe-area-inset-bottom)); display: flex; gap: 0.75rem; }
 .fl-launch-dots span { inline-size: 0.5rem; block-size: 0.5rem; border-radius: 50%; background: #a94008; }
 .fl-launch-dots span:nth-child(2) { opacity: 0.5; }
 .fl-launch-dots span:nth-child(3) { opacity: 0.25; }
</style>
