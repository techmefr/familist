/**
 * Sends the pending push notifications.
 *
 * Woken every minute by `public.flush_push_outbox()` (pg_cron + pg_net), like `notify-admins`: nothing here is
 * triggered by a user action, so nothing here can make a message or a tick fail. The function always answers
 * 200; a row that could not go is released and taken again on the next round.
 *
 * Privacy: the recipients, the tokens and the text all come from `claim_push_outbox`, which resolved them
 * from the membership tables. Google receives a title, a body and a path — no account id, no token of ours in
 * the logs.
 *
 * Configuration: the secret FCM_SERVICE_ACCOUNT (the service account JSON). Without it the rows are released
 * and stay buffered, which is how a fresh instance or an F-Droid-only one behaves.
 */
import { callRpc, serviceKey } from '../_shared/rpc.ts';
import { FcmClient, buildMessage, type ServiceAccount } from '../_shared/fcm.ts';
import { decide, groupRows, parseSettings, type OutboxRow } from '../_shared/notify-rules.ts';
import { DEFAULT_NTFY_HOSTS, buildNtfyRequest, parseTopicUrl } from '../_shared/ntfy.ts';

interface Claimed extends OutboxRow {
	settings: unknown;
	tokens: { deviceId: string; platform: string; token: string }[];
}

function tokenOf(req: Request): string {
	const header = req.headers.get('authorization') ?? '';
	const [scheme, token] = header.split(' ');
	return scheme?.toLowerCase() === 'bearer' && token ? token : serviceKey();
}

function loadAccount(): ServiceAccount | null {
	const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
	if (!raw) return null;
	try {
		const account = JSON.parse(raw) as ServiceAccount;
		return account.project_id && account.client_email && account.private_key ? account : null;
	} catch {
		return null;
	}
}

const ALLOWED_NTFY_HOSTS = (Deno.env.get('NTFY_ALLOWED_HOSTS') ?? '')
	.split(',')
	.map(host => host.trim())
	.filter(Boolean);

/** A topic on an ntfy server, for phones without Google services. */
async function sendNtfy(address: string, title: string, body: string): Promise<'ok' | 'dead' | 'failed'> {
	const target = parseTopicUrl(address, ALLOWED_NTFY_HOSTS.length > 0 ? ALLOWED_NTFY_HOSTS : DEFAULT_NTFY_HOSTS);
	// An address that is no longer acceptable (host removed from the allowlist) is dropped, never retried.
	if (!target) return 'dead';

	try {
		const request = buildNtfyRequest(target, title, body);
		const response = await fetch(request.url, request.init);
		return response.ok ? 'ok' : 'failed';
	} catch {
		return 'failed';
	}
}

Deno.serve(async req => {
	const token = tokenOf(req);
	const rpc = <T>(name: string, args: Record<string, unknown>): Promise<T> => callRpc<T>(name, args, token);
	let claimedIds: string[] = [];

	try {
		const rows = await rpc<Claimed[]>('claim_push_outbox', {});
		if (rows.length === 0) return Response.json({ status: 'nothing_to_send' });
		claimedIds = rows.map(row => row.id);

		const account = loadAccount();
		// Without a Firebase account only the ntfy devices can be served; the rest wait in the buffer.
		const fcm = account ? new FcmClient(account) : null;

		const now = new Date();
		const settled: string[] = [];
		const dead: string[] = [];
		const retry: string[] = [];
		const byId = new Map(rows.map(row => [row.id, row]));

		// Rows the settings refuse are settled without sending; the others are grouped per person and place.
		const allowed: Claimed[] = [];
		for (const row of rows) {
			const settings = parseSettings(row.settings);
			const verdict = decide(row.kind, row.listId, settings, now);
			if (verdict === 'send') allowed.push(row);
			// A quiet hour holds the row back rather than dropping it: it goes out when the hour ends.
			else if (verdict === 'quiet') retry.push(row.id);
			else settled.push(row.id);
		}

		// One push per person and place, worded in the recipient's own language.
		const byRecipient = Map.groupBy(allowed, row => row.recipientId);
		for (const [, theirs] of byRecipient) {
			const locale = parseSettings(theirs[0].settings).locale;

			for (const push of groupRows(theirs, locale)) {
				const row = byId.get(push.ids[0])!;
				let delivered = row.tokens.length === 0;
				let failed = false;

				for (const device of row.tokens) {
					if (device.platform === 'ntfy') {
						const outcome = await sendNtfy(device.token, push.title, push.body);
						if (outcome === 'ok') delivered = true;
						else if (outcome === 'dead') dead.push(device.token);
						else failed = true;
						continue;
					}

					if (!fcm) {
						failed = true;
						continue;
					}
					const outcome = await fcm.send(
						buildMessage({ token: device.token, title: push.title, body: push.body, path: push.path, kind: push.kind, tag: row.groupKey })
					);
					if (outcome === 'ok') delivered = true;
					else if (outcome === 'dead') dead.push(device.token);
					else failed = true;
				}

				// A device that could not be reached this time, and none reached: try again next round.
				if (failed && !delivered) retry.push(...push.ids);
				else settled.push(...push.ids);
			}
		}

		if (dead.length > 0) await rpc('prune_push_tokens', { bad: [...new Set(dead)] });
		const done = settled.filter(id => !retry.includes(id));
		if (done.length > 0) await rpc('mark_push_sent', { ids: done });
		const back = [...new Set(retry)].filter(id => !done.includes(id));
		if (back.length > 0) await rpc('release_push', { ids: back });

		return Response.json({ status: 'sent', sent: done.length, retry: back.length });
	} catch (error) {
		// The message never contains a token: only our own text.
		console.error('notify failed:', error instanceof Error ? error.message : 'unknown');
		if (claimedIds.length > 0) {
			try {
				await rpc('release_push', { ids: claimedIds });
			} catch {
				// Nothing more to do: the claim expires by itself after five minutes.
			}
		}
		return Response.json({ status: 'error' });
	}
});
