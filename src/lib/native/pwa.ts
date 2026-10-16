import { Capacitor } from '@capacitor/core';
import { dev } from '$app/environment';
import { db } from '$db/schema';
import { sync } from '$sync/index.svelte';
import { pwaUpdate } from '$stores/pwa-update.svelte';
import { canAutoUpdate, updateBlocker } from '$domain/pwa-update';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function registerServiceWorker(): (() => void) | undefined {
 if (dev || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
 const started = performance.now();
 let interacted = false;
 let wasOffline = !navigator.onLine;
 let disposed = false;
 let armed = false;
 let registration: ServiceWorkerRegistration | null = null;
 let installing: ServiceWorker | null = null;
 const dirty = new Set<HTMLElement>();
 const engage = (event: Event) => {
  if (armed) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  interacted = true;
 };
 const edit = (event: Event) => {
  engage(event);
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches('input:not([type="search"]),textarea,select') || target.isContentEditable)) dirty.add(target.closest('form') ?? target);
 };
 const reset = (event: Event) => { if (event.target instanceof HTMLElement) dirty.delete(event.target); };
 const offline = () => { wasOffline = true; };
 const safe = async () => {
  for (const element of dirty) if (!element.isConnected || (element.closest('dialog') && !element.closest('dialog')!.open)) dirty.delete(element);
  try {
   const pending = await db.outbox.count();
   return updateBlocker({ online: navigator.onLine, editing: dirty.size > 0, pending, syncing: sync.state === 'syncing', rejected: sync.rejections.length });
  } catch { return 'error' as const; }
 };
 const apply = async () => {
  const waiting = registration?.waiting;
  if (!waiting || disposed) return;
  pwaUpdate.blocker = await safe();
  if (pwaUpdate.blocker) return;
  await new Promise<void>((resolve, reject) => {
   const channel = new MessageChannel();
   const timer = setTimeout(() => { channel.port1.close(); armed = false; reject(new Error('Update handshake timed out')); }, 8000);
   channel.port1.onmessage = async event => {
    if (event.data?.type === 'blocked') {
     pwaUpdate.blocker = 'tabs'; clearTimeout(timer); channel.port1.close(); resolve();
    } else if (event.data?.type === 'ready') {
     pwaUpdate.blocker = await safe();
     armed = !pwaUpdate.blocker && !disposed;
     channel.port1.postMessage({ type: armed ? 'confirm' : 'cancel' });
     if (!armed) { clearTimeout(timer); channel.port1.close(); resolve(); }
    } else if (event.data?.type === 'activating') {
     clearTimeout(timer); channel.port1.close(); resolve();
    }
   };
   waiting.postMessage({ type: 'familist:apply-update' }, [channel.port2]);
  });
 };
 const offer = async () => {
  if (disposed || !registration?.waiting || !navigator.serviceWorker.controller) return;
  const automatic = canAutoUpdate(performance.now() - started, interacted, wasOffline);
  pwaUpdate.offer(apply, !automatic);
  if (automatic) {
   await pwaUpdate.apply();
   if (pwaUpdate.blocker) pwaUpdate.offer(apply);
  }
 };
 const changed = () => { if (installing?.state === 'installed') void offer(); };
 const found = () => {
  installing?.removeEventListener('statechange', changed);
  installing = registration?.installing ?? null;
  installing?.addEventListener('statechange', changed);
 };
 const check = () => { if (navigator.onLine && document.visibilityState === 'visible') void registration?.update().catch(() => {}); };
 const controlled = () => { if (armed && !disposed) window.location.reload(); };
 document.addEventListener('pointerdown', engage, true);
 document.addEventListener('click', engage, true);
 document.addEventListener('beforeinput', engage, true);
 document.addEventListener('keydown', engage, true);
 document.addEventListener('input', edit, true);
 document.addEventListener('change', edit, true);
 document.addEventListener('reset', reset, true);
 document.addEventListener('visibilitychange', check);
 window.addEventListener('offline', offline);
 window.addEventListener('online', check);
 navigator.serviceWorker.addEventListener('controllerchange', controlled);
 const timer = setInterval(check, UPDATE_CHECK_MS);
 void navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then(value => {
  if (disposed) return;
  registration = value;
  registration.addEventListener('updatefound', found);
  found();
  void offer();
  check();
 }).catch(() => {});
 return () => {
  disposed = true; clearInterval(timer); pwaUpdate.reset();
  installing?.removeEventListener('statechange', changed);
  registration?.removeEventListener('updatefound', found);
  document.removeEventListener('pointerdown', engage, true); document.removeEventListener('click', engage, true); document.removeEventListener('beforeinput', engage, true); document.removeEventListener('keydown', engage, true);
  document.removeEventListener('input', edit, true); document.removeEventListener('change', edit, true); document.removeEventListener('reset', reset, true);
  document.removeEventListener('visibilitychange', check); window.removeEventListener('offline', offline); window.removeEventListener('online', check);
  navigator.serviceWorker.removeEventListener('controllerchange', controlled);
 };
}
