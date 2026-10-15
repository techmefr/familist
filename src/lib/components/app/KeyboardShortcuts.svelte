<script lang="ts">
 import { t } from '$i18n/index.svelte';
 import { X } from '@lucide/svelte';
 let dialog = $state<HTMLDialogElement | null>(null);
 export function show() { dialog?.showModal(); }
 const entries = [
  ['Ctrl / ⌘ + K', 'search.open'],
  ['Alt + N', 'nav.create'],
  ['Alt + 1', 'nav.lists'],
  ['Alt + 2', 'nav.recipes'],
  ['Alt + 3', 'nav.mealPlan'],
  ['Alt + 4', 'nav.chat'],
  ['Alt + 5', 'nav.cards'],
  ['Alt + 6', 'nav.household']
 ] as const;
</script>

<dialog bind:this={dialog} class="fl-sheet" aria-labelledby="keyboard-title" data-test-id="keyboard-dialog" onclick={(event) => { if (event.target === dialog) dialog?.close(); }}>
 <div class="fl-panel bg-card rounded-2xl border p-6">
  <div class="mb-4 flex items-center justify-between gap-4">
   <h2 id="keyboard-title" class="text-h2 font-semibold">{t('keyboard.title')}</h2>
   <button type="button" onclick={() => dialog?.close()} aria-label={t('common.close')} class="grid size-11 shrink-0 place-items-center rounded-full">
    <X size={20} aria-hidden="true" />
   </button>
  </div>
  <dl class="space-y-3">
   {#each entries as [keys, label]}
    <div class="flex flex-wrap items-center justify-between gap-2">
     <dt>{t(label)}</dt>
     <dd><kbd class="bg-muted rounded-md border px-2 py-1 text-sm">{keys}</kbd></dd>
    </div>
   {/each}
  </dl>
 </div>
</dialog>
