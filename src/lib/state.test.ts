import { beforeEach, describe, expect, it } from 'vitest';
import { defaultCamera, type Doc } from './model';
import {
	addBlock,
	addLink,
	addPlane,
	copySelection,
	deleteSelection,
	describeSelection,
	doc,
	loadDoc,
	moveSelection,
	pasteClipboard,
	select,
	selectAll,
	selectedBlock,
	selectionKind,
	toggleSelect,
	ui
} from './state.svelte';

function emptyScene(): Doc {
	return { blocks: [], planes: [], links: [], camera: defaultCamera() };
}

describe('selection', () => {
	beforeEach(() => loadDoc(emptyScene()));

	it('toggles items in and out of the selection', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		select({ kind: 'block', id: a.id });
		toggleSelect({ kind: 'block', id: b.id });
		expect(ui.selection.map((s) => s.id)).toEqual([a.id, b.id]);
		toggleSelect({ kind: 'block', id: a.id });
		expect(ui.selection.map((s) => s.id)).toEqual([b.id]);
	});

	it('reports a lone block only when it is the whole selection', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		select({ kind: 'block', id: a.id });
		expect(selectedBlock()?.id).toBe(a.id);
		toggleSelect({ kind: 'block', id: b.id });
		expect(selectedBlock()).toBeUndefined();
	});

	it('names the selection by kind', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		const p = addPlane(0, 0, 3, 3);
		select({ kind: 'block', id: a.id });
		expect(describeSelection()).toBe('block');
		toggleSelect({ kind: 'block', id: b.id });
		expect(selectionKind()).toBe('block');
		expect(describeSelection()).toBe('2 blocks');
		toggleSelect({ kind: 'plane', id: p.id });
		expect(selectionKind()).toBe('mixed');
		expect(describeSelection()).toBe('3 items');
	});

	it('selects every block and plane but no links', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		addPlane(0, 0, 3, 3);
		addLink(a.id, b.id);
		selectAll();
		expect(ui.selection.map((s) => s.kind).sort()).toEqual(['block', 'block', 'plane']);
	});

	it('moves selected blocks and planes together', () => {
		const a = addBlock(0, 0);
		const p = addPlane(2, 2, 3, 3);
		const c = addBlock(8, 8);
		select({ kind: 'block', id: a.id });
		toggleSelect({ kind: 'plane', id: p.id });
		moveSelection(1, -2);
		expect([doc.blocks[0].x, doc.blocks[0].y]).toEqual([1, -2]);
		expect([doc.planes[0].x, doc.planes[0].y]).toEqual([3, 0]);
		expect(doc.blocks.find((x) => x.id === c.id)?.x).toBe(8);
	});

	it('deletes the selection and links attached to deleted blocks', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		const c = addBlock(8, 0);
		addLink(a.id, b.id);
		const kept = addLink(b.id, c.id)!;
		select({ kind: 'block', id: a.id });
		deleteSelection();
		expect(doc.blocks.map((x) => x.id)).toEqual([b.id, c.id]);
		expect(doc.links.map((x) => x.id)).toEqual([kept.id]);
		expect(ui.selection).toEqual([]);
	});

	it('pastes copied blocks with the links between them rewired to the copies', () => {
		const a = addBlock(0, 0);
		const b = addBlock(4, 0);
		const c = addBlock(8, 0);
		addLink(a.id, b.id);
		addLink(b.id, c.id);
		select({ kind: 'block', id: a.id });
		toggleSelect({ kind: 'block', id: b.id });
		expect(copySelection()).toBe(true);
		const pasted = pasteClipboard()!;
		expect(pasted).toHaveLength(2);
		const ids = pasted.map((s) => s.id);
		expect(doc.blocks).toHaveLength(5);
		// Only the a–b link has both ends copied.
		expect(doc.links).toHaveLength(3);
		const copy = doc.links[2];
		expect([copy.a, copy.b]).toEqual(ids);
		const moved = doc.blocks.find((x) => x.id === ids[0])!;
		expect([moved.x, moved.y]).toEqual([1, 1]);
	});
});
