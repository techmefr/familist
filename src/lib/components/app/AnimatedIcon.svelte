<script lang="ts">
	import Bell from '@jis3r/icons/icons/bell';
	import Check from '@jis3r/icons/icons/check';
	import ListChecks from '@jis3r/icons/icons/list-checks';
	import MessageCircle from '@jis3r/icons/icons/message-circle';
	import Plus from '@jis3r/icons/icons/plus';
	import Search from '@jis3r/icons/icons/search';
	import Send from '@jis3r/icons/icons/send';
	import Star from '@jis3r/icons/icons/star';
	import Timer from '@jis3r/icons/icons/timer';
	import { settings } from '$stores/settings.svelte';

	const ICONS = {
		bell: Bell,
		check: Check,
		'list-checks': ListChecks,
		'message-circle': MessageCircle,
		plus: Plus,
		search: Search,
		send: Send,
		star: Star,
		timer: Timer
	} as const;

	type AnimatedIconName = keyof typeof ICONS;

	let {
		name,
		size = 22,
		animate = false,
		class: className = ''
	}: { name: AnimatedIconName; size?: number; animate?: boolean; class?: string } = $props();

	const Icon = $derived(ICONS[name]);
</script>

<!--
	Moving Icons (MIT), the Lucide icons with hand-made CSS keyframes. Each one is imported on its own, so a
	screen pays only for what it draws.

	The library also plays its animation on hover whatever `animate` says, and knows nothing of our motion
	setting: `.fl-anim-icon` (app.css) cancels every animation inside when motion is off. The wrapper is
	decorative — the button or link around it carries the accessible name — hence `aria-hidden`.
-->
<span class="fl-anim-icon inline-flex {className}" aria-hidden="true">
	<Icon {size} animate={settings.animates && animate} />
</span>
