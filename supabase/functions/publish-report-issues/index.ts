/**
 * Opens an issue in the repository's tracker carrying only a report's number.
 *
 * Woken by `public.flush_bug_report_issues()` (pg_cron, every minute): nothing here is triggered by a user
 * action, and nothing here can therefore make a report fail or block the administration screen. The function
 * always answers 200 — an error returned would be read by nobody, whereas a released row will be taken again
 * on the next round.
 *
 * The token lives here and nowhere else. A write token on a repository cannot travel in the client bundle:
 * the bundle is published, and the token would be published with it.
 *
 * Configuration: the instance settings set from `/admin` (#138), with priority to the function secrets when
 * they exist — ISSUE_TRACKER_TOKEN, the token with minimal scope (issues: write on that repository alone),
 * and ISSUE_TRACKER_REPO in `owner/repository` form. ISSUE_TRACKER_API is only useful for a self-hosted
 * forge. While neither answers, the function releases what it has claimed and nothing is published.
 */

import { callRpc, serviceKey } from '../_shared/rpc.ts';
import { type InstanceConfig, resolveSettings } from '../_shared/settings.ts';
import { type ReportToPublish, buildIssue } from './issue.ts';

const TRACKER_KEYS = ['issue_tracker_token', 'issue_tracker_repo', 'issue_tracker_api'] as const;

const rpc = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
	callRpc<T>(name, args, serviceKey());

async function loadTrackerSettings(): Promise<Record<string, string | undefined>> {
	let stored: InstanceConfig = {};

	try {
		stored = (await rpc<InstanceConfig>('instance_config', {})) ?? {};
	} catch (error) {
		// A function deployed ahead of the database must not stop publishing: we fall back on the environment
		// alone, which was all that existed before this migration.
		console.warn('instance_config indisponible', error);
	}

	return resolveSettings(TRACKER_KEYS, Deno.env.toObject(), stored);
}

async function openIssue(
	report: ReportToPublish,
	settings: Record<string, string | undefined>
): Promise<{ number: number; url: string }> {
	const token = settings.issue_tracker_token;
	const repo = settings.issue_tracker_repo;
	if (!token || !repo) throw new Error('suivi du depot non configure');

	const api = settings.issue_tracker_api ?? 'https://api.github.com';

	const response = await fetch(`${api}/repos/${repo}/issues`, {
		method: 'POST',
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			// The API refuses a request with no agent, and the name serves to recognise ourselves in the
			// repository's logs the day an issue arrives with nobody understanding where from.
			'User-Agent': 'familiste-publish-report-issues',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(buildIssue(report))
	});

	if (!response.ok) {
		throw new Error(`issues: ${response.status} ${await response.text()}`);
	}

	const created = (await response.json()) as { number: number; html_url: string };

	return { number: created.number, url: created.html_url };
}

/**
 * Closes the issues of the reports resolved since the last wake-up.
 *
 * Idempotent on purpose: closing an issue already closed is not an error for the tracker, so no claim is
 * needed — an interruption in the middle only means the next round starts again from the same rows.
 */
async function closeResolvedIssues(): Promise<number> {
	const resolved = await rpc<{ id: string; issue_number: number }[]>('list_resolved_report_issues', {});
	if (resolved.length === 0) return 0;

	const settings = await loadTrackerSettings();
	const token = settings.issue_tracker_token;
	const repo = settings.issue_tracker_repo;
	if (!token || !repo) return 0;

	const api = settings.issue_tracker_api ?? 'https://api.github.com';
	let closed = 0;

	for (const report of resolved) {
		const response = await fetch(`${api}/repos/${repo}/issues/${report.issue_number}`, {
			method: 'PATCH',
			headers: {
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'familiste-publish-report-issues',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ state: 'closed', state_reason: 'completed' })
		});

		// An issue deleted or moved by hand answers 404/410: nothing left to close, so the row is marked rather
		// than retried every minute for ever.
		if (!response.ok && response.status !== 404 && response.status !== 410) {
			throw new Error(`issues close: ${response.status} ${await response.text()}`);
		}

		await rpc('mark_bug_report_issue_closed', { target: report.id });
		closed += 1;
	}

	return closed;
}

Deno.serve(async () => {
	const closed = await closeResolvedIssues().catch((error) => {
		console.error('close-resolved-issues', error);
		return 0;
	});

	const publication = await publishPending();

	return Response.json({ closed, publication: await publication.json() });
});

async function publishPending(): Promise<Response> {
	let claimed: string[] = [];

	try {
		const reports = await rpc<ReportToPublish[]>('claim_bug_report_issues', {});
		if (reports.length === 0) {
			return Response.json({ status: 'nothing_to_publish' });
		}

		claimed = reports.map((report) => report.id);

		const settings = await loadTrackerSettings();

		let published = 0;

		for (const report of reports) {
			const issue = await openIssue(report, settings);

			// Marked one by one, and not all at once at the end: an interruption in the middle of the batch must
			// not reopen tomorrow the issues already created. `mark_bug_report_issue` only writes on a row still
			// without a number, so a duplicate has no effect.
			await rpc('mark_bug_report_issue', {
				target: report.id,
				issue_number: issue.number,
				issue_url: issue.url
			});

			claimed = claimed.filter((id) => id !== report.id);
			published += 1;
		}

		return Response.json({ status: 'published', issues: published });
	} catch (error) {
		if (claimed.length > 0) {
			// Released and not lost: the next wake-up will take them again, and the request stays visible in /admin
			// in the meantime.
			await rpc('release_bug_report_issues', { ids: claimed }).catch(() => undefined);
		}

		console.error('publish-report-issues', error);

		return Response.json({ status: 'failed', error: String(error) });
	}
}
