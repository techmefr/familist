import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiRequestQueue, backoffDelayMs, isRetryableStatus, withRetry } from './ai-retry';

describe('isRetryableStatus', () => {
	it('retries a rate limit and any server error', () => {
		expect(isRetryableStatus(429)).toBe(true);
		expect(isRetryableStatus(500)).toBe(true);
		expect(isRetryableStatus(503)).toBe(true);
	});

	it("ne retente pas ce qu'un nouvel essai ne changerait pas", () => {
		expect(isRetryableStatus(401)).toBe(false);
		expect(isRetryableStatus(400)).toBe(false);
		expect(isRetryableStatus(404)).toBe(false);
	});
});

describe('backoffDelayMs', () => {
	it('double a chaque tentative, jitter compris, avant le plafond', () => {
		expect(backoffDelayMs(1, () => 0)).toBe(1000);
		expect(backoffDelayMs(2, () => 0)).toBe(2000);
		expect(backoffDelayMs(3, () => 0)).toBe(4000);
		expect(backoffDelayMs(1, () => 1)).toBe(2000);
	});

	it('reste plafonne au dela de quelques tentatives', () => {
		expect(backoffDelayMs(10, () => 0)).toBe(30000);
		expect(backoffDelayMs(10, () => 1)).toBe(60000);
	});
});

describe('withRetry', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('renvoie tout de suite le resultat quand ca marche du premier coup', async () => {
		const attempt = vi.fn().mockResolvedValue({ ok: true, value: 'recette' });
		const outcome = await withRetry(attempt, { sleep: async () => {} });

		expect(outcome).toEqual({ ok: true, value: 'recette' });
		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it('retente apres un 429 puis reussit, en attendant le delai annonce', async () => {
		const attempt = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 429 })
			.mockResolvedValueOnce({ ok: true, value: 'recette' });

		const onRetry = vi.fn();
		const promise = withRetry(attempt, { onRetry, random: () => 0 });

		// Let the first attempt run and the backoff timer get armed.
		await vi.advanceTimersByTimeAsync(0);
		expect(attempt).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledWith({ attempt: 1, retriesLeft: 4, delayMs: 1000 });

		await vi.advanceTimersByTimeAsync(1000);
		const outcome = await promise;

		expect(outcome).toEqual({ ok: true, value: 'recette' });
		expect(attempt).toHaveBeenCalledTimes(2);
	});

	it("ne retente pas une reponse que ca ne changerait pas", async () => {
		const attempt = vi.fn().mockResolvedValue({ ok: false, status: 401 });
		const outcome = await withRetry(attempt, { sleep: async () => {} });

		expect(outcome).toEqual({ ok: false, reason: 'failed', status: 401 });
		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it('abandonne apres le nombre maximal de tentatives et le dit', async () => {
		const attempt = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const outcome = await withRetry(attempt, { maxRetries: 2, sleep: async () => {} });

		expect(outcome).toEqual({ ok: false, reason: 'exhausted', status: 503 });
		expect(attempt).toHaveBeenCalledTimes(3);
	});
});

describe('AiRequestQueue', () => {
	it('execute les taches les unes apres les autres, jamais en meme temps', async () => {
		const queue = new AiRequestQueue();
		const order: string[] = [];

		const slow = queue.run(async () => {
			order.push('slow-start');
			await new Promise((resolve) => setTimeout(resolve, 20));
			order.push('slow-end');
			return 'slow';
		});
		const fast = queue.run(async () => {
			order.push('fast-start');
			order.push('fast-end');
			return 'fast';
		});

		await Promise.all([slow, fast]);
		expect(order).toEqual(['slow-start', 'slow-end', 'fast-start', 'fast-end']);
	});

	it("une tache en echec ne bloque pas celle qui suit dans la file", async () => {
		const queue = new AiRequestQueue();
		const failing = queue.run(async () => {
			throw new Error('boom');
		});
		const next = queue.run(async () => 'apres');

		await expect(failing).rejects.toThrow('boom');
		await expect(next).resolves.toBe('apres');
	});
});
