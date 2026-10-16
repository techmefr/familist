<script lang="ts">
 import { onMount, untrack } from 'svelte';
 import { Bell, X, MessageCircle, CreditCard } from '@lucide/svelte';
 import { data } from '$stores/data.svelte';
 import { unread } from '$stores/unread.svelte';
 import { badgeText } from '$domain/unread';
 import { pendingCardShares, decideCardShare, type PendingCardShare } from '$stores/card-account';
 import type { CardShareDecision } from '$domain/card-share';
 import { t } from '$i18n/index.svelte';
 import { Button } from '$components/ui/button';

 let dialog = $state<HTMLDialogElement | null>(null);
 let requests = $state<PendingCardShare[]>([]);
 let error = $state(false);
 let loading = $state(false);
 let busy = $state('');
 let generation = 0;
 let disposed = false;
 const count = $derived(requests.length + unread.count);
 const conversations = $derived([
  ...data.lists.filter(list => unread.isUnread(list.id)).map(list => ({ id: list.id, name: list.name, href: `/l/${list.id}/chat` })),
  ...data.directs.filter(summary => unread.isUnread(summary.conversationId)).map(summary => ({ id: summary.conversationId, name: data.member(summary.otherId)?.name ?? t('chat.someone'), href: `/chat/d/${summary.conversationId}` }))
 ]);

 async function load() {
  const current = ++generation;
  loading = true;
  try {
   const result = await pendingCardShares();
   if (disposed || current !== generation) return;
   error = !result.ok;
   if (result.ok) requests = result.value;
  } catch {
   if (!disposed && current === generation) error = true;
  } finally {
   if (!disposed && current === generation) loading = false;
  }
 }
 $effect(() => {
  void data.cardShares;
  untrack(() => { void load(); });
 });
 onMount(() => {
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
  const refresh = () => { if (document.visibilityState === 'visible') void load(); };
  document.addEventListener('visibilitychange', refresh);
  return () => { disposed = true; generation++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
 });
 function show() { dialog?.showModal(); void load(); }
 async function answer(request: PendingCardShare, decision: CardShareDecision) {
  if (busy) return;
  busy = `${request.cardId}:${request.householdId}`;
  error = false;
  try {
   const result = await decideCardShare(request.cardId, request.householdId, decision);
   if (result.ok) { generation++; loading = false; requests = requests.filter(item => item.cardId !== request.cardId || item.householdId !== request.householdId); }
   else error = true;
  } catch { error = true; }
  finally { busy = ''; }
 }
</script>

<button type="button" onclick={show} aria-label={t('notifications.title')} aria-haspopup="dialog" class="fl-notifications-trigger fl-press" data-test-id="header-notifications">
 <Bell size={22} aria-hidden="true" />
 {#if count > 0}<span class="fl-notifications-badge" data-test-id="notifications-count" aria-hidden="true">{badgeText(count)}</span><span class="sr-only">{count}</span>{/if}
</button>
<dialog bind:this={dialog} class="fl-notifications-dialog" aria-labelledby="notification-center-title" data-test-id="notification-center" onclick={event => { if (event.target === dialog) dialog?.close(); }}>
 <header>
  <h2 id="notification-center-title" class="text-h2 font-semibold">{t('notifications.title')}</h2>
  <button type="button" onclick={() => dialog?.close()} aria-label={t('common.close')} class="fl-press fl-notifications-close"><X size={22} aria-hidden="true" /></button>
 </header>
 <div class="fl-notifications-content">
  {#if error}<p role="alert" class="text-destructive">{t('notifications.center.error')}</p><Button variant="outline" onclick={() => void load()} disabled={loading}>{t('sync.retryNow')}</Button>{/if}
  {#if loading && count === 0}<p role="status">{t('common.loading')}</p>
  {:else if count === 0 && !error}<div class="fl-notifications-empty"><Bell size={32} aria-hidden="true" /><p class="font-semibold">{t('notifications.center.empty')}</p><p class="text-muted-foreground">{t('notifications.center.emptyBody')}</p></div>{/if}
  {#if requests.length > 0}
   <h3 class="text-label font-semibold">{t('cards.requestsTitle')}</h3>
   <ul>
    {#each requests as request (`${request.cardId}:${request.householdId}`)}
     <li data-test-class="notification-card-request">
      <CreditCard size={20} aria-hidden="true" />
      <div class="min-w-0 flex-1"><p>{t('cards.requestFrom', { name: request.cardName, person: request.sharedByName })}</p><p class="text-caption text-muted-foreground">{data.circleName(request.householdId)}</p>
       <div class="fl-notifications-actions"><Button disabled={Boolean(busy)} onclick={() => void answer(request, 'accepted')} aria-label={t('cards.requestAcceptLabel', { name: request.cardName })}>{t('cards.requestAccept')}</Button><Button variant="outline" disabled={Boolean(busy)} onclick={() => void answer(request, 'declined')} aria-label={t('cards.requestDeclineLabel', { name: request.cardName })}>{t('cards.requestDecline')}</Button></div>
      </div>
     </li>
    {/each}
   </ul>
  {/if}
  {#if conversations.length > 0}<h3 class="text-label font-semibold">{t('nav.unread', { count: conversations.length })}</h3><ul>{#each conversations as conversation (conversation.id)}<li><MessageCircle size={20} aria-hidden="true" /><a href={conversation.href} onclick={() => dialog?.close()} class="fl-press fl-notification-link">{conversation.name}</a></li>{/each}</ul>{/if}
 </div>
 <footer><a href="/profile/notifications" onclick={() => dialog?.close()} class="fl-press">{t('notifications.center.settings')}</a></footer>
</dialog>

<style>
 .fl-notifications-trigger { display: grid; place-items: center; position: relative; min-inline-size: 44px; min-block-size: 44px; border-radius: 50%; color: var(--muted-foreground); }
 .fl-notifications-badge { position: absolute; inset-block-start: 0; inset-inline-end: 0; border-radius: 999px; min-inline-size: 1.125rem; padding: 0 0.2rem; font-size: 0.7rem; background: var(--fl-info); color: var(--background); font-weight: 700; }
 .fl-notifications-dialog { position: fixed; inset-block: max(1rem, env(safe-area-inset-top)) auto; inset-inline: auto max(1rem, env(safe-area-inset-right)); margin: 0; inline-size: min(26rem, calc(100vw - 2rem)); max-block-size: calc(100dvh - 2rem); overflow-y: auto; border: 1px solid var(--border); border-radius: 1.25rem; background: var(--card); color: var(--card-foreground); box-shadow: var(--fl-shadow-3); padding: 0; }
 .fl-notifications-dialog::backdrop { background: var(--fl-scrim); }
 header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border-block-end: 1px solid var(--border); }
 .fl-notifications-close { display: grid; place-items: center; min-inline-size: 44px; min-block-size: 44px; border-radius: 50%; }
 .fl-notifications-content { padding: 1rem; overflow-wrap: anywhere; }
 .fl-notifications-empty { display: grid; justify-items: center; gap: 0.75rem; text-align: center; padding: 1.5rem 0.5rem; }
 h3 { margin-block: 0.75rem; }
 li { display: flex; align-items: flex-start; gap: 0.75rem; padding-block: 0.75rem; border-block-end: 1px solid var(--border); }
 li :global(svg) { flex-shrink: 0; margin-block-start: 0.5rem; }
 .fl-notifications-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block-start: 0.75rem; }
 .fl-notification-link { display: flex; align-items: center; min-block-size: 44px; flex: 1; }
 footer { padding: 0.5rem 1rem; border-block-start: 1px solid var(--border); }
 footer a { display: flex; align-items: center; min-block-size: 44px; }
</style>
