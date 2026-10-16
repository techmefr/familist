export function ciScope(paths: string[]) {
 const meaningful = paths.filter(path => !(/\.md$/i.test(path) || path.startsWith('docs/') || /^(LICENSE|NOTICE)(\.|$)/.test(path)));
 const backend = meaningful.some(path => path.startsWith('supabase/functions/') || path === 'supabase/config.toml');
 const app = meaningful.some(path => !path.startsWith('supabase/functions/') && !(path.startsWith('.github/') && path !== '.github/workflows/ci.yml' && path !== '.github/workflows/supabase-functions.yml'));
 return { app, backend };
}
