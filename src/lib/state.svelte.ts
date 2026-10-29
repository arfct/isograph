import {
	ANGLE_STEP,
	DEFAULT_LABEL_SIZE,
	MAX_EL,
	MAX_ZOOM,
	MIN_EL,
	MIN_ZOOM,
	clamp,
	defaultCamera,
	normAngle,
	type Block,
	type Doc,
	type Link,
	type Plane,
	type SelectionRef,
	type Shape,
	type Tool
} from './model';

export const doc: Doc = $state({ blocks: [], planes: [], links: [], camera: defaultCamera() });

export const ui = $state({
	tool: 'select' as Tool,
	selection: [] as SelectionRef[],
	linkFrom: null as number | null,
	/** Shape the shape tool drops next. */
	shape: 'box' as Shape,
	help: false,
	/** Transient message shown at the bottom of the screen after a keyboard action. */
	toast: null as { id: number; text: string } | null
});

const TOAST_MS = 3000;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

/** Show a short message for a few seconds. A new toast replaces the old one and restarts the timer. */
export function toast(text: string) {
	ui.toast = { id: ++toastId, text };
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		ui.toast = null;
		toastTimer = null;
	}, TOAST_MS);
}

/** Copied blocks and planes, plus the links between them, ready to paste. Intentionally non-reactive. */
let clipboard: { blocks: Block[]; planes: Plane[]; links: Link[] } | null = null;

export function setShape(shape: Shape) {
	ui.shape = shape;
}

/** Pick a shape and switch to the shape tool so it drops on the next click. */
export function pickShape(shape: Shape) {
	ui.shape = shape;
	setTool('shape');
}

export function toggleHelp(open?: boolean) {
	ui.help = open ?? !ui.help;
}

/** Block ids that should play the drop-in animation when they first appear. Intentionally non-reactive. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
export const dropQueue = new Set<number>();

function nextId(): number {
	let m = 0;
	for (const b of doc.blocks) m = Math.max(m, b.id);
	for (const p of doc.planes) m = Math.max(m, p.id);
	for (const l of doc.links) m = Math.max(m, l.id);
	return m + 1;
}

export function loadDoc(d: Doc) {
	doc.blocks = d.blocks;
	doc.planes = d.planes;
	doc.links = d.links;
	doc.camera = d.camera;
	ui.selection = [];
	ui.linkFrom = null;
}

export function clearDoc() {
	doc.blocks = [];
	doc.planes = [];
	doc.links = [];
	ui.selection = [];
	ui.linkFrom = null;
}

export function setTool(tool: Tool) {
	ui.tool = tool;
	ui.linkFrom = null;
}

/** Replace the selection with a single item, or clear it. */
export function select(ref: SelectionRef | null) {
	ui.selection = ref ? [ref] : [];
}

/** Replace the selection with several items. */
export function selectMany(refs: SelectionRef[]) {
	ui.selection = refs;
}

/** Select every block and plane. Links are left out so the selection stays editable as one kind. */
export function selectAll() {
	ui.selection = [
		...doc.blocks.map((b) => ({ kind: 'block' as const, id: b.id })),
		...doc.planes.map((p) => ({ kind: 'plane' as const, id: p.id }))
	];
}

export function isSelected(ref: SelectionRef): boolean {
	return ui.selection.some((s) => s.kind === ref.kind && s.id === ref.id);
}

/** Add an item to the selection, or remove it if it is already selected. */
export function toggleSelect(ref: SelectionRef) {
	ui.selection = isSelected(ref)
		? ui.selection.filter((s) => s.kind !== ref.kind || s.id !== ref.id)
		: [...ui.selection, { kind: ref.kind, id: ref.id }];
}

function selectedIds(kind: SelectionRef['kind']): number[] {
	return ui.selection.filter((s) => s.kind === kind).map((s) => s.id);
}

/** The kind shared by everything selected, 'mixed' if kinds differ, or null when nothing is. */
export function selectionKind(): SelectionRef['kind'] | 'mixed' | null {
	const first = ui.selection[0];
	if (!first) return null;
	return ui.selection.every((s) => s.kind === first.kind) ? first.kind : 'mixed';
}

/** A short description of the selection for toasts, such as "block", "3 planes" or "4 items". */
export function describeSelection(refs: SelectionRef[] = ui.selection): string {
	if (!refs.length) return 'nothing';
	const kind = refs.every((s) => s.kind === refs[0].kind) ? refs[0].kind : 'item';
	return refs.length === 1 ? kind : `${refs.length} ${kind}s`;
}

/** The block the shape tool would drop at a cell, without adding it. */
export function nextBlock(x: number, y: number): Block {
	const last = doc.blocks[doc.blocks.length - 1];
	return {
		id: nextId(),
		x,
		y,
		size: last?.size ?? 2,
		height: last?.height ?? 1,
		color: last?.color ?? 1,
		shade: last?.shade ?? 'shaded',
		shape: ui.shape,
		hatch: last?.hatch ?? 'diagonal',
		density: last?.density ?? 'medium',
		label: '',
		edge: last?.edge ?? 'S',
		labelSize: last?.labelSize ?? DEFAULT_LABEL_SIZE
	};
}

export function addBlock(x: number, y: number): Block {
	const b = nextBlock(x, y);
	doc.blocks.push(b);
	dropQueue.add(b.id);
	ui.selection = [{ kind: 'block', id: b.id }];
	return b;
}

