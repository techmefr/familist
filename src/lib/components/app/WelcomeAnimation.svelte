<script lang="ts">
	import { settings } from '$stores/settings.svelte';
</script>

<!--
	The one animated moment of the whole app (#408): three items landing in the cart, one after another,
	looping gently. Everywhere else stays static and hand-drawn on purpose (see `Illustration.svelte`), but
	the very first thing a new person sees deserves a bit of life - this is the one place a small, tasteful
	loop earns its keep instead of becoming noise.

	Drawn the same way as the empty-state illustrations - plain SVG painted with the theme's own colour
	variables, not an imported animation file - so it follows light/dark and never drags in a library or a
	binary asset for a few seconds of motion. `settings.animates` (itself driven by `prefers-reduced-motion`)
	turns it into a static drawing instead of looping.
-->
<svg
	viewBox="0 0 160 120"
	width="120"
	height="90"
	role="presentation"
	aria-hidden="true"
	fill="none"
	class="mx-auto"
	class:fl-welcome-cart-animate={settings.animates}
>
	<path
		d="M20 20 Q80 8 140 20 L128 92 Q80 102 32 92 Z"
		stroke="var(--primary)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	<path d="M16 20 Q80 10 144 20" stroke="var(--primary)" stroke-width="2.5" />
	<circle cx="52" cy="104" r="6" fill="var(--primary)" />
	<circle cx="108" cy="104" r="6" fill="var(--primary)" />

	<g class="fl-welcome-cart-item" style="--fl-item-delay: 0s">
		<rect x="60" y="4" width="16" height="16" rx="4" fill="var(--secondary)" />
	</g>
	<g class="fl-welcome-cart-item" style="--fl-item-delay: 0.35s">
		<circle cx="90" cy="10" r="9" fill="var(--fl-primary-tint)" stroke="var(--primary)" stroke-width="2" />
	</g>
	<g class="fl-welcome-cart-item" style="--fl-item-delay: 0.7s">
		<rect x="34" y="0" width="14" height="18" rx="3" fill="var(--primary)" fill-opacity="0.55" />
	</g>
</svg>
