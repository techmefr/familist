import { supabase } from '$db/supabase';

export function webPushSupported(): boolean {
 return typeof window !== 'undefined' && window.isSecureContext && typeof Notification !== 'undefined' && 'serviceWorker' in navigator && typeof PushManager !== 'undefined';
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
 if (!webPushSupported()) return null;
 const existing = await navigator.serviceWorker.getRegistration();
 if (existing) return existing;
 let timer: ReturnType<typeof setTimeout> | undefined;
 try { return await Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 8000); })]); }
 finally { clearTimeout(timer); }
}

export async function registerWebPush(userId: string, deviceId: string): Promise<boolean> {
 try {
  const worker = await registration();
  if (!worker || Notification.permission !== 'granted') return false;
  const { data, error } = await supabase.functions.invoke('web-push-config');
  if (error || typeof data?.publicKey !== 'string') return false;
  const encoded = data.publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const key = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), c => c.charCodeAt(0));
  const existing = await worker.pushManager.getSubscription();
  if (existing?.options.applicationServerKey) {
   const previous = new Uint8Array(existing.options.applicationServerKey);
   if (previous.length !== key.length || previous.some((value, i) => value !== key[i])) await existing.unsubscribe();
  }
  const subscription = (await worker.pushManager.getSubscription()) ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const result = await supabase.from('push_tokens').upsert({ user_id: userId, device_id: deviceId, platform: 'web', token: JSON.stringify(subscription.toJSON()), updated_at: new Date().toISOString() });
  return !result.error;
 } catch { return false; }
}

export async function unregisterWebPush(): Promise<void> {
 if (!webPushSupported()) return;
 try { await (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription())?.unsubscribe(); } catch { /* Token is also removed server-side. */ }
}

export async function testWebPush(title: string, body: string): Promise<boolean> {
 try {
  const worker = await registration();
  if (!worker || Notification.permission !== 'granted') return false;
  await worker.showNotification(title, { body, icon: '/icon-192.png', data: { path: '/profile/notifications' } });
  return true;
 } catch { return false; }
}
