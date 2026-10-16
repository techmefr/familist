import { describe, expect, it } from 'vitest';
import { ciScope } from './ci-scope';
describe('CI scope', () => {
 it('skips application services for documentation only', () => expect(ciScope(['README.md', 'docs/hosting.md'])).toEqual({ app: false, backend: false }));
 it('checks functions without starting the application database', () => expect(ciScope(['supabase/functions/notify/index.ts'])).toEqual({ app: false, backend: true }));
 it('checks both for mixed changes', () => expect(ciScope(['src/app.css', 'supabase/functions/_shared/web-push.ts'])).toEqual({ app: true, backend: true }));
 it('keeps E2E for migrations, dependencies and unknown files', () => { for (const path of ['supabase/migrations/new.sql', 'pnpm-lock.yaml', 'new-config.js', '.github/workflows/ci.yml']) expect(ciScope([path]).app).toBe(true); });
 it('does not replay E2E for unrelated workflows', () => expect(ciScope(['.github/workflows/docker.yml'])).toEqual({ app: false, backend: false }));
 it('checks backend configuration with the app', () => expect(ciScope(['supabase/config.toml'])).toEqual({ app: true, backend: true }));
});
