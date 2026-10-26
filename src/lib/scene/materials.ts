import * as THREE from 'three';
import { PALETTE, type Block, type Density, type Hatch } from '$lib/model';

export const INK = 0x151515;

/** Per-face multipliers in BoxGeometry group order: +x, -x, +y, -y, +z, -z. */
const FACE_TONE = [0.84, 0.66, 0.74, 0.94, 1.0, 0.6];
/** Dark pixels out of 16 in the Bayer tile, per face. */
const DITHER_LEVEL = [5, 10, 8, 3, 1, 12];
/** Hatch lines per tile, per face. */
const HATCH_LINES = [2, 3, 3, 1, 1, 3];
const BAYER4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5]
];
const DITHER_PX = 4;
const HATCH_PX = 12;
/** Pattern tiles per world unit. */
const DENSITY_K: Record<Density, number> = { fine: 4, medium: 2, coarse: 1 };

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
	return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
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

const toned = (base: string, tone: number) => mix(base, '#000000', 1 - tone);

/**
 * The per-face value (tone, dither level, hatch lines) of the side facing azimuth `theta`
 * (radians, 0 = +x, π/2 = +y), interpolated smoothly between the four box faces.
 */
function around(vals: number[], theta: number): number {
	const keys = [vals[0], vals[2], vals[1], vals[3]]; // +x, +y, -x, -y
	const t = ((theta / (Math.PI / 2)) % 4) + 4;
	const i = Math.floor(t) % 4;
	const s = (1 - Math.cos((t - Math.floor(t)) * Math.PI)) / 2;
	return keys[i] * (1 - s) + keys[(i + 1) % 4] * s;
}

/** Like `around`, blended toward the top (+z) or bottom (-z) value by latitude `phi` (-π/2..π/2). */
function onSphere(vals: number[], theta: number, phi: number): number {
	const s = Math.sin(phi);
	const cap = s > 0 ? vals[4] : vals[5];
	return around(vals, theta) * (1 - Math.abs(s)) + cap * Math.abs(s);
}

const textureCache = new Map<string, THREE.Texture>();

function canvasTexture(
	key: string,
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
	smooth = false
) {
	const cached = textureCache.get(key);
	if (cached) return cached;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	draw(ctx);
	const tex = new THREE.CanvasTexture(canvas);
	tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
	tex.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.colorSpace = THREE.SRGBColorSpace;
	textureCache.set(key, tex);
	return tex;
}

function drawDither(ctx: CanvasRenderingContext2D, ox: number, oy: number, level: number) {
	for (let y = 0; y < DITHER_PX; y++)
		for (let x = 0; x < DITHER_PX; x++)
			if (BAYER4[y][x] < level) ctx.fillRect(ox + x, oy + y, 1, 1);
}

/** One HATCH_PX tile of 1px lines that tiles seamlessly. */
function drawHatch(
	ctx: CanvasRenderingContext2D,
	ox: number,
	oy: number,
	lines: number,
	style: Hatch
) {
	const S = HATCH_PX;
	const px = (x: number, y: number) => ctx.fillRect(ox + ((x + S) % S), oy + ((y + S) % S), 1, 1);
	for (let i = 0; i < lines; i++) {
		const off = Math.round((i * S) / lines);
		for (let x = 0; x < S; x++) {
			if (style === 'diagonal' || style === 'cross') px(x, S - 1 - x + off);
			if (style === 'backslash' || style === 'cross') px(x, x + off);
			if (style === 'horizontal' || style === 'grid') px(x, off);
			if (style === 'vertical' || style === 'grid') px(off, x);
		}
	}
}

function ditherTexture(base: string, ink: string, level: number) {
	return canvasTexture(`d:${base}:${ink}:${level}`, DITHER_PX, DITHER_PX, (ctx) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, DITHER_PX, DITHER_PX);
		ctx.fillStyle = ink;
		drawDither(ctx, 0, 0, level);
	});
}

function hatchTexture(base: string, ink: string, lines: number, style: Hatch) {
	return canvasTexture(`h:${base}:${ink}:${lines}:${style}`, HATCH_PX, HATCH_PX, (ctx) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, HATCH_PX, HATCH_PX);
		ctx.fillStyle = ink;
		drawHatch(ctx, 0, 0, lines, style);
	});
}

/**
 * A pattern that wraps around a curved surface: `cols`×`rows` tiles whose value comes from
 * `valueAt(u, v)` (0..1 across the texture), so the shading follows the surface's direction.
 */
