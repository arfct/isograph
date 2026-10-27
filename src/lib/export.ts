import {
	PALETTE,
	blockHeight,
	type Anchor,
	type Bend,
	type CameraState,
	type Dash,
	type Density,
	type Direction,
	type Doc,
	type Edge,
	type Hatch,
	type LinkStyle,
	type Shade,
	type Shape
} from './model';

/**
 * The scene as a standalone JSON file, for use outside Isograph. Unlike the URL hash this is meant
 * to be read by other programs: fields are named, enums are strings and colours are palette names.
 * The format is documented in the README; bump EXPORT_VERSION on any change that would break a
 * reader of the old shape (adding a field does not).
 */
export const EXPORT_VERSION = 1;

export interface ExportLabel {
	text: string;
	edge: Edge;
	size: number;
}

export interface SceneExport {
	format: 'isograph';
	version: number;
	camera: CameraState;
	palette: Record<string, string>;
	blocks: {
		id: number;
		shape: Shape;
		x: number;
		y: number;
		size: number;
		height: number;
		color: string;
		shade: Shade;
		hatch: Hatch;
		density: Density;
		label: ExportLabel | null;
	}[];
	planes: {
		id: number;
		x: number;
		y: number;
		w: number;
		h: number;
		color: string;
		label: ExportLabel | null;
	}[];
	links: {
		id: number;
		from: { block: number; anchor: Anchor };
		to: { block: number; anchor: Anchor };
		style: LinkStyle;
		bend: Bend;
		dash: Dash;
		direction: Direction;
		animated: boolean;
		label: Omit<ExportLabel, 'edge'> | null;
	}[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const color = (i: number) => PALETTE[i]?.name ?? PALETTE[0].name;
const label = (text: string, edge: Edge, size: number): ExportLabel | null =>
	text ? { text, edge, size: r2(size) } : null;

export function exportDoc(doc: Doc): SceneExport {
	return {
		format: 'isograph',
		version: EXPORT_VERSION,
		camera: { ...doc.camera },
		palette: Object.fromEntries(PALETTE.map((p) => [p.name, p.hex])),
		blocks: doc.blocks.map((b) => ({
			id: b.id,
			shape: b.shape,
			x: b.x,
			y: b.y,
			size: b.size,
			height: blockHeight(b),
			color: color(b.color),
			shade: b.shade,
			hatch: b.hatch,
			density: b.density,
			label: label(b.label, b.edge, b.labelSize)
		})),
		planes: doc.planes.map((p) => ({
			id: p.id,
			x: p.x,
			y: p.y,
			w: p.w,
			h: p.h,
			color: color(p.color),
			label: label(p.label, p.edge, p.labelSize)
		})),
		links: doc.links.map((l) => ({
			id: l.id,
			from: { block: l.a, anchor: l.from },
			to: { block: l.b, anchor: l.to },
			style: l.style,
			bend: l.bend,
			dash: l.dash,
			direction: l.direction,
			animated: l.animated,
			label: l.label ? { text: l.label, size: r2(l.labelSize) } : null
		}))
	};
}

/** Saves the scene as `isograph.json` through the browser's download flow. */
export function downloadDoc(doc: Doc) {
	const json = JSON.stringify(exportDoc(doc), null, '\t') + '\n';
	const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = 'isograph.json';
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
