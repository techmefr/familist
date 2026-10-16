import { toasts } from './toast.svelte';
import { t } from '$i18n/index.svelte';
import type { UpdateBlocker } from '$domain/pwa-update';

class PwaUpdate {
 available = $state(false);
 applying = $state(false);
 blocker = $state<UpdateBlocker | null>(null);
 #apply: (() => Promise<void>) | null = null;
 #toast: number | null = null;
 offer(apply: () => Promise<void>, announce = true) {
  this.available = true;
  this.#apply = apply;
  if (announce && this.#toast === null) this.#toast = toasts.info(t('updates.available'), { label: t('updates.apply'), run: () => { void this.apply(); } });
 }
 async apply() {
  if (!this.#apply || this.applying) return;
  this.applying = true;
  this.blocker = null;
  try { await this.#apply(); }
  catch { this.blocker = 'error'; }
  finally { this.applying = false; }
 }
 reset() {
  this.available = false; this.applying = false; this.blocker = null; this.#apply = null;
  if (this.#toast !== null) toasts.dismiss(this.#toast);
  this.#toast = null;
 }
}
export const pwaUpdate = new PwaUpdate();