export function addPlane(x: number, y: number, w: number, h: number): Plane {
	const last = doc.planes[doc.planes.length - 1];
	const p: Plane = {
		id: nextId(),
		x,
		y,
		w,
		h,
		color: last?.color ?? 2,
		label: '',
		edge: last?.edge ?? 'S',
		labelSize: last?.labelSize ?? DEFAULT_LABEL_SIZE
	};
	doc.planes.push(p);
	ui.selection = [{ kind: 'plane', id: p.id }];
	return p;
}

export function addLink(a: number, b: number): Link | null {
	if (a === b) return null;
	if (doc.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return null;
	const last = doc.links[doc.links.length - 1];
	const l: Link = {
		id: nextId(),
		a,
		b,
		style: last?.style ?? 'elbow',
		bend: last?.bend ?? 'x',
		dash: last?.dash ?? 'solid',
		from: 'C',
		to: 'C',
		label: '',
		labelSize: last?.labelSize ?? DEFAULT_LABEL_SIZE,
		direction: last?.direction ?? 'none',
		animated: last?.animated ?? false
	};
	doc.links.push(l);
	ui.selection = [{ kind: 'link', id: l.id }];
	return l;
}

/** Reverse a link so it runs from its second block to its first. */
export function swapLink(l: Link) {
	[l.a, l.b] = [l.b, l.a];
	[l.from, l.to] = [l.to, l.from];
}

/**
 * Copy the selected blocks and planes, along with any links whose both ends are among the copied
 * blocks. A link on its own needs two blocks, so it is not copyable.
 */
export function copySelection(): boolean {
	const blocks = selectedBlocks();
	const planes = selectedPlanes();
	if (!blocks.length && !planes.length) return false;
	const ids = blocks.map((b) => b.id);
	clipboard = {
		blocks: blocks.map((b) => ({ ...b })),
		planes: planes.map((p) => ({ ...p })),
		links: doc.links.filter((l) => ids.includes(l.a) && ids.includes(l.b)).map((l) => ({ ...l }))
	};
	return true;
}

/** Paste the copied items one cell over from the last copy or paste, and select them. */
export function pasteClipboard(): SelectionRef[] | null {
	if (!clipboard) return null;
	let id = nextId();
	const remap: Record<number, number> = {};
	const blocks = clipboard.blocks.map((b) => {
		const n = { ...b, id: id++, x: b.x + 1, y: b.y + 1 };
		remap[b.id] = n.id;
		return n;
	});
	const planes = clipboard.planes.map((p) => ({ ...p, id: id++, x: p.x + 1, y: p.y + 1 }));
	const links = clipboard.links.map((l) => ({ ...l, id: id++, a: remap[l.a], b: remap[l.b] }));
	// Repeated pastes cascade instead of stacking.
	clipboard = {
		blocks: blocks.map((b) => ({ ...b })),
		planes: planes.map((p) => ({ ...p })),
		links: links.map((l) => ({ ...l }))
	};
	for (const b of blocks) dropQueue.add(b.id);
	doc.blocks.push(...blocks);
	doc.planes.push(...planes);
	doc.links.push(...links);
	ui.selection = [
		...blocks.map((b) => ({ kind: 'block' as const, id: b.id })),
		...planes.map((p) => ({ kind: 'plane' as const, id: p.id }))
	];
	return ui.selection;
}

/** Copy and paste in one step. */
export function duplicateSelection(): SelectionRef[] | null {
	return copySelection() ? pasteClipboard() : null;
}

/** Delete everything selected. Deleting a block also deletes the links attached to it. */
export function deleteSelection() {
	const blocks = selectedIds('block');
	const planes = selectedIds('plane');
	const links = selectedIds('link');
	doc.blocks = doc.blocks.filter((b) => !blocks.includes(b.id));
	doc.planes = doc.planes.filter((p) => !planes.includes(p.id));
	doc.links = doc.links.filter(
		(l) => !links.includes(l.id) && !blocks.includes(l.a) && !blocks.includes(l.b)
	);
	ui.selection = [];
}

/** Move every selected block and plane by whole cells. Links follow their blocks. */
export function moveSelection(dx: number, dy: number) {
	for (const t of [...selectedBlocks(), ...selectedPlanes()]) {
		t.x += dx;
		t.y += dy;
	}
}

export function selectedBlocks(): Block[] {
	const ids = selectedIds('block');
	return doc.blocks.filter((b) => ids.includes(b.id));
}

export function selectedPlanes(): Plane[] {
	const ids = selectedIds('plane');
	return doc.planes.filter((p) => ids.includes(p.id));
}

export function selectedLinks(): Link[] {
	const ids = selectedIds('link');
	return doc.links.filter((l) => ids.includes(l.id));
}

/** The selected block, when it is the only thing selected. */
export function selectedBlock(): Block | undefined {
	const s = ui.selection;
	return s.length === 1 && s[0].kind === 'block' ? blockById(s[0].id) : undefined;
}

/** The selected plane, when it is the only thing selected. */
export function selectedPlane(): Plane | undefined {
	const s = ui.selection;
	return s.length === 1 && s[0].kind === 'plane'
		? doc.planes.find((p) => p.id === s[0].id)
		: undefined;
}

export function blockById(id: number): Block | undefined {
	return doc.blocks.find((b) => b.id === id);
}

export function rotateBy(steps: number) {
	doc.camera.az = normAngle(doc.camera.az + steps * ANGLE_STEP);
}

export function elevateBy(steps: number) {
	doc.camera.el = clamp(doc.camera.el + steps * ANGLE_STEP, MIN_EL, MAX_EL);
}

export function zoomBy(factor: number) {
	doc.camera.zoom = clamp(doc.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
}

export function resetCamera() {
	doc.camera = defaultCamera();
}