function wrappedPattern(
	key: string,
	kind: 'dither' | 'hatch',
	base: string,
	ink: string,
	style: Hatch,
	cols: number,
	rows: number,
	valueAt: (u: number, v: number) => number
) {
	const px = kind === 'dither' ? DITHER_PX : HATCH_PX;
	return canvasTexture(
		`${key}:${kind}:${base}:${ink}:${style}:${cols}x${rows}`,
		cols * px,
		rows * px,
		(ctx) => {
			ctx.fillStyle = base;
			ctx.fillRect(0, 0, cols * px, rows * px);
			ctx.fillStyle = ink;
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++) {
					const v = Math.round(valueAt((c + 0.5) / cols, (r + 0.5) / rows));
					if (kind === 'dither') drawDither(ctx, c * px, r * px, v);
					else drawHatch(ctx, c * px, r * px, v, style);
				}
		}
	);
}

/** A smooth gradient whose colour comes from `toneAt(u, v)`. */
function wrappedGradient(
	key: string,
	base: string,
	w: number,
	h: number,
	toneAt: (u: number, v: number) => number
) {
	return canvasTexture(
		`${key}:g:${base}:${w}x${h}`,
		w,
		h,
		(ctx) => {
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++) {
					ctx.fillStyle = toned(base, toneAt((x + 0.5) / w, (y + 0.5) / h));
					ctx.fillRect(x, y, 1, 1);
				}
		},
		true
	);
}

function repeated(tex: THREE.Texture, rx: number, ry: number): THREE.Texture {
	const t = tex.clone();
	t.repeat.set(rx, ry);
	t.needsUpdate = true;
	return t;
}

const solidOpts = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
const solid = (color: string) => new THREE.MeshBasicMaterial({ color, ...solidOpts });
const mapped = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, ...solidOpts });

/** Cylinder side: texture u runs around the axis; see CylinderGeometry rotated onto z. */
const cylTheta = (u: number) => 2 * Math.PI * u - Math.PI / 2;
/** Sphere: u is azimuth, v runs from the bottom (0) to the top (1). */
const sphereTheta = (u: number) => 2 * Math.PI * u + Math.PI;
const spherePhi = (v: number) => (v - 0.5) * Math.PI;

/**
 * Geometry for a block in footprint space: x and y span 0..size, z spans 0..height, so the
 * group can simply be positioned at the block's cell. Material groups are in the order that
 * `blockMaterials` returns.
 */
export function blockGeometry(b: Pick<Block, 'shape' | 'size' | 'height'>): THREE.BufferGeometry {
	const s = b.size;
	const h = b.height;
	switch (b.shape) {
		case 'box':
			return new THREE.BoxGeometry(s, s, h).translate(s / 2, s / 2, h / 2);
		case 'cylinder':
			return new THREE.CylinderGeometry(s / 2, s / 2, h, 48, 1)
				.rotateX(Math.PI / 2)
				.translate(s / 2, s / 2, h / 2);
		case 'sphere': {
			const geo = new THREE.SphereGeometry(s / 2, 48, 32)
				.rotateX(Math.PI / 2)
				.translate(s / 2, s / 2, s / 2);
			geo.addGroup(0, Infinity, 0); // a material array only draws groups
			return geo;
		}
		case 'pyramid':
			return pyramidGeometry(s, h);
	}
}

/** Square pyramid with one material group per side (+x, -x, +y, -y) and one for the base. */
function pyramidGeometry(s: number, h: number): THREE.BufferGeometry {
	const apex = [s / 2, s / 2, h];
	const slant = Math.hypot(s / 2, h);
	const pos: number[] = [];
	const uv: number[] = [];
	const geo = new THREE.BufferGeometry();
	// Base edges wound so each face's normal points outward.
	const sides: [number[], number[]][] = [
		[
			[s, 0, 0],
			[s, s, 0]
		],
		[
			[0, s, 0],
			[0, 0, 0]
		],
		[
			[s, s, 0],
			[0, s, 0]
		],
		[
			[0, 0, 0],
			[s, 0, 0]
		]
	];
	sides.forEach(([a, b], i) => {
		pos.push(...a, ...b, ...apex);
		uv.push(0, 0, 1, 0, 0.5, 1);
		geo.addGroup(i * 3, 3, i);
	});
	pos.push(0, 0, 0, 0, s, 0, s, s, 0, 0, 0, 0, s, s, 0, s, 0, 0);
	uv.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
	geo.addGroup(12, 6, 4);
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	geo.userData.slant = slant;
	geo.computeVertexNormals();
	return geo;
}

