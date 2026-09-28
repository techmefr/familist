/**
 * A photo attached to a chat message (#366).
 *
 * Same sizing choices as a recipe photo (`photo-resize.ts`): a phone camera shot is shrunk to a comfortable
 * width before it ever leaves the device, so sending one stays quick on a weak connection and the sync
 * payload for everyone else in the thread stays small.
 */
export const CHAT_PHOTO_MAX_SIDE = 1600;

export const CHAT_PHOTO_QUALITY = 0.82;

/** A photo straight off a phone camera can weigh this much; anything bigger is refused before decoding. */
export const CHAT_PHOTO_MAX_BYTES = 25 * 1024 * 1024;

/**
 * The path a chat photo is stored under: the scope first (the list id, or the direct conversation id) —
 * exactly the pattern the `chat_photos_all` storage policy expects, so it can read the guard straight off
 * the name without a lookup on a message row that may not exist yet at upload time.
 */
export function chatPhotoPath(scopeId: string, messageId: string, mimeType: string): string {
	const extension = mimeType === 'image/png' ? 'png' : 'jpg';
	return `${scopeId}/${messageId}.${extension}`;
}
