import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { FIXTURE_EMAIL, FIXTURE_PASSWORD, SECOND_EMAIL } from './accounts';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
	process.env.E2E_SUPABASE_ANON_KEY ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function signedIn(email: string): Promise<{ client: SupabaseClient; userId: string }> {
	const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
	const { data, error } = await client.auth.signInWithPassword({ email, password: FIXTURE_PASSWORD });
	if (error || !data.user) throw new Error(`cannot sign in ${email}: ${error?.message}`);
	return { client, userId: data.user.id };
}

/**
 * The privacy promise of the people profiles (#475, #480), checked against the real policies and not a
 * mock: a profile is readable, changeable and sharable by the account that wrote it and nobody else, not
 * even another member of the same household.
 */
test('a person profile is invisible to every other account', async () => {
	const owner = await signedIn(FIXTURE_EMAIL);
	const other = await signedIn(SECOND_EMAIL);

	const household = await owner.client.rpc('ensure_household');
	expect(household.error).toBeNull();
	const householdId = household.data as string;

	const person = await owner.client
		.from('household_persons')
		.insert({ household_id: householdId, name: `RLS ${Date.now()}`, created_by: owner.userId })
		.select('id')
		.single();
	expect(person.error).toBeNull();
	const personId = person.data!.id;

	const created = await owner.client.from('person_profiles').insert({
		person_id: personId,
		household_id: householdId,
		owner_id: owner.userId,
		allergies: [{ id: 'peanut', label: 'Peanut', severity: 'severe' }],
		notes: 'secret note'
	});
	expect(created.error).toBeNull();

	const own = await owner.client.from('person_profiles').select('person_id, notes').eq('person_id', personId);
	expect(own.data).toHaveLength(1);

	// Another account reads nothing, changes nothing, takes nothing over.
	const seen = await other.client.from('person_profiles').select('*').eq('person_id', personId);
	expect(seen.data ?? []).toHaveLength(0);

	const changed = await other.client
		.from('person_profiles')
		.update({ notes: 'hijacked' })
		.eq('person_id', personId)
		.select();
	expect(changed.data ?? []).toHaveLength(0);

	const forged = await other.client.from('person_profiles').insert({
		person_id: personId,
		household_id: householdId,
		owner_id: other.userId
	});
	expect(forged.error).not.toBeNull();

	// Sharing is off by default: the warnings function returns nothing to a household member either.
	const warnings = await owner.client.rpc('household_person_warnings', { p_household: householdId });
	expect(warnings.data ?? []).toHaveLength(0);

	await owner.client.from('household_persons').delete().eq('id', personId);
});

test('turning sharing on exposes the warning labels and nothing else', async () => {
	const owner = await signedIn(FIXTURE_EMAIL);
	const household = await owner.client.rpc('ensure_household');
	const householdId = household.data as string;

	const person = await owner.client
		.from('household_persons')
		.insert({ household_id: householdId, name: `Share ${Date.now()}`, created_by: owner.userId })
		.select('id')
		.single();
	const personId = person.data!.id;

	await owner.client.from('person_profiles').insert({
		person_id: personId,
		household_id: householdId,
		owner_id: owner.userId,
		allergies: [{ id: 'peanut', label: 'Peanut', severity: 'severe' }],
		notes: 'secret note',
		share_warnings: true
	});

	const warnings = await owner.client.rpc('household_person_warnings', { p_household: householdId });
	const mine = (warnings.data ?? []).find((row: { person_id: string }) => row.person_id === personId);

	expect(mine).toEqual({ person_id: personId, allergens: ['Peanut'], diets: [] });
	expect(JSON.stringify(mine)).not.toContain('severe');
	expect(JSON.stringify(mine)).not.toContain('secret');

	await owner.client.from('household_persons').delete().eq('id', personId);
});
