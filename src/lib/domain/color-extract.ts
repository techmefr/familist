/**
 * The dominant colour of a photographed or imported card, read straight off its pixels.
 *
 * No model, no network call: a card photo is almost always one flat colour behind some text and a logo, so
 * a plain average of a downscaled copy already lands close to it, and costs nothing beyond drawing to a
 * canvas nobody sees. It only ever suggests a colour — the person still picks from the palette afterwards,
 * and can change it in one tap if the guess is off.
 */

/** Small enough that decoding and averaging is instant, big enough that a logo or a barcode washes out. */
const SAMPLE_SIZE = 24;

function toHex(channel: number): string {
	return Math.max(0, Math.min(255, Math.round(channel)))
		.toString(16)
		.padStart(2, '0');
}

/** `null` when the browser refuses to give pixel data back (a canvas tainted by a cross-origin image). */
export function averageColor(imageData: ImageData): string {
	let r = 0;
	let g = 0;
	let b = 0;
	const pixels = imageData.data.length / 4;

	for (let i = 0; i < imageData.data.length; i += 4) {
		r += imageData.data[i];
		g += imageData.data[i + 1];
		b += imageData.data[i + 2];
	}

	return `#${toHex(r / pixels)}${toHex(g / pixels)}${toHex(b / pixels)}`;
}

/** Reads a card photo and returns its average colour as a hex string, or null if it could not be decoded. */
export async function dominantColor(file: File): Promise<string | null> {
	try {
		const bitmap = await createImageBitmap(file);
		const canvas = document.createElement('canvas');
		canvas.width = SAMPLE_SIZE;
		canvas.height = SAMPLE_SIZE;

		const context = canvas.getContext('2d');
		if (!context) return null;

		context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
		return averageColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE));
	} catch {
		return null;
	}
}
