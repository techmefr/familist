<script lang="ts">
 import type { LocaleMeta } from '$i18n/index.svelte';
 let { locale }: { locale: LocaleMeta } = $props();
</script>
<span class="fl-language-label">
 <img src="/flags/{locale.code}.svg" alt="" aria-hidden="true" width="24" height="24" />
 <span lang={locale.code} dir={locale.dir}>{locale.native}</span>
</span>
<style>
 .fl-language-label { display: inline-flex; align-items: center; gap: 0.5rem; min-inline-size: 0; }
 img { flex: none; inline-size: 1.5rem; block-size: 1.5rem; object-fit: contain; }
 .fl-language-label > span { white-space: nowrap; overflow-wrap: normal; word-break: normal; hyphens: none; }
</style>
