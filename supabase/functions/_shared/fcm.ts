/**
 * Firebase Cloud Messaging, HTTP v1.
 *
 * Only the part that can be tested without the network is exported as pure functions; `FcmClient` does the
 * two calls (an OAuth token from the service account, then one send per device). What leaves for Google is a
 * title, a body and a path to open: no token of ours is ever written to a log.
 */
export interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

export type Channel = 'chats' | 'lists' | 'invitations' | 'reminders' | 'timers';

export const CHANNEL_OF_KIND: Record<string, Channel> = {
	chat: 'chats',
	poll: 'chats',
	list_activity: 'lists',
	invite: 'invitations',
	card_request: 'invitations'
};

export interface FcmMessage {
	message: {
		token: string;
		notification: { title: string; body: string };
		data: { path: string };
		android: { priority: 'HIGH' | 'NORMAL'; notification: { channel_id: Channel; tag: string } };
	};
}

export function buildMessage(input: { token: string; title: string; body: string; path: string; kind: string; tag: string }): FcmMessage {
	return {
		message: {
			token: input.token,
			notification: { title: input.title, body: input.body },
			data: { path: input.path },
			android: {
				priority: 'HIGH',
				notification: { channel_id: CHANNEL_OF_KIND[input.kind] ?? 'chats', tag: input.tag }
			}
		}
	};
}

/** FCM says a token is dead with 404 (UNREGISTERED) or 400 (INVALID_ARGUMENT on the token itself). */
export function isDeadToken(status: number, body: string): boolean {
	if (status === 404) return true;
	return status === 400 && /registration token|INVALID_ARGUMENT/i.test(body) && /token/i.test(body);
}

const b64url = (input: ArrayBuffer | string): string => {
	const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

async function signJwt(account: ServiceAccount): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = b64url(
		JSON.stringify({
			iss: account.client_email,
			scope: 'https://www.googleapis.com/auth/firebase.messaging',
			aud: 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const pem = account.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
	const der = Uint8Array.from(atob(pem), char => char.charCodeAt(0));
	const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
	return `${header}.${claims}.${b64url(signature)}`;
}

export class FcmClient {
	#account: ServiceAccount;
	#token: string | null = null;
	#expires = 0;

	constructor(account: ServiceAccount) {
		this.#account = account;
	}

	async #accessToken(): Promise<string> {
		if (this.#token && Date.now() < this.#expires) return this.#token;

		const response = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: await signJwt(this.#account)
			})
		});
		if (!response.ok) throw new Error(`fcm oauth: ${response.status}`);

		const body = (await response.json()) as { access_token: string; expires_in: number };
		this.#token = body.access_token;
		this.#expires = Date.now() + (body.expires_in - 60) * 1000;
		return this.#token;
	}

	/** `ok` when delivered to FCM, `dead` when the token must be dropped, `failed` for anything worth retrying. */
	async send(message: FcmMessage): Promise<'ok' | 'dead' | 'failed'> {
		const response = await fetch(`https://fcm.googleapis.com/v1/projects/${this.#account.project_id}/messages:send`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.#accessToken()}` },
			body: JSON.stringify(message)
		});
		if (response.ok) return 'ok';

		return isDeadToken(response.status, await response.text()) ? 'dead' : 'failed';
	}
}
