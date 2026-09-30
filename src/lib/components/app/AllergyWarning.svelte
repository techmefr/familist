<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { warningsFor, type Eater } from '$domain/person-profile';
	import { ShieldAlert, TriangleAlert, Info } from '@lucide/svelte';

	let { text }: { text: string } = $props();

	const own = $derived<Eater[]>(
		data.householdPersons.map(person => ({
			personId: person.id,
			name: person.name,
			profile: data.profileOf(person.id) ?? null
		}))
	);

	const shared = $derived(
		data.sharedWarnings.flatMap(entry => {
			const person = data.householdPersons.find(candidate => candidate.id === entry.personId);
			return person ? [{ ...entry, name: person.name }] : [];
		})
	);

	const warnings = $derived(warningsFor(text, i18n.locale, own, shared));
</script>

<!--
	Never blocks and never relies on a colour: the icon and the words say how serious it is. It is a status
	region so a screen reader mentions it as the name is typed, politely.
-->
{#if warnings.length > 0}
	<ul class="mt-2 space-y-1" role="status" data-test-id="allergy-warning">
		{#each warnings as warning, index (index)}
			<li class="text-label flex items-start gap-2" data-severity={warning.severity ?? 'shared'}>
				{#if warning.severity === 'severe'}
					<ShieldAlert size={18} class="text-destructive mt-0.5 shrink-0" aria-hidden="true" />
				{:else if warning.severity === 'intolerance'}
					<TriangleAlert size={18} class="mt-0.5 shrink-0 text-[var(--fl-warning)]" aria-hidden="true" />
				{:else}
					<Info size={18} class="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
				{/if}
				<span>
					{t('people.warn', {
						what: warning.kind === 'diet' ? t(`people.diet.${warning.what}`) : warning.what,
						name: warning.name
					})}
					{#if warning.severity}<span class="text-muted-foreground"> · {t(`people.severity.${warning.severity}`)}</span>{/if}
				</span>
			</li>
		{/each}
	</ul>
{/if}
