import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { FIXTURE_EMAIL, FIXTURE_PASSWORD, SECOND_EMAIL } from './accounts';
const url = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.E2E_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
async function login(email: string) {
 const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
 const result = await client.auth.signInWithPassword({ email, password: FIXTURE_PASSWORD });
 expect(result.error).toBeNull();
 return { client, id: result.data.user!.id };
}
test('les lectures se synchronisent entre appareils sans traverser les comptes', { tag: '@critical' }, async () => {
 const owner = await login(FIXTURE_EMAIL);
 const device = await login(FIXTURE_EMAIL);
 const other = await login(SECOND_EMAIL);
 const household = await owner.client.rpc('ensure_household');
 expect(household.error).toBeNull();
 const list = await owner.client.from('lists').insert({ name: 'Read markers CI', household_id: household.data }).select('id').single();
 expect(list.error).toBeNull();
 const id = list.data!.id;
 try {
  const mark = (client: typeof owner.client, read_at: number, expected_user = owner.id) => client.rpc('mark_conversation_read', { target: id, read_at, expected_user });
  expect((await mark(owner.client, 2000)).error).toBeNull();
  expect((await mark(device.client, 1000)).data).toBe(2000);
  const seen = await device.client.rpc('read_markers');
  expect(seen.error).toBeNull();
  expect(seen.data).toContainEqual({ conversation_id: id, last_read_at: 2000 });
  expect((await mark(owner.client, 3000, other.id)).error?.code).toBe('42501');
  const privateRows = await other.client.from('conversation_reads').select('*').eq('user_id', owner.id);
  expect(privateRows.error).toBeNull(); expect(privateRows.data).toEqual([]);
  const forged = await other.client.from('conversation_reads').insert({ user_id: owner.id, conversation_id: id, last_read_at: 9999 });
  expect(forged.error).not.toBeNull();
  const outsider = await owner.client.rpc('mark_conversation_read', { target: 'ffffffff-ffff-4fff-8fff-ffffffffffff', read_at: 1000, expected_user: owner.id });
  expect(outsider.error?.code).toBe('42501');
 } finally {
  await owner.client.from('lists').delete().eq('id', id);
  await Promise.all([owner.client.auth.signOut(), device.client.auth.signOut(), other.client.auth.signOut()]);
 }
});
