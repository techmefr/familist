export interface WebSubscription { endpoint: string; keys: { p256dh: string; auth: string } }
export function parseWebSubscription(raw: string): WebSubscription | null {
 try {
  if (raw.length > 8192) return null;
  const value = JSON.parse(raw);
  if (typeof value?.endpoint !== 'string') return null;
  const url = new URL(value.endpoint);
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
  if (!/^[A-Za-z0-9_-]{87,88}=?$/.test(value.keys?.p256dh ?? '') || !/^[A-Za-z0-9_-]{22,24}={0,2}$/.test(value.keys?.auth ?? '')) return null;
  return { endpoint: url.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
 } catch { return null; }
}
const TEXT: Record<string, string> = {
 fr: 'Vous avez une nouvelle notification.', en: 'You have a new notification.', es: 'Tienes una nueva notificación.', de: 'Du hast eine neue Benachrichtigung.', it: 'Hai una nuova notifica.', pt: 'Tem uma nova notificação.', ru: 'У вас новое уведомление.', ar: 'لديك إشعار جديد.', zh: '您有一条新通知。', mg: 'Misy fampandrenesana vaovao ho anao.'
};
export function genericWebPayload(locale: string, path: string) {
 return { title: 'Familiste', body: TEXT[locale] ?? TEXT.en, path: path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/' };
}
