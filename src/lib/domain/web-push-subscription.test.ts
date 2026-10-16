import { describe, it, expect } from 'vitest';
import { parseWebSubscription, genericWebPayload } from '../../../supabase/functions/_shared/web-push-subscription';
const subscription = (endpoint: string) => JSON.stringify({ endpoint, keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } });
describe('Web Push', () => {
 it('accepts the browser push services', () => {
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2.notify.windows.com']) expect(parseWebSubscription(subscription(`https://${host}/token`))).not.toBeNull();
 });
 it('rejects arbitrary URLs, credentials and lookalike hosts', () => {
  for (const endpoint of ['http://fcm.googleapis.com/token', 'https://127.0.0.1/', 'https://fcm.googleapis.com.evil.test/', 'https://user@fcm.googleapis.com/token', 'https://fcm.googleapis.com:444/token']) expect(parseWebSubscription(subscription(endpoint))).toBeNull();
 });
 it('rejects malformed keys and invalid JSON', () => {
  expect(parseWebSubscription('{}')).toBeNull();
  expect(parseWebSubscription('not json')).toBeNull();
  expect(parseWebSubscription(JSON.stringify({ endpoint: 'https://fcm.googleapis.com/token', keys: { p256dh: '', auth: '' } }))).toBeNull();
 });
 it('sends only a generic title, generic body and the destination', () => {
  expect(genericWebPayload('fr', '/cards')).toEqual({ title: 'Familiste', body: 'Vous avez une nouvelle notification.', path: '/cards' });
  expect(Object.keys(genericWebPayload('en', '/chat/d/123')).sort()).toEqual(['body', 'path', 'title']);
  for (const unsafe of ['https://evil.test/', '//evil.test/', '/\\evil.test/']) expect(genericWebPayload('fr', unsafe).path).toBe('/');
 });
});
