export type UpdateBlocker = 'offline' | 'editing' | 'sync' | 'tabs' | 'error';
export function updateBlocker(state: { online: boolean; editing: boolean; pending: number; syncing: boolean; rejected: number }): UpdateBlocker | null {
 if (!state.online) return 'offline';
 if (state.editing) return 'editing';
 if (state.pending > 0 || state.syncing || state.rejected > 0) return 'sync';
 return null;
}
export function canAutoUpdate(elapsed: number, interacted: boolean, wasOffline: boolean): boolean {
 return elapsed <= 8000 && !interacted && !wasOffline;
}
