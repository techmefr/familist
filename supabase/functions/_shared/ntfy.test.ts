import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildNtfyRequest, parseTopicUrl } from './ntfy';

describe('parseTopicUrl', () => {
	it('accepts a topic on an allowed host', () => {
		expect(parseTopicUrl('https://ntfy.sh/familiste-7f3a9c21')).toEqual({ origin: 'https://ntfy.sh', topic: 'familiste-7f3a9c21' });
		expect(parseTopicUrl('https://push.example.org/abcdefgh', ['push.example.org'])).not.toBeNull();
	});

	it('refuses anything that could aim the function elsewhere', () => {
		for (const bad of [
			'http://ntfy.sh/familiste-7f3a9c21',
			'https://evil.example/familiste-7f3a9c21',
			'https://ntfy.sh:8443/familiste-7f3a9c21',
			'https://user:pw@ntfy.sh/familiste-7f3a9c21',
			'https://ntfy.sh/familiste-7f3a9c21?x=1',
			'https://ntfy.sh/a/b/abcdefgh',
			'https://ntfy.sh/short',
			'https://127.0.0.1/familiste-7f3a9c21',
			'https://ntfy.sh.evil.example/familiste-7f3a9c21',
			'not a url'
		]) {
			expect(parseTopicUrl(bad), bad).toBeNull();
		}
	});
});

describe('buildNtfyRequest', () => {
	it('posts the topic, title and message as JSON to the origin', () => {
		const request = buildNtfyRequest({ origin: 'https://ntfy.sh', topic: 'familiste-7f3a9c21' }, 'Courses', 'Sedra: lait');

		expect(request.url).toBe('https://ntfy.sh');
		expect(JSON.parse(request.init.body)).toEqual({ topic: 'familiste-7f3a9c21', title: 'Courses', message: 'Sedra: lait', priority: 3 });
	});
});

describe('the client copy', () => {
	it('is identical to the function’s', () => {
		const here = readFileSync(new URL('./ntfy.ts', import.meta.url), 'utf8');
		const there = readFileSync(new URL('../../../src/lib/domain/ntfy.ts', import.meta.url), 'utf8');
		expect(there).toBe(here);
	});
});
