/**
 * The motion values shared by CSS and Svelte. `--fl-ease` and `--fl-dur-*` in src/app.css carry the same
 * numbers (motion-tokens.test.ts reads the CSS and compares), so a transition written in a stylesheet and
 * one written in a component take exactly as long. Components never pass a raw duration to `motionMs()`:
 * they name a step from here.
 */
export const DURATION = {
	/** A press, a hover, a colour change. */
	tap: 180,
	/** Something appearing in place: a banner, a chip. */
	enter: 220,
	/** Something leaving, or a panel unfolding. */
	leave: 280,
	/** A page sliding in or out. */
	page: 320,
	/** A sheet or a pop. */
	in: 340,
	/** A bar filling, a card settling. */
	panel: 380,
	/** A list item rising into place. */
	rise: 440
} as const;

export type DurationStep = keyof typeof DURATION;

export const EASING = {
	/** `--fl-ease`, as a cubic-bezier for `svelte/easing`-style functions and Web Animations. */
	standard: [0.2, 0.8, 0.2, 1]
} as const;

/** Parameters for `svelte/motion` Spring, tuned to read as settled without wobbling. */
export const SPRING = {
	sheet: { stiffness: 0.12, damping: 0.8 },
	pop: { stiffness: 0.2, damping: 0.6 }
} as const;

/** Delay between two neighbours of a staggered entrance, capped so a long list never waits. */
export const STAGGER = { step: 30, max: 240 } as const;

export const staggerDelay = (index: number): number => Math.min(index * STAGGER.step, STAGGER.max);
