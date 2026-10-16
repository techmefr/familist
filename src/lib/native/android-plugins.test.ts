import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('Android builds without a Google scanner', () => {
 for (const flavor of ['play', 'fdroid']) it(`uses the portable scanner in the ${flavor} build`, async () => {
  vi.stubEnv('FAMILIST_FLAVOR', flavor); vi.resetModules();
  const { default: config } = await import('../../../capacitor.config');
  const plugins = config.android?.includePlugins ?? [];
  expect(plugins).not.toContain('@capacitor-mlkit/barcode-scanning');
  expect(plugins).toContain('@capacitor/local-notifications');
  expect(plugins).toContain('@capawesome-team/capacitor-android-foreground-service');
  if (flavor === 'fdroid') expect(plugins).not.toContain('@capacitor/push-notifications');
  else expect(plugins).toContain('@capacitor/push-notifications');
 });
});
