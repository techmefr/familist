// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import { parseWebSubscription, genericWebPayload } from './web-push-subscription.ts';
export async function sendWebPush(raw: string, locale: string, path: string): Promise<'ok' | 'dead' | 'failed'> {
 const subscription = parseWebSubscription(raw);
 if (!subscription) return 'dead';
 const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
 const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
 const subject = Deno.env.get('VAPID_SUBJECT');
 if (!publicKey || !privateKey || !subject) return 'failed';
 try {
  await webpush.sendNotification(subscription, JSON.stringify(genericWebPayload(locale, path)), { vapidDetails: { subject, publicKey, privateKey }, TTL: 86400, timeout: 8000 });
  return 'ok';
 } catch (error) {
  const status = (error as { statusCode?: number }).statusCode;
  return status === 404 || status === 410 ? 'dead' : 'failed';
 }
}
