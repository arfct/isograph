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
				shape: 'cylinder',
				hatch: 'cross',
				density: 'coarse',
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
				shape: 'pyramid',
				hatch: 'diagonal',
				density: 'medium',
				label: '',
				edge: 'S',
				labelSize: 1.2
			}
		],
		planes: [
			{ id: 3, x: -1, y: -1, w: 8, h: 4, color: 10, label: 'zone', edge: 'N', labelSize: 1 }
		],
		links: [
			{
				id: 4,
				a: 1,
				b: 2,
				style: 'curve',
				bend: 'y',
				dash: 'dotted',
				from: 'NE',
				to: 'W',
				label: 'calls',
				labelSize: 0.5,
				direction: 'both',
				animated: true
			}
		],
		camera: { az: 60, el: 45, zoom: 1.5, tx: 2.5, ty: -1 }
	};
}

/** Encodes a raw payload the way url.ts does, for documents saved by older versions. */
function encodePayload(payload: unknown): string {
	return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
		const [link] = doc.links;
		doc.links.push({ ...link, id: 5, b: 99 }, { ...link, id: 6, a: 2, b: 2 });
		expect(decodeDoc(encodeDoc(doc))?.links.map((l) => l.id)).toEqual([4]);
	});

	it('clamps out-of-range values from hand-edited links', () => {
		const doc = sampleDoc();
		doc.blocks[0] = { ...doc.blocks[0], size: 0, color: 999, labelSize: 50 };
		const block = decodeDoc(encodeDoc(doc))?.blocks[0];
		expect(block?.size).toBe(1);
		expect(block?.color).toBe(12);
		expect(block?.labelSize).toBe(MAX_LABEL_SIZE);
	});

	it('opens links shared before shapes, plane labels and link styles existed', () => {
		const v1 = encodePayload({
			v: 1,
			c: [45, 30, 1, 0, 0],
			b: [
				[1, 0, 0, 2, 1, 1, 1, 0, '', 0.7],
				[2, 4, 0, 2, 1, 1, 1, 0, '', 0.7]
			],
			p: [[3, -1, -1, 8, 4, 2]],
			l: [[4, 1, 2]]
		});
		const doc = decodeDoc(v1);
		expect(doc?.blocks.map((b) => b.shape)).toEqual(['box', 'box']);
		expect(doc?.planes[0]).toMatchObject({ w: 8, h: 4, label: '' });
		expect(doc?.links[0]).toMatchObject({ a: 1, b: 2, style: 'elbow', dash: 'solid' });
	});
});
