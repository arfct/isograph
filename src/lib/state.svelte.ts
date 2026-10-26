import {
	ANGLE_STEP,
	type Block,
	clamp,
	DEFAULT_LABEL_SIZE,
	type Doc,
	defaultCamera,
	type Link,
	MAX_EL,
	MAX_ZOOM,
	MIN_EL,
	MIN_ZOOM,
	normAngle,
	type Plane,
	type SelectionRef,
	type Tool
} from './model';

export const doc: Doc = $state({ blocks: [], planes: [], links: [], camera: defaultCamera() });

export const ui = $state({
	tool: 'select' as Tool,
	selection: null as SelectionRef | null,
	linkFrom: null as number | null,
	help: false
});

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

export function addBlock(x: number, y: number): Block {
	const last = doc.blocks[doc.blocks.length - 1];
	const b: Block = {
		id: nextId(),
		x,
		y,
		size: last?.size ?? 2,
		height: last?.height ?? 1,
		color: last?.color ?? 1,
		shade: last?.shade ?? 'shaded',
		label: '',
		edge: last?.edge ?? 'S',
		labelSize: last?.labelSize ?? DEFAULT_LABEL_SIZE
	};
	doc.blocks.push(b);
	dropQueue.add(b.id);
	ui.selection = { kind: 'block', id: b.id };
	return b;
}

export function addPlane(x: number, y: number, w: number, h: number): Plane {
	const last = doc.planes[doc.planes.length - 1];
	const p: Plane = { id: nextId(), x, y, w, h, color: last?.color ?? 2 };
	doc.planes.push(p);
	ui.selection = { kind: 'plane', id: p.id };
	return p;
}

export function addLink(a: number, b: number): Link | null {
	if (a === b) return null;
	if (doc.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return null;
	const l: Link = { id: nextId(), a, b };
	doc.links.push(l);
	ui.selection = { kind: 'link', id: l.id };
	return l;
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
