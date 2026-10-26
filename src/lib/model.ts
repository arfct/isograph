export type Shade = 'flat' | 'shaded' | 'dither' | 'hatch';
export type Edge = 'S' | 'E' | 'N' | 'W';
export type Tool = 'select' | 'block' | 'plane' | 'link';

export interface Block {
	id: number;
	x: number;
	y: number;
	size: number;
	height: number;
	color: number;
	shade: Shade;
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
}

export interface Link {
	id: number;
	a: number;
	b: number;
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
export const EDGES: Edge[] = ['S', 'E', 'N', 'W'];
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
export const GRID_EXTENT = 40;

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
