import * as THREE from 'three';
import { type Block, PALETTE } from '$lib/model';

export const INK = 0x151515;

/** Per-face multipliers in BoxGeometry group order: +x, -x, +y, -y, +z, -z. */
const FACE_TONE = [0.84, 0.66, 0.74, 0.94, 1.0, 0.6];
/** Dark pixels out of 16 in the Bayer tile, per face. */
const DITHER_LEVEL = [5, 10, 8, 3, 1, 12];
/** Hatch lines per tile, per face. */
const HATCH_LINES = [2, 3, 3, 1, 0, 3];
const BAYER4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5]
];

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A fresh canvas always yields a 2D context; null only means it already holds a WebGL one. */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas context unavailable');
	return ctx;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
	return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `hex` toward `to` by t (0..1), in sRGB space. */
export function mix(hex: string, to: string, t: number): string {
	const a = hexToRgb(hex);
	const b = hexToRgb(to);
	return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A contrasting ink for patterns on `base`: darker on light colors, lighter on dark ones. */
function patternInk(base: string): string {
	return luminance(base) > 0.45 ? mix(base, '#151515', 0.55) : mix(base, '#ffffff', 0.45);
}

const textureCache = new Map<string, THREE.Texture>();

function canvasTexture(
	key: string,
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void
) {
	const cached = textureCache.get(key);
	if (cached) return cached;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = context2d(canvas);
	draw(ctx);
	const tex = new THREE.CanvasTexture(canvas);
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.colorSpace = THREE.SRGBColorSpace;
	textureCache.set(key, tex);
	return tex;
}

function ditherTexture(base: string, ink: string, level: number) {
	return canvasTexture(`d:${base}:${ink}:${level}`, 4, 4, (ctx) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, 4, 4);
		ctx.fillStyle = ink;
		for (let y = 0; y < 4; y++)
			for (let x = 0; x < 4; x++) if (BAYER4[y][x] < level) ctx.fillRect(x, y, 1, 1);
	});
}

function hatchTexture(base: string, ink: string, lines: number) {
	const S = 12;
	return canvasTexture(`h:${base}:${ink}:${lines}`, S, S, (ctx) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, S, S);
		ctx.fillStyle = ink;
		// Anti-diagonal 1px lines that tile seamlessly.
		for (let i = 0; i < lines; i++) {
			const offset = Math.round((i * S) / lines);
			for (let x = 0; x < S; x++) {
				const y = (S - 1 - x + offset) % S;
				ctx.fillRect(x, y, 1, 1);
			}
		}
	});
}

function repeated(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
	const t = tex.clone();
	t.repeat.set(rx, ry);
	t.needsUpdate = true;
	return t;
}

const solidOpts = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };

/** Six materials in BoxGeometry group order for a block with the given shade/color. */
export function faceMaterials(b: Block): THREE.Material[] {
	const base = PALETTE[b.color]?.hex ?? '#ffffff';
	const s = b.size;
	const h = b.height;
	// Face (u, v) extents in world units, in group order.
	const dims: [number, number][] = [
		[h, s],
		[h, s],
		[s, h],
		[s, h],
		[s, s],
		[s, s]
	];
	switch (b.shade) {
		case 'flat': {
			const m = new THREE.MeshBasicMaterial({ color: base, ...solidOpts });
			return [m, m, m, m, m, m];
		}
		case 'shaded':
			return FACE_TONE.map(
				(t) => new THREE.MeshBasicMaterial({ color: mix(base, '#000000', 1 - t), ...solidOpts })
			);
		case 'dither': {
			const ink = patternInk(base);
			const k = 4; // tiles per world unit
			return DITHER_LEVEL.map((level, i) => {
				const map = repeated(ditherTexture(base, ink, level), dims[i][0] * k, dims[i][1] * k);
				return new THREE.MeshBasicMaterial({ map, ...solidOpts });
			});
		}
		case 'hatch': {
			const ink = patternInk(base);
			const k = 2;
			return HATCH_LINES.map((lines, i) => {
				if (lines === 0) return new THREE.MeshBasicMaterial({ color: base, ...solidOpts });
				const map = repeated(hatchTexture(base, ink, lines), dims[i][0] * k, dims[i][1] * k);
				return new THREE.MeshBasicMaterial({ map, ...solidOpts });
			});
		}
	}
}

export const LABEL_FONT = '400 46px "Geist Mono", ui-monospace, monospace';

export function labelTexture(
	text: string,
	anisotropy: number
): { tex: THREE.Texture; aspect: number } {
	const H = 64;
	const measure = context2d(document.createElement('canvas'));
	measure.font = LABEL_FONT;
	const w = Math.ceil(measure.measureText(text).width) + 12;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = H;
	const ctx = context2d(canvas);
	ctx.font = LABEL_FONT;
	ctx.fillStyle = '#151515';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.fillText(text, w / 2, H / 2 + 2);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = anisotropy;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.generateMipmaps = true;
	return { tex, aspect: w / H };
}

export function disposeObject(root: THREE.Object3D) {
	root.traverse((o) => {
		const anyO = o as THREE.Mesh;
		if (anyO.geometry) anyO.geometry.dispose();
		const mats = Array.isArray(anyO.material)
			? anyO.material
			: anyO.material
				? [anyO.material]
				: [];
		for (const m of new Set(mats)) {
			const map = (m as THREE.MeshBasicMaterial).map;
			// Cached pattern textures are shared; only per-object clones/labels are disposed.
			if (map && !map.userData.shared && ![...textureCache.values()].includes(map)) map.dispose();
			m.dispose();
		}
	});
}
