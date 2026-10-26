import {
	ANCHORS,
	BENDS,
	DASHES,
	DEFAULT_LABEL_SIZE,
	DENSITIES,
	DIRECTIONS,
	EDGES,
	HATCHES,
	LINK_STYLES,
	MAX_LABEL_SIZE,
	MIN_LABEL_SIZE,
	PALETTE,
	SHADES,
	SHAPES,
	clamp,
	defaultCamera,
	type Block,
	type Doc,
	type Link,
	type Plane
} from './model';

const VERSION = 2;

function toBase64Url(s: string): string {
	const bytes = new TextEncoder().encode(s);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Returns '' when the document is empty and the camera is at its default. */
export function encodeDoc(doc: Doc): string {
	const c = doc.camera;
	const d = defaultCamera();
	const cameraDefault =
		c.az === d.az && c.el === d.el && r2(c.zoom) === d.zoom && r1(c.tx) === 0 && r1(c.ty) === 0;
	if (!doc.blocks.length && !doc.planes.length && !doc.links.length && cameraDefault) return '';
	const payload = {
		v: VERSION,
		c: [c.az, c.el, r2(c.zoom), r1(c.tx), r1(c.ty)],
		b: doc.blocks.map((b) => [
			b.id,
			b.x,
			b.y,
			b.size,
			b.height,
			b.color,
			SHADES.indexOf(b.shade),
			EDGES.indexOf(b.edge),
			b.label,
			r1(b.labelSize),
			SHAPES.indexOf(b.shape),
			HATCHES.indexOf(b.hatch),
			DENSITIES.indexOf(b.density)
		]),
		p: doc.planes.map((p) => [
			p.id,
			p.x,
			p.y,
			p.w,
			p.h,
			p.color,
			EDGES.indexOf(p.edge),
			p.label,
			r1(p.labelSize)
		]),
		l: doc.links.map((l) => [
			l.id,
			l.a,
			l.b,
			LINK_STYLES.indexOf(l.style),
			DASHES.indexOf(l.dash),
			ANCHORS.indexOf(l.from),
			ANCHORS.indexOf(l.to),
			l.label,
			r1(l.labelSize),
			DIRECTIONS.indexOf(l.direction),
			l.animated ? 1 : 0,
			BENDS.indexOf(l.bend)
		])
	};
	return toBase64Url(JSON.stringify(payload));
}

const int = (v: unknown, fallback = 0) =>
	typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
const num = (v: unknown, fallback = 0) =>
	typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const labelSize = (v: unknown) => clamp(num(v, DEFAULT_LABEL_SIZE), MIN_LABEL_SIZE, MAX_LABEL_SIZE);
function pick<T>(list: T[], v: unknown, fallback: T): T {
	return list[int(v, -1)] ?? fallback;
}

export function decodeDoc(hash: string): Doc | null {
	try {
		const raw = JSON.parse(fromBase64Url(hash));
		if (!raw || typeof raw !== 'object') return null;
		const cam = defaultCamera();
		if (Array.isArray(raw.c)) {
			cam.az = int(raw.c[0], cam.az);
			cam.el = int(raw.c[1], cam.el);
			cam.zoom = clamp(num(raw.c[2], 1), 0.1, 20);
			cam.tx = num(raw.c[3]);
			cam.ty = num(raw.c[4]);
		}
		const blocks: Block[] = (Array.isArray(raw.b) ? raw.b : [])
			.filter(Array.isArray)
			.map((a: unknown[]) => ({
				id: int(a[0]),
				x: int(a[1]),
				y: int(a[2]),
				size: Math.max(1, int(a[3], 1)),
				height: Math.max(1, int(a[4], 1)),
				color: clamp(int(a[5]), 0, PALETTE.length - 1),
				shade: pick(SHADES, a[6], 'flat'),
				edge: pick(EDGES, a[7], 'S'),
				label: str(a[8]),
				labelSize: labelSize(a[9]),
				shape: pick(SHAPES, a[10], 'box'),
				hatch: pick(HATCHES, a[11], 'diagonal'),
				density: pick(DENSITIES, a[12], 'medium')
			}));
		const planes: Plane[] = (Array.isArray(raw.p) ? raw.p : [])
			.filter(Array.isArray)
			.map((a: unknown[]) => ({
				id: int(a[0]),
				x: int(a[1]),
				y: int(a[2]),
				w: Math.max(1, int(a[3], 1)),
				h: Math.max(1, int(a[4], 1)),
				color: clamp(int(a[5]), 0, PALETTE.length - 1),
				edge: pick(EDGES, a[6], 'S'),
				label: str(a[7]),
				labelSize: labelSize(a[8])
			}));
		const ids = new Set(blocks.map((b) => b.id));
		const links: Link[] = (Array.isArray(raw.l) ? raw.l : [])
			.filter(Array.isArray)
			.map((a: unknown[]) => ({
				id: int(a[0]),
				a: int(a[1]),
				b: int(a[2]),
				style: pick(LINK_STYLES, a[3], 'elbow'),
				dash: pick(DASHES, a[4], 'solid'),
				from: pick(ANCHORS, a[5], 'C'),
				to: pick(ANCHORS, a[6], 'C'),
				label: str(a[7]),
				labelSize: labelSize(a[8]),
				direction: pick(DIRECTIONS, a[9], 'none'),
				animated: a[10] === 1,
				bend: pick(BENDS, a[11], 'x')
			}))
			.filter((l: Link) => ids.has(l.a) && ids.has(l.b) && l.a !== l.b);
		return { blocks, planes, links, camera: cam };
	} catch {
		return null;
	}
}
