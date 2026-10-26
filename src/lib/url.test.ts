import { describe, expect, it } from 'vitest';
import { type Doc, defaultCamera, emptyDoc, MAX_LABEL_SIZE } from './model';
import { decodeDoc, encodeDoc } from './url';

function sampleDoc(): Doc {
	return {
		blocks: [
			{
				id: 1,
				x: 0,
				y: 0,
				size: 2,
				height: 3,
				color: 4,
				shade: 'hatch',
				label: 'api ✓',
				edge: 'E',
				labelSize: 0.7
			},
			{
				id: 2,
				x: 4,
				y: -2,
				size: 1,
				height: 1,
				color: 0,
				shade: 'dither',
				label: '',
				edge: 'S',
				labelSize: 1.2
			}
		],
		planes: [{ id: 3, x: -1, y: -1, w: 8, h: 4, color: 10 }],
		links: [{ id: 4, a: 1, b: 2 }],
		camera: { az: 60, el: 45, zoom: 1.5, tx: 2.5, ty: -1 }
	};
}

describe('encodeDoc', () => {
	it('leaves the hash empty for a blank document at the default camera', () => {
		expect(encodeDoc(emptyDoc())).toBe('');
	});

	it('encodes a moved camera even with nothing drawn', () => {
		expect(encodeDoc({ ...emptyDoc(), camera: { ...defaultCamera(), az: 90 } })).not.toBe('');
	});

	it('produces URL-safe base64', () => {
		expect(encodeDoc(sampleDoc())).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe('decodeDoc', () => {
	it('round-trips a document, including non-ASCII labels', () => {
		expect(decodeDoc(encodeDoc(sampleDoc()))).toEqual(sampleDoc());
	});

	it('rejects input that is not an encoded document', () => {
		expect(decodeDoc('not base64 json!')).toBeNull();
	});

	it('drops links whose endpoints are missing or identical', () => {
		const doc = sampleDoc();
		doc.links.push({ id: 5, a: 1, b: 99 }, { id: 6, a: 2, b: 2 });
		expect(decodeDoc(encodeDoc(doc))?.links).toEqual([{ id: 4, a: 1, b: 2 }]);
	});

	it('clamps out-of-range values from hand-edited links', () => {
		const doc = sampleDoc();
		doc.blocks[0] = { ...doc.blocks[0], size: 0, color: 999, labelSize: 50 };
		const block = decodeDoc(encodeDoc(doc))?.blocks[0];
		expect(block?.size).toBe(1);
		expect(block?.color).toBe(12);
		expect(block?.labelSize).toBe(MAX_LABEL_SIZE);
	});
});
