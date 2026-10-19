<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { GraduationCap } from '@lucide/svelte';

	/**
	 * The overview tour, not the profile's own: the path handed over matches no screen, so `screenSteps`
	 * falls back on the navigation bar — what a newcomer is looking for here. driver.js and its stylesheet
	 * come down on demand, as from the help menu.
	 */
	async function startTutorial() {
		feedback.play('tap');
		const { startTour } = await import('$tour');
		startTour('/', () => settings.setTourSeen(true));
	}
</script>

<!--
	The tutorial, reachable from the profile next to the install entry: the help menu is one tap away on
	every screen, but somebody who is lost looks in their profile before looking for a question mark.
-->
<Card.Root class="mt-6">
	<Card.Content>
		<Button onclick={startTutorial} data-test-id="tutorial-start" class="fl-press w-full sm:w-auto">
			<GraduationCap size={18} aria-hidden="true" />
			{t('helpMenu.tutorial')}
		</Button>
	</Card.Content>
</Card.Root>
