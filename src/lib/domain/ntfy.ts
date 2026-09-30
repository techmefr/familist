/**
 * Push without Google (#487): a topic on an ntfy server, which the ntfy Android app (F-Droid) receives. The
 * person subscribes their phone to a hard-to-guess topic and gives the same address to the account.
 *
 * The function POSTs to an address a user typed, so the host is held to an allowlist (ntfy.sh by default,
 * the instance's own list in NTFY_ALLOWED_HOSTS) and only https, a bare origin and a single topic segment
 * pass: the function can never be aimed at an internal address. `src/lib/domain/ntfy.ts` is a byte-for-byte
 * copy for the settings screen, held equal by a test.
 */
export const DEFAULT_NTFY_HOSTS = ['ntfy.sh'];

const TOPIC = /^[A-Za-z0-9_-]{8,64}$/;

export interface NtfyTopic {
	origin: string;
	topic: string;
}

export function parseTopicUrl(raw: string, allowedHosts: readonly string[] = DEFAULT_NTFY_HOSTS): NtfyTopic | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}

	if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
	if (!allowedHosts.map(host => host.toLowerCase()).includes(url.hostname.toLowerCase())) return null;

	const topic = url.pathname.replace(/^\/+|\/+$/g, '');
	if (!TOPIC.test(topic)) return null;

	return { origin: url.origin, topic };
}

export interface NtfyRequest {
	url: string;
	init: { method: 'POST'; headers: Record<string, string>; body: string };
}

/** The JSON publish form: no header encoding to get wrong for accents or scripts other than Latin. */
export function buildNtfyRequest(target: NtfyTopic, title: string, body: string): NtfyRequest {
	return {
		url: target.origin,
		init: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ topic: target.topic, title, message: body || title, priority: 3 })
		}
	};
}
