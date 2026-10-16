import { describe, expect, it } from 'vitest';
import { canAutoUpdate, updateBlocker } from './pwa-update';
const safe = { online: true, editing: false, pending: 0, syncing: false, rejected: 0 };
describe('PWA update safety', () => {
 it('allows a clean idle online session', () => expect(updateBlocker(safe)).toBeNull());
 it('protects unsaved input, queued and rejected changes, and an active sync', () => {
  expect(updateBlocker({ ...safe, editing: true })).toBe('editing');
  expect(updateBlocker({ ...safe, pending: 1 })).toBe('sync');
  expect(updateBlocker({ ...safe, rejected: 1 })).toBe('sync');
  expect(updateBlocker({ ...safe, syncing: true })).toBe('sync');
 });
 it('keeps offline work in place', () => expect(updateBlocker({ ...safe, online: false })).toBe('offline'));
 it('auto-applies only at startup before interaction and without an offline recovery', () => {
  expect(canAutoUpdate(2000, false, false)).toBe(true);
  expect(canAutoUpdate(8001, false, false)).toBe(false);
  expect(canAutoUpdate(2000, true, false)).toBe(false);
  expect(canAutoUpdate(2000, false, true)).toBe(false);
 });
});
