export type Shade = 'flat' | 'shaded' | 'dither' | 'hatch';
export type Shape = 'box' | 'cylinder' | 'sphere' | 'pyramid';
export type Hatch = 'diagonal' | 'backslash' | 'cross' | 'horizontal' | 'vertical' | 'grid';
export type Density = 'fine' | 'medium' | 'coarse';
export type Edge = 'S' | 'E' | 'N' | 'W';
export type Tool = 'select' | 'shape' | 'plane' | 'link';

/** Where a link attaches to a block: the centre, an edge midpoint, or a corner. */
export type Anchor = 'C' | 'N' | 'E' | 'S' | 'W' | 'NE' | 'SE' | 'SW' | 'NW';
export type LinkStyle = 'elbow' | 'straight' | 'curve';
export type Dash = 'solid' | 'dashed' | 'dotted';
export type Direction = 'none' | 'forward' | 'both';
/** Which axis an elbow link travels along first. */
export type Bend = 'x' | 'y';

export interface Block {
	id: number;
	x: number;
	y: number;
	size: number;
	height: number;
	color: number;
	shade: Shade;
	shape: Shape;
	hatch: Hatch;
	density: Density;
	label: string;
	edge: Edge;
	labelSize: number; // grid units
}

export interface Plane {
	id: number;
	x: number;
	y: number;
	w: number;
	h: number;
	color: number;
	label: string;
	edge: Edge;
	labelSize: number;
}

export interface Link {
	id: number;
	a: number;
	b: number;
	style: LinkStyle;
	bend: Bend;
	dash: Dash;
	from: Anchor;
	to: Anchor;
	label: string;
	labelSize: number;
	direction: Direction;
	animated: boolean;
}

export interface CameraState {
	az: number; // degrees, 15° increments
	el: number; // degrees, 15° increments, 15..75
	zoom: number;
	tx: number;
	ty: number;
}

export interface Doc {
	blocks: Block[];
	planes: Plane[];
	links: Link[];
	camera: CameraState;
}

export interface SelectionRef {
	kind: 'block' | 'plane' | 'link';
	id: number;
}

export const SHADES: Shade[] = ['flat', 'shaded', 'dither', 'hatch'];
export const SHAPES: Shape[] = ['box', 'cylinder', 'sphere', 'pyramid'];
/** Keyboard shortcut that picks each shape and switches to the shape tool. */
export const SHAPE_KEYS: Record<Shape, string> = {
	box: 'B',
	cylinder: 'C',
	sphere: 'S',
	pyramid: 'Y'
};
export const HATCHES: Hatch[] = [
	'diagonal',
	'backslash',
	'cross',
	'horizontal',
	'vertical',
	'grid'
];
export const DENSITIES: Density[] = ['fine', 'medium', 'coarse'];
export const EDGES: Edge[] = ['S', 'E', 'N', 'W'];
export const ANCHORS: Anchor[] = ['C', 'N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
export const LINK_STYLES: LinkStyle[] = ['elbow', 'straight', 'curve'];
export const BENDS: Bend[] = ['x', 'y'];
export const DASHES: Dash[] = ['solid', 'dashed', 'dotted'];
export const DIRECTIONS: Direction[] = ['none', 'forward', 'both'];
export const ANGLE_STEP = 15;
export const MIN_EL = 15;
export const MAX_EL = 75;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;
export const MAX_SIZE = 12;
export const MAX_HEIGHT = 24;
export const DEFAULT_LABEL_SIZE = 0.7;
export const MIN_LABEL_SIZE = 0.3;
export const MAX_LABEL_SIZE = 2;
export const LABEL_SIZE_STEP = 0.1;
/** Half-width of the grid, in cells. The grid follows the camera, so this only needs to cover one view. */
export const GRID_EXTENT = 260;

export const PALETTE: { name: string; hex: string }[] = [
	{ name: 'white', hex: '#ffffff' },
	{ name: 'fog', hex: '#ecebe4' },
	{ name: 'ash', hex: '#d6d4c9' },
	{ name: 'stone', hex: '#b8b5a8' },
	{ name: 'slate', hex: '#8f8c80' },
	{ name: 'char', hex: '#5c5a52' },
	{ name: 'ink', hex: '#2a2925' },
	{ name: 'rose', hex: '#efcac6' },
	{ name: 'peach', hex: '#f3d9bb' },
	{ name: 'butter', hex: '#f1e7ae' },
	{ name: 'sage', hex: '#cfdcc5' },
	{ name: 'sky', hex: '#c7d9e7' },
	{ name: 'lilac', hex: '#dacfe5' }
];

export function defaultCamera(): CameraState {
	return { az: 45, el: 30, zoom: 1, tx: 0, ty: 0 };
}

export function emptyDoc(): Doc {
	return { blocks: [], planes: [], links: [], camera: defaultCamera() };
}

export function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

export function normAngle(a: number): number {
	return ((a % 360) + 360) % 360;
}

/** Vertical extent of a block. Spheres are always as tall as they are wide. */
export function blockHeight(b: Pick<Block, 'shape' | 'size' | 'height'>): number {
	return b.shape === 'sphere' ? b.size : b.height;
}

/**
 * Floor point where a link attaches to a block. Centre and edge anchors are rounded to the nearest
 * grid line so elbow links stay on the grid; corners already are.
 */
export function anchorPoint(b: Pick<Block, 'x' | 'y' | 'size'>, a: Anchor): [number, number] {
	const s = b.size;
	const fx = a.includes('E') ? 1 : a.includes('W') ? 0 : 0.5;
	const fy = a.includes('N') ? 1 : a.includes('S') ? 0 : 0.5;
	return [Math.round(b.x + fx * s), Math.round(b.y + fy * s)];
}
