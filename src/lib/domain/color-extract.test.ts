import { describe, expect, it } from 'vitest';
import { averageColor } from './color-extract';

function image(pixels: [number, number, number][]): ImageData {
	const data = new Uint8ClampedArray(pixels.length * 4);
	pixels.forEach(([r, g, b], index) => {
		data[index * 4] = r;
		data[index * 4 + 1] = g;
		data[index * 4 + 2] = b;
		data[index * 4 + 3] = 255;
	});
	return { data, width: pixels.length, height: 1, colorSpace: 'srgb' } as ImageData;
}

describe('averageColor', () => {
	it('renvoie la couleur seule quand tous les pixels sont identiques', () => {
		expect(
			averageColor(
				image([
					[255, 0, 0],
					[255, 0, 0]
				])
			)
		).toBe('#ff0000');
	});

	it('moyenne les pixels differents', () => {
		expect(
			averageColor(
				image([
					[0, 0, 0],
					[255, 255, 255]
				])
			)
		).toBe('#808080');
	});
});
