import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
 count: vi.fn(), reload: vi.fn(), register: vi.fn(), update: vi.fn(), offer: vi.fn(),
 sync: { state: 'idle', rejections: [] },
 pwa: { blocker: null as string | null, offer: vi.fn(), apply: vi.fn(), reset: vi.fn() }
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$db/schema', () => ({ db: { outbox: { count: state.count } } }));
vi.mock('$sync/index.svelte', () => ({ sync: state.sync }));
vi.mock('$stores/pwa-update.svelte', () => ({ pwaUpdate: state.pwa }));
import { registerServiceWorker } from './pwa';

class Element extends EventTarget { isConnected = true; isContentEditable = false; matches() { return true; } closest() { return null; } }
let cleanup: (() => void) | undefined;
let serviceWorker: EventTarget;
let registration: EventTarget & { waiting: { postMessage: ReturnType<typeof vi.fn> }; update: typeof state.update; installing: null };
beforeEach(() => {
 vi.clearAllMocks();
 state.count.mockResolvedValue(0); state.sync.state = 'idle'; state.sync.rejections = []; state.pwa.blocker = null;
 const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
 serviceWorker = Object.assign(new EventTarget(), { controller: {}, register: state.register });
 registration = Object.assign(new EventTarget(), { waiting: { postMessage: vi.fn() }, update: state.update, installing: null });
 state.update.mockResolvedValue(undefined); state.register.mockResolvedValue(registration);
 vi.stubGlobal('document', doc); vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { reload: state.reload } }));
 vi.stubGlobal('navigator', { serviceWorker, onLine: true }); vi.stubGlobal('HTMLElement', Element);
 // Arriving after startup always offers an action instead of reloading an active session.
 vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(9000);
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function start() {
 cleanup = registerServiceWorker();
 await vi.waitFor(() => expect(state.pwa.offer).toHaveBeenCalled());
 return state.pwa.offer.mock.calls[0][0] as () => Promise<void>;
}
describe('PWA update lifecycle', () => {
 it('offers a downloaded update without reloading the active session', async () => {
  await start(); expect(state.pwa.offer.mock.calls[0][1]).toBe(true); expect(state.reload).not.toHaveBeenCalled();
 });
 it('keeps queued writes before activating an update', async () => {
  const apply = await start(); state.count.mockResolvedValue(1); await apply();
  expect(state.pwa.blocker).toBe('sync'); expect(registration.waiting.postMessage).not.toHaveBeenCalled();
 });
 it('does not activate while offline', async () => {
  const apply = await start(); Reflect.set(navigator, 'onLine', false);
  await apply(); expect(state.pwa.blocker).toBe('offline'); expect(registration.waiting.postMessage).not.toHaveBeenCalled();
 });
 it('does not reload another tab that happens to receive controllerchange', async () => {
  await start(); serviceWorker.dispatchEvent(new Event('controllerchange')); expect(state.reload).not.toHaveBeenCalled();
 });
 it('offers manual recovery when more than one app window is open', async () => {
  const apply = await start();
  registration.waiting.postMessage.mockImplementation((_data, ports) => { ports[0].postMessage({ type: 'blocked' }); ports[0].close(); });
  await apply(); expect(state.pwa.blocker).toBe('tabs'); expect(state.reload).not.toHaveBeenCalled();
 });
 it('rechecks queued changes at the worker handshake before confirming activation', async () => {
  const apply = await start();
  registration.waiting.postMessage.mockImplementation((_data, ports) => {
   state.count.mockResolvedValue(1); ports[0].postMessage({ type: 'ready' }); ports[0].onmessage = () => ports[0].close();
  });
  await apply(); expect(state.pwa.blocker).toBe('sync'); expect(state.reload).not.toHaveBeenCalled();
 });
 it('reloads only after the safe activation handshake succeeds', async () => {
  const apply = await start();
  registration.waiting.postMessage.mockImplementation((_data, ports) => {
   ports[0].onmessage = (event: MessageEvent) => { if (event.data.type === 'confirm') { ports[0].postMessage({ type: 'activating' }); ports[0].close(); } };
   ports[0].postMessage({ type: 'ready' });
  });
  await apply(); serviceWorker.dispatchEvent(new Event('controllerchange')); expect(state.reload).toHaveBeenCalledOnce();
 });
});
