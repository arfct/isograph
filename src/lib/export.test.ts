import { describe, expect, it } from 'vitest';
import { exportDoc } from './export';
import { type Doc, defaultCamera, emptyDoc } from './model';

function sampleDoc(): Doc {
	return {
		blocks: [
			{
				id: 1,
				x: 0,
				y: 0,
				size: 2,
				height: 3,
				color: 11,
				shade: 'hatch',
				shape: 'cylinder',
				hatch: 'cross',
				density: 'coarse',
				label: 'api',
				edge: 'E',
				labelSize: 0.7000000001
			},
			{
				id: 2,
				x: 4,
				y: -2,
				size: 2,
				height: 5,
				color: 0,
				shade: 'flat',
				shape: 'sphere',
				hatch: 'diagonal',
				density: 'medium',
				label: '',
				edge: 'S',
				labelSize: 0.7
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
				direction: 'forward',
				animated: true
			}
		],
		camera: { ...defaultCamera(), az: 60 }
	};
}

describe('exportDoc', () => {
	it('tags the file with its format and version', () => {
		expect(exportDoc(emptyDoc())).toMatchObject({ format: 'isograph', version: 1 });
	});

	it('names colours and includes the palette to resolve them', () => {
		const out = exportDoc(sampleDoc());
		expect(out.blocks[0].color).toBe('sky');
		expect(out.planes[0].color).toBe('sage');
		expect(out.palette.sky).toBe('#c7d9e7');
	});

	it('writes labels as objects, or null when empty', () => {
		const out = exportDoc(sampleDoc());
		expect(out.blocks[0].label).toEqual({ text: 'api', edge: 'E', size: 0.7 });
		expect(out.blocks[1].label).toBeNull();
		expect(out.links[0].label).toEqual({ text: 'calls', size: 0.5 });
	});

	it('gives spheres their rendered height', () => {
		expect(exportDoc(sampleDoc()).blocks[1].height).toBe(2);
	});

	it('names link endpoints', () => {
		expect(exportDoc(sampleDoc()).links[0]).toMatchObject({
			from: { block: 1, anchor: 'NE' },
			to: { block: 2, anchor: 'W' }
		});
	});

	it('survives a JSON round trip unchanged', () => {
		const out = exportDoc(sampleDoc());
		expect(JSON.parse(JSON.stringify(out))).toEqual(out);
	});
});
