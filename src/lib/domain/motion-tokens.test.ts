import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DURATION, EASING, staggerDelay } from './motion-tokens';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

describe('motion tokens', () => {
	for (const [step, ms] of Object.entries(DURATION)) {
		it(`--fl-dur-${step} is ${ms}ms in the CSS as well`, () => {
			expect(css).toContain(`--fl-dur-${step}: ${ms}ms;`);
		});
	}

	it('uses the same easing curve in the CSS', () => {
		expect(css).toContain(`--fl-ease: cubic-bezier(${EASING.standard.join(', ')});`);
	});

	it('caps the stagger so a long list does not wait', () => {
		expect(staggerDelay(0)).toBe(0);
		expect(staggerDelay(1000)).toBe(240);
	});
});