/** Materials for a block's geometry, one per group, honouring its shade, shape and hatch settings. */
export function blockMaterials(b: Block): THREE.Material[] {
	const base = PALETTE[b.color]?.hex ?? '#ffffff';
	const s = b.size;
	const h = b.height;
	const ink = patternInk(base);
	const k = DENSITY_K[b.density];
	const kd = b.shade === 'dither' ? 4 : k; // dither is always fine-grained
	/** Flat faces: (face index into the per-face tables, [u extent, v extent] in world units). */
	const flat = (faces: [number, [number, number]][]) =>
		faces.map(([f, [du, dv]]) => {
			switch (b.shade) {
				case 'flat':
					return solid(base);
				case 'shaded':
					return solid(toned(base, FACE_TONE[f]));
				case 'dither':
					return mapped(repeated(ditherTexture(base, ink, DITHER_LEVEL[f]), du * kd, dv * kd));
				case 'hatch':
					if (HATCH_LINES[f] === 0) return solid(base);
					return mapped(repeated(hatchTexture(base, ink, HATCH_LINES[f], b.hatch), du * k, dv * k));
			}
		});
	/**
	 * A curved surface: the value varies with direction, so the whole pattern is baked into one
	 * texture. `tiles(k)` gives the tile grid at k tiles per unit and how often it repeats along v.
	 */
	const curved = (
		key: string,
		tiles: (k: number) => { cols: number; rows: number; repeatV: number },
		at: (vals: number[], u: number, v: number) => number
	) => {
		switch (b.shade) {
			case 'flat':
				return solid(base);
			case 'shaded': {
				const { rows } = tiles(1);
				return mapped(
					wrappedGradient(key, base, 256, rows > 1 ? 128 : 1, (u, v) => at(FACE_TONE, u, v))
				);
			}
			case 'dither': {
				const { cols, rows, repeatV } = tiles(kd);
				return mapped(
					repeated(
						wrappedPattern(key, 'dither', base, ink, b.hatch, cols, rows, (u, v) =>
							at(DITHER_LEVEL, u, v)
						),
						1,
						repeatV
					)
				);
			}
			case 'hatch': {
				const { cols, rows, repeatV } = tiles(k);
				return mapped(
					repeated(
						wrappedPattern(key, 'hatch', base, ink, b.hatch, cols, rows, (u, v) =>
							at(HATCH_LINES, u, v)
						),
						1,
						repeatV
					)
				);
			}
		}
	};
	switch (b.shape) {
		case 'box':
			return flat([
				[0, [h, s]],
				[1, [h, s]],
				[2, [s, h]],
				[3, [s, h]],
				[4, [s, s]],
				[5, [s, s]]
			]);
		case 'pyramid': {
			const slant = Math.hypot(s / 2, h);
			return flat([
				[0, [s, slant]],
				[1, [s, slant]],
				[2, [s, slant]],
				[3, [s, slant]],
				[5, [s, s]]
			]);
		}
		case 'cylinder': {
			const side = curved(
				`cyl:${s}`,
				(kk) => ({ cols: Math.max(8, Math.round(Math.PI * s * kk)), rows: 1, repeatV: h * kk }),
				(vals, u) => around(vals, cylTheta(u))
			);
			return [side, ...flat([[4, [s, s]]]), ...flat([[5, [s, s]]])];
		}
		case 'sphere':
			return [
				curved(
					`sph:${s}`,
					(kk) => ({
						cols: Math.max(8, Math.round(Math.PI * s * kk)),
						rows: Math.max(4, Math.round((Math.PI * s * kk) / 2)),
						repeatV: 1
					}),
					(vals, u, v) => onSphere(vals, sphereTheta(u), spherePhi(1 - v))
				)
			];
	}
}

export const LABEL_FONT = '400 46px "Geist Mono", ui-monospace, monospace';

export function labelTexture(
	text: string,
	anisotropy: number
): { tex: THREE.Texture; aspect: number } {
	const H = 64;
	const measure = document.createElement('canvas').getContext('2d')!;
	measure.font = LABEL_FONT;
	const w = Math.ceil(measure.measureText(text).width) + 12;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = H;
	const ctx = canvas.getContext('2d')!;
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
