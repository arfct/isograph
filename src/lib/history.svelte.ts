import { doc, ui } from './state.svelte';
import type { Block, Link, Plane } from './model';

type Snapshot = { blocks: Block[]; planes: Plane[]; links: Link[] };

const DEBOUNCE_MS = 300;
const MAX_STEPS = 200;

let past: string[] = [];
let future: string[] = [];
let current: string | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

function serialize(): string {
	return JSON.stringify({
		blocks: $state.snapshot(doc.blocks),
		planes: $state.snapshot(doc.planes),
		links: $state.snapshot(doc.links)
	});
}

/** Record the current doc as a history step if it differs from the last one recorded. */
function record() {
	if (pending) {
		clearTimeout(pending);
		pending = null;
	}
	const s = serialize();
	if (s === current) return;
	if (current != null) {
		past.push(current);
		if (past.length > MAX_STEPS) past.shift();
	}
	current = s;
	future = [];
}

function apply(s: string) {
	const d = JSON.parse(s) as Snapshot;
	doc.blocks = d.blocks;
	doc.planes = d.planes;
	doc.links = d.links;
	current = s;
	const sel = ui.selection;
	if (sel) {
		const list = sel.kind === 'block' ? d.blocks : sel.kind === 'plane' ? d.planes : d.links;
		if (!list.some((x) => x.id === sel.id)) ui.selection = null;
	}
	ui.linkFrom = null;
}

/** Forget all history and treat the current doc as the starting point. */
export function resetHistory() {
	if (pending) {
		clearTimeout(pending);
		pending = null;
	}
	past = [];
	future = [];
	current = serialize();
}

export function canUndo(): boolean {
	return past.length > 0 || (pending != null && serialize() !== current);
}

export function canRedo(): boolean {
	return future.length > 0;
}

export function undo(): boolean {
	record();
	const s = past.pop();
	if (s == null) return false;
	future.push(current!);
	apply(s);
	return true;
}

export function redo(): boolean {
	record();
	const s = future.pop();
	if (s == null) return false;
	past.push(current!);
	apply(s);
	return true;
}

/**
 * Watch the doc and record history steps. Call once during component init. Edits made in quick
 * succession, such as a drag, collapse into one step.
 */
export function trackHistory() {
	$effect(() => {
		serialize();
		if (current == null) {
			current = serialize();
			return;
		}
		if (pending) clearTimeout(pending);
		pending = setTimeout(record, DEBOUNCE_MS);
	});
}
