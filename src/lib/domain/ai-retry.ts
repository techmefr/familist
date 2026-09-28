/**
 * Retrying an AI/image request that a provider rate-limited or briefly choked on (#382), instead of
 * surfacing the first failure as final.
 *
 * A free-tier key is the common case here (see `ai.ts`'s header on why): its 429 is not "wrong", it is the
 * provider saying "later". Backing off and trying again on our own, with a status the screen can show,
 * turns that into a wait rather than a dead end.
 */

/** 429 (rate limit) and 5xx (the provider's own trouble) are worth another try; nothing else is. */
export function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

/** How many times a request is retried before giving up and reporting a final failure. */
export const MAX_RETRIES = 5;

/** Doubles each time, capped so a person is never asked to wait minutes for one recipe idea. */
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * The wait before attempt `attempt` (1-based: the delay before the *first* retry, after the request that
 * just failed). Exponential, plus a random jitter up to the same amount again so that several tabs or
 * requests queued together do not all wake up and hammer the provider on the same tick.
 *
 * `random` is injectable so a test can assert an exact value; it defaults to `Math.random`.
 */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
	const exponential = BASE_DELAY_MS * 2 ** (attempt - 1);
	const capped = Math.min(exponential, MAX_DELAY_MS);
	return Math.round(capped + capped * random());
}

/** What the screen shows while a queued request waits for its next try. */
export interface RetryStatus {
	/** 1 for the first retry, 2 for the second, and so on. */
	attempt: number;
	/** How many retries remain after this one. */
	retriesLeft: number;
	/** The wait before this attempt fires, in milliseconds. */
	delayMs: number;
}

/** The three ways a call this module drives can end. */
export type RetryOutcome<T> =
	| { ok: true; value: T }
	| { ok: false; reason: 'exhausted'; status?: number }
	| { ok: false; reason: 'failed'; status?: number };

/**
 * What one attempt reports back to `withRetry`: either the finished value, or a failure that names whether
 * it is worth trying again (a status code, when there is one to judge).
 */
export type AttemptResult<T> = { ok: true; value: T } | { ok: false; status?: number };

export interface WithRetryOptions {
	maxRetries?: number;
	/** Called right before each wait starts, so the caller can show it. */
	onRetry?: (status: RetryStatus) => void;
	/** Swapped out in tests for a fake-timer-friendly no-op sleep. */
	sleep?: (ms: number) => Promise<void>;
	random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt`, and on a retryable failure waits (with backoff) and runs it again, up to `maxRetries`
 * times. A non-retryable failure (anything but 429/5xx — a bad key, a malformed prompt) is reported at
 * once: retrying an answer that will not change is only a longer wait for the same "no".
 */
export async function withRetry<T>(
	attempt: () => Promise<AttemptResult<T>>,
	options: WithRetryOptions = {}
): Promise<RetryOutcome<T>> {
	const maxRetries = options.maxRetries ?? MAX_RETRIES;
	const sleep = options.sleep ?? defaultSleep;

	let lastStatus: number | undefined;

	for (let tryNumber = 0; tryNumber <= maxRetries; tryNumber++) {
		const result = await attempt();
		if (result.ok) return { ok: true, value: result.value };

		lastStatus = result.status;
		const retryable = result.status !== undefined && isRetryableStatus(result.status);
		if (!retryable) return { ok: false, reason: 'failed', status: result.status };

		if (tryNumber === maxRetries) break;

		const retryNumber = tryNumber + 1;
		const delayMs = backoffDelayMs(retryNumber, options.random);
		options.onRetry?.({ attempt: retryNumber, retriesLeft: maxRetries - tryNumber - 1, delayMs });
		await sleep(delayMs);
	}

	return { ok: false, reason: 'exhausted', status: lastStatus };
}

type QueuedTask<T> = () => Promise<T>;

/**
 * A same-session, in-memory queue so that concurrent AI calls (a recipe suggestion asked while a dish photo
 * is still generating, say) do not all hit a rate limit and retry-storm the provider together: they run one
 * at a time, each with its own `withRetry`. There is nothing to persist — a page reload drops whatever was
 * queued, same as any other in-flight request today.
 */
export class AiRequestQueue {
	#tail: Promise<unknown> = Promise.resolve();

	run<T>(task: QueuedTask<T>): Promise<T> {
		const result = this.#tail.then(task, task);
		// Swallow the rejection here so one failed task does not poison the chain for the next one; the real
		// rejection still reaches whoever awaited `result`.
		this.#tail = result.catch(() => undefined);
		return result;
	}
}
