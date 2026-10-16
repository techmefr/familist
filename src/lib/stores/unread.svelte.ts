import { untrack } from 'svelte';
import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { data } from '$stores/data.svelte';
import { unreadIds, type ConversationTip, type LastRead } from '$domain/unread';

const KEY = 'familist:last-read:';

class UnreadStore {
	#lastRead = $state<Record<string, number>>({});
 #pending: Record<string, number> = {};
 #account: string | null = null;
 #generation = 0;
 #writing = false;

 #save() {
  if (!this.#account) return;
  try { localStorage.setItem(KEY + this.#account, JSON.stringify({ read: this.#lastRead, pending: this.#pending })); } catch { /* Retry from memory when storage is unavailable. */ }
 }

 connect(account: string): () => void {
  const generation = ++this.#generation;
  this.#account = account;
  this.#lastRead = {};
  this.#pending = {};
  this.#writing = false;
  try {
   const saved = JSON.parse(localStorage.getItem(KEY + account) ?? '{}');
   const valid = (value: unknown): Record<string, number> => value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([id, at]) => /^[0-9a-f-]{36}$/i.test(id) && typeof at === 'number' && Number.isFinite(at) && at >= 0)) : {};
   this.#lastRead = valid(saved.read);
   this.#pending = valid(saved.pending);
  } catch { /* Fresh device. */ }
  const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void this.#refresh(generation); };
  const channel = supabase.channel(`read-markers:${account}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${account}` }, refresh).subscribe();
  const timer = setInterval(refresh, 30000);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  refresh();
  return () => {
   if (this.#generation === generation) { this.#generation++; this.#account = null; this.#lastRead = {}; this.#pending = {}; }
   clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); void supabase.removeChannel(channel);
  };
 }

 async #refresh(generation: number) {
  await this.#flush(generation);
  try {
   const result = await supabase.rpc('read_markers');
   if (generation !== this.#generation || result.error) return;
   const next = { ...this.#lastRead };
   for (const row of result.data ?? []) next[row.conversation_id] = Math.max(next[row.conversation_id] ?? 0, Number(row.last_read_at));
   this.#lastRead = next; this.#save();
  } catch { /* Keep local read markers while offline. */ }
 }

 async #flush(generation = this.#generation) {
  if (this.#writing || !this.#account || !navigator.onLine) return;
  const account = this.#account;
  this.#writing = true;
  try {
   for (const [id, at] of Object.entries(this.#pending)) {
    if (generation !== this.#generation) return;
    const result = await supabase.rpc('mark_conversation_read', { target: id, read_at: at, expected_user: account });
    if (generation !== this.#generation || result.error) return;
    if ((this.#pending[id] ?? 0) <= at) delete this.#pending[id];
    this.#lastRead = { ...this.#lastRead, [id]: Math.max(this.#lastRead[id] ?? 0, Number(result.data)) }; this.#save();
   }
  } catch { /* Pending reads retry after reconnecting. */ }
  finally { if (generation === this.#generation) this.#writing = false; }
 }

	#tips = $derived<ConversationTip[]>([
		...data.lists.map(list => {
			const last = data.messagesOf(list.id).at(-1);
			return { id: list.id, lastAt: last?.createdAt ?? 0, lastAuthorId: last?.userId ?? null };
		}),
		...data.directs.map(summary => {
			const last = data.messagesOfConversation(summary.conversationId).at(-1);
			return { id: summary.conversationId, lastAt: summary.lastAt, lastAuthorId: last?.userId ?? null };
		})
	]);

	ids = $derived(unreadIds(this.#tips, this.#lastRead as LastRead, data.me));
	count = $derived(this.ids.length);

	isUnread(id: string): boolean {
		return this.ids.includes(id);
	}

	markRead(id: string): void {
  untrack(() => {
   if (!browser || !this.#account) return;
   const at = this.#tips.find(tip => tip.id === id)?.lastAt ?? 0;
   if (at <= (this.#lastRead[id] ?? 0)) return;
   this.#lastRead = { ...this.#lastRead, [id]: at };
   this.#pending[id] = Math.max(this.#pending[id] ?? 0, at);
   this.#save(); void this.#flush();
  });
 }

}

export const unread = new UnreadStore();
