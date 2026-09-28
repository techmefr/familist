<script lang="ts">
	import { Label } from '$components/ui/label';
	import { Input } from '$components/ui/input';

	let {
		id,
		label,
		hint,
		value = $bindable(''),
		normalize,
		length,
		testId,
		numeric = true
	}: {
		id: string;
		label: string;
		hint?: string;
		value?: string;
		normalize: (input: string) => string;
		length: number;
		testId: string;
		numeric?: boolean;
	} = $props();
</script>

<!--
	A single field, and not one box per character.

	The six little boxes are everywhere, and they are bad: a screen reader announces six unnamed fields there,
	pasting only works at the cost of a hack, going back one character means guessing which box has focus, and
	a soft keyboard reopens at every jump. A single field takes the code pasted from an email, is corrected
	with backspace, and announces itself once.

	`autocomplete="one-time-code"` is what really counts: on a phone, the code received by SMS or email is
	offered above the keyboard, and there is nothing left to copy.

	The boxed look people expect comes back through `fl-otp-field` (#401): a striped background under the
	field, sized in `em` so it grows with the text instead of clipping the far end of the code once the text
	size is turned up — a fixed `tracking` value used to do exactly that.
-->
<Label for={id}>{label}</Label>
<Input
	{id}
	{value}
	oninput={(event) => {
		const field = event.currentTarget as HTMLInputElement;
		value = normalize(field.value);
		// Write the value back: without that a refused character would stay displayed, the state and the screen
		// would no longer say the same thing, and the person would believe they typed what we threw away.
		field.value = value;
	}}
	inputmode={numeric ? 'numeric' : 'text'}
	autocomplete="one-time-code"
	autocapitalize="characters"
	spellcheck={false}
	maxlength={numeric ? length : length + 1}
	aria-describedby={hint ? `${id}-hint` : undefined}
	data-test-id={testId}
	required
	style="--fl-otp-length: {length}"
	class="fl-otp-field text-product h-auto px-0 py-2 text-center font-medium"
/>

{#if hint}
	<p id="{id}-hint" class="text-muted-foreground text-caption mt-2">{hint}</p>
{/if}
