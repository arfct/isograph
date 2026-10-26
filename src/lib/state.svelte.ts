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
	selection: null as SelectionRef | null,
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

/** Copied block or plane, ready to paste. Intentionally non-reactive. */
let clipboard: { kind: 'block'; item: Block } | { kind: 'plane'; item: Plane } | null = null;

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
	ui.selection = null;
	ui.linkFrom = null;
}

export function clearDoc() {
	doc.blocks = [];
	doc.planes = [];
	doc.links = [];
	ui.selection = null;
	ui.linkFrom = null;
}

export function setTool(tool: Tool) {
	ui.tool = tool;
	ui.linkFrom = null;
}

export function select(ref: SelectionRef | null) {
	ui.selection = ref;
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
	ui.selection = { kind: 'block', id: b.id };
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
	ui.selection = { kind: 'plane', id: p.id };
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
	ui.selection = { kind: 'link', id: l.id };
	return l;
}

/** Reverse a link so it runs from its second block to its first. */
export function swapLink(l: Link) {
	[l.a, l.b] = [l.b, l.a];
	[l.from, l.to] = [l.to, l.from];
}

/** Copy the selected block or plane. Links need two blocks, so they are not copyable. */
export function copySelection(): boolean {
	const b = selectedBlock();
	if (b) {
		clipboard = { kind: 'block', item: { ...b } };
		return true;
	}
	const p = selectedPlane();
	if (p) {
		clipboard = { kind: 'plane', item: { ...p } };
		return true;
	}
	return false;
}

/** Paste the copied item one cell over from the last copy or paste, and select it. */
export function pasteClipboard(): Block | Plane | null {
	if (!clipboard) return null;
	const item = {
		...clipboard.item,
		id: nextId(),
		x: clipboard.item.x + 1,
		y: clipboard.item.y + 1
	};
	if (clipboard.kind === 'block') {
		doc.blocks.push(item as Block);
		dropQueue.add(item.id);
	} else doc.planes.push(item as Plane);
	// Repeated pastes cascade instead of stacking.
	clipboard = { ...clipboard, item } as typeof clipboard;
	ui.selection = { kind: clipboard.kind, id: item.id };
	return item;
}

/** Copy and paste in one step. */
export function duplicateSelection(): Block | Plane | null {
	return copySelection() ? pasteClipboard() : null;
}

export function deleteSelection() {
	const s = ui.selection;
	if (!s) return;
	if (s.kind === 'block') {
		doc.blocks = doc.blocks.filter((b) => b.id !== s.id);
		doc.links = doc.links.filter((l) => l.a !== s.id && l.b !== s.id);
	} else if (s.kind === 'plane') {
		doc.planes = doc.planes.filter((p) => p.id !== s.id);
	} else {
		doc.links = doc.links.filter((l) => l.id !== s.id);
	}
	ui.selection = null;
}

export function selectedBlock(): Block | undefined {
	const s = ui.selection;
	return s?.kind === 'block' ? doc.blocks.find((b) => b.id === s.id) : undefined;
}

export function selectedPlane(): Plane | undefined {
	const s = ui.selection;
	return s?.kind === 'plane' ? doc.planes.find((p) => p.id === s.id) : undefined;
}

export function selectedLink(): Link | undefined {
	const s = ui.selection;
	return s?.kind === 'link' ? doc.links.find((l) => l.id === s.id) : undefined;
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
