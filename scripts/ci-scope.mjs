import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { ciScope } from '../src/lib/domain/ci-scope.ts';
const base = process.env.CI_DIFF_BASE;
const head = process.env.CI_DIFF_HEAD;
let scope = { app: true, backend: true };
if (process.env.CI_EVENT !== 'workflow_dispatch' && /^[0-9a-f]{40}$/.test(base ?? '') && !/^0+$/.test(base) && /^[0-9a-f]{40}$/.test(head ?? '')) {
 try { scope = ciScope(execFileSync('git', ['diff', '--name-only', '-z', base, head], { encoding: 'utf8' }).split('\0').filter(Boolean)); }
 catch { console.log('Diff unavailable: all checks retained.'); }
}
for (const [key, value] of Object.entries(scope)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
console.log(scope);
