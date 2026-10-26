<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity, svelte/no-dom-manipulating --
	   The Maps/Sets here track Three.js objects and must stay non-reactive; the DOM calls mount the WebGL canvas. */
	import * as THREE from 'three';
	import { onMount } from 'svelte';
	import {
		doc,
		ui,
		dropQueue,
		addBlock,
		addPlane,
		addLink,
		nextBlock,
		select,
		selectedBlock,
		setTool,
		pickShape,
		copySelection,
		pasteClipboard,
		deleteSelection,
		toast,
		rotateBy,
		zoomBy,
		toggleHelp
	} from '$lib/state.svelte';
	import {
		ANGLE_STEP,
		GRID_EXTENT,
		MAX_EL,
		MAX_HEIGHT,
		MAX_SIZE,
		MAX_ZOOM,
		MIN_EL,
		MIN_ZOOM,
		PALETTE,
		anchorPoint,
		blockHeight,
		clamp,
		normAngle,
		type Block,
		type Edge,
		type Link,
		type Plane,
		type SelectionRef
	} from '$lib/model';
	import { undo, redo } from '$lib/history.svelte';
	import {
		INK,
		blockGeometry,
		blockMaterials,
		labelTexture,
		disposeObject,
		mix,
		LABEL_FONT
	} from './materials';

	let container: HTMLDivElement;
	let cursor = $derived(ui.tool === 'select' ? 'default' : 'crosshair');
	let fontGen = $state(0);

	const BASE_VIEW = 24; // world units visible vertically at zoom 1
	const DIST = 300;
	const Z_PLANE = 0.01;
	/**
	 * How far block outlines are pulled toward the camera so they never z-fight with the faces,
	 * grid or plane rugs. The pull is along the view direction, so with an orthographic camera it
	 * changes only depth and the lines stay exactly on the shape's edges on screen.
	 */
	const EDGE_PULL = 0.04;
	const Z_LABEL = 0.06;
	const Z_LINK = 0.08;
	const Z_SEL = 0.1;
	const HANDLE_RADIUS = 0.075; // world units at zoom 1; see handleScale()
	const HANDLE_HIT_RADIUS = 0.25; // invisible pick target, larger than the handles so they're easy to grab
	const PYRAMID_RADIUS = 0.12; // centre to base corner
	const PYRAMID_HEIGHT = 0.15;
	const ARROW_LEN = 0.4;
	const ARROW_HALF = 0.16;
	const FLOW_SPACING = 0.8; // world units between flow dots
	const FLOW_SPEED = 1.2; // world units per second
	const FLOW_RADIUS = 0.07;
	/** Top corners of a block, as fractions of its size, in the order handles are built. */
	const CORNERS: [number, number][] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];

	type Drag =
		| { kind: 'pan'; v: THREE.Vector2 }
		| { kind: 'rotate'; x: number; y: number; az: number; el: number }
		| { kind: 'move'; sel: SelectionRef; offX: number; offY: number }
		| { kind: 'resize'; id: number; ax: number; ay: number; sx: number; sy: number; h: number }
		| { kind: 'height'; id: number; plane: THREE.Plane; off: number }
		| { kind: 'rect'; start: THREE.Vector3; cur: THREE.Vector3 };

	/** Per-frame silhouette outlines for curved shapes, which have no fixed edges to draw. */
	type Silhouette =
		| { kind: 'sphere'; line: THREE.Line }
		| { kind: 'cylinder'; line: THREE.LineSegments; r: number; h: number };

	/** A run of dots moving along a link's path. `dir` is +1 from a to b, -1 the other way. */
	interface Flow {
		mesh: THREE.InstancedMesh;
		path: THREE.Vector3[];
		cum: number[];
		length: number;
		dir: 1 | -1;
	}

	/**
	 * Handle scale for a zoom level. Zoomed in, handles keep a constant on-screen size; zoomed out,
	 * they shrink with the square root of the zoom so they stay in proportion to the smaller blocks.
	 */
	function handleScale(zoom: number): number {
		return zoom < 1 ? 1 / Math.sqrt(zoom) : 1 / zoom;
	}

	/** A corner handle's index into CORNERS, or the centre height handle. */
	type Handle = number | 'height';

	function easeOutBounce(t: number): number {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
		if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
		return n1 * (t -= 2.625 / d1) * t + 0.984375;
	}

	function lineSegments(arr: number[], color: number, z = 0) {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
		const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
		l.position.z = z;
		return l;
	}

	/**
	 * Minor and major grid lines. The group is re-centred on the camera every frame (snapped to
	 * the 5-cell major spacing) so the grid appears endless; the world axes are drawn separately.
	 */
	function buildGrid(): THREE.Group {
		const g = new THREE.Group();
		const N = GRID_EXTENT;
		const minor: number[] = [];
		const major: number[] = [];
		for (let i = -N; i <= N; i++) {
			const target = i % 5 === 0 ? major : minor;
			target.push(i, -N, 0, i, N, 0, -N, i, 0, N, i, 0);
		}
		g.add(lineSegments(minor, 0xdedbcf), lineSegments(major, 0xcbc8b9));
		return g;
	}

	function buildAxes(): THREE.LineSegments {
		const A = 1e5;
		return lineSegments([0, -A, 0, 0, A, 0, -A, 0, 0, A, 0, 0], 0xb3b0a1, 0.002);
	}

	function ring(x0: number, y0: number, x1: number, y1: number, z: number, color = INK) {
		const pts = [
			new THREE.Vector3(x0, y0, z),
			new THREE.Vector3(x1, y0, z),
			new THREE.Vector3(x1, y1, z),
			new THREE.Vector3(x0, y1, z),
			new THREE.Vector3(x0, y0, z)
		];
		const line = new THREE.Line(
			new THREE.BufferGeometry().setFromPoints(pts),
			new THREE.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.14 })
		);
		line.computeLineDistances();
		return line;
	}

	/** Cumulative distances along a polyline. */
	function cumulative(path: THREE.Vector3[]): number[] {
		const cum = [0];
		for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
		return cum;
	}

	/** The point `d` units along a polyline, plus the unit tangent there. */
	function alongPath(
		path: THREE.Vector3[],
		cum: number[],
		d: number
	): { p: THREE.Vector3; t: THREE.Vector3 } {
		const total = cum[cum.length - 1];
		d = clamp(d, 0, total);
		let i = 1;
		while (i < cum.length - 1 && cum[i] < d) i++;
		const a = path[i - 1];
		const b = path[i];
		const seg = cum[i] - cum[i - 1];
		const f = seg > 0 ? (d - cum[i - 1]) / seg : 0;
		const t = b.clone().sub(a).normalize();
		return { p: a.clone().lerp(b, f), t };
	}

	onMount(() => {
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearColor(0xf3f1e6);
		container.appendChild(renderer.domElement);
		const el = renderer.domElement;
		const maxAniso = renderer.capabilities.getMaxAnisotropy();

		const scene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
		camera.up.set(0, 0, 1);
		const raycaster = new THREE.Raycaster();
		raycaster.params.Line = { threshold: 0.2 };
		const floor = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
		const grid = buildGrid();
		scene.add(grid, buildAxes());
		// Only the lit selection handles use these; everything else is MeshBasicMaterial.
		const sun = new THREE.DirectionalLight(0xffffff, 2.2);
		sun.position.set(-3, -5, 10);
		scene.add(new THREE.AmbientLight(0xffffff, 1.4), sun);

		const edgeMat = new THREE.LineBasicMaterial({ color: INK });
		const blockObjs = new Map<
			number,
			{ group: THREE.Group; mesh: THREE.Mesh; sig: string; drop?: number; sil?: Silhouette }
		>();
		const planeObjs = new Map<number, { group: THREE.Group; mesh: THREE.Mesh; sig: string }>();
		const linkObjs = new Map<
			number,
			{ group: THREE.Group; pickables: THREE.Object3D[]; flows: Flow[]; sig: string }
		>();
		const selectionGroup = new THREE.Group();
		const handles: THREE.Mesh[] = [];
		const hitAreas: THREE.Mesh[] = [];
		const previewGroup = new THREE.Group();
		const ghostGroup = new THREE.Group();
		scene.add(selectionGroup, previewGroup, ghostGroup);

		let width = 1;
		let height = 1;
		function resize() {
			width = Math.max(1, container.clientWidth);
			height = Math.max(1, container.clientHeight);
			renderer.setSize(width, height, false);
			el.style.width = '100%';
			el.style.height = '100%';
			applyCamera();
		}
		const ro = new ResizeObserver(resize);
		ro.observe(container);

		function applyCamera() {
			const c = doc.camera;
			const az = THREE.MathUtils.degToRad(c.az);
			const elv = THREE.MathUtils.degToRad(c.el);
			const dir = new THREE.Vector3(
				Math.cos(elv) * Math.sin(az),
				-Math.cos(elv) * Math.cos(az),
				Math.sin(elv)
			);
			camera.position.set(c.tx + dir.x * DIST, c.ty + dir.y * DIST, dir.z * DIST);
			camera.lookAt(c.tx, c.ty, 0);
			const halfH = BASE_VIEW / c.zoom / 2;
			const halfW = (halfH * width) / height;
			camera.left = -halfW;
			camera.right = halfW;
			camera.top = halfH;
			camera.bottom = -halfH;
			camera.updateProjectionMatrix();
			// Keep the grid centred under the camera; snapping keeps its major lines in place.
			grid.position.set(Math.round(c.tx / 5) * 5, Math.round(c.ty / 5) * 5, 0);
			// Outlines follow the camera so their depth offset never shows as a screen offset.
			const pull = dir.clone().multiplyScalar(EDGE_PULL);
			scene.traverse((o) => {
				if (o.userData.pull) o.position.copy(pull);
			});
		}
		resize();

		function ndc(e: { clientX: number; clientY: number }): THREE.Vector2 {
			const r = el.getBoundingClientRect();
			return new THREE.Vector2(
				((e.clientX - r.left) / r.width) * 2 - 1,
				-((e.clientY - r.top) / r.height) * 2 + 1
			);
		}

		/** Raycasting must not depend on a frame having rendered since the last camera change. */
		function syncMatrices() {
			applyCamera();
			camera.updateMatrixWorld();
			scene.updateMatrixWorld();
		}

		function floorHit(v: THREE.Vector2): THREE.Vector3 | null {
			syncMatrices();
			raycaster.setFromCamera(v, camera);
			const out = new THREE.Vector3();
			return raycaster.ray.intersectPlane(floor, out) ? out : null;
		}

		/** The handle under the pointer, if any. */
		function pickHandle(v: THREE.Vector2): Handle | null {
			if (!handles.length) return null;
			syncMatrices();
			raycaster.setFromCamera(v, camera);
			const h = raycaster.intersectObjects(hitAreas, false)[0];
			return h ? (h.object.userData.handle as Handle) : null;
		}

		function pick(v: THREE.Vector2): SelectionRef | null {
			syncMatrices();
			raycaster.setFromCamera(v, camera);
			const meshes: THREE.Object3D[] = [];
			for (const o of blockObjs.values()) meshes.push(o.mesh);
			for (const o of planeObjs.values()) meshes.push(o.mesh);
			const lines: THREE.Object3D[] = [];
			for (const o of linkObjs.values()) lines.push(...o.pickables);
			const mh = raycaster.intersectObjects(meshes, false)[0];
			const lh = raycaster.intersectObjects(lines, false)[0];
			let best: { d: number; ref: SelectionRef } | null = null;
			if (mh) best = { d: mh.distance, ref: mh.object.userData as SelectionRef };
			if (lh && (!best || lh.distance < best.d))
				best = { d: lh.distance, ref: lh.object.userData as SelectionRef };
			return best ? { kind: best.ref.kind, id: best.ref.id } : null;
		}

		// ---------- builders ----------

		function labelMesh(text: string, size: number): { mesh: THREE.Mesh; w: number } {
			const { tex, aspect } = labelTexture(text, maxAniso);
			const w = size * aspect;
			const mesh = new THREE.Mesh(
				new THREE.PlaneGeometry(w, size),
				new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
			);
			return { mesh, w };
		}

		/**
		 * Lay a floor label along one edge of a w×h footprint, reading from that edge.
		 * A positive offset places it outside the footprint, a negative one inside.
		 */
		function placeLabel(lm: THREE.Mesh, edge: Edge, w: number, h: number, offset: number) {
			switch (edge) {
				case 'S':
					lm.position.set(w / 2, -offset, Z_LABEL);
					break;
				case 'N':
					lm.position.set(w / 2, h + offset, Z_LABEL);
					lm.rotation.z = Math.PI;
					break;
				case 'E':
					lm.position.set(w + offset, h / 2, Z_LABEL);
					lm.rotation.z = Math.PI / 2;
					break;
				case 'W':
					lm.position.set(-offset, h / 2, Z_LABEL);
					lm.rotation.z = -Math.PI / 2;
					break;
			}
		}

		/** Fixed edge lines for a shape, in footprint space. Curved shapes only get their rims. */
		function shapeEdges(b: Block, geo: THREE.BufferGeometry, mat: THREE.Material) {
			if (b.shape === 'sphere') return null;
			const edges = new THREE.LineSegments(
				new THREE.EdgesGeometry(geo, b.shape === 'cylinder' ? 30 : 1),
				mat
			);
			edges.userData.pull = true;
			return edges;
		}

		function buildSilhouette(b: Block, mat: THREE.Material): Silhouette | null {
			const r = b.size / 2 + 0.01;
			if (b.shape === 'sphere') {
				const pts: THREE.Vector3[] = [];
				for (let i = 0; i <= 64; i++) {
					const t = (i / 64) * Math.PI * 2;
					pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
				}
				const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
				line.position.set(b.size / 2, b.size / 2, b.size / 2);
				return { kind: 'sphere', line };
			}
			if (b.shape === 'cylinder') {
				const line = new THREE.LineSegments(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(),
						new THREE.Vector3(),
						new THREE.Vector3(),
						new THREE.Vector3()
					]),
					mat
				);
				line.position.set(b.size / 2, b.size / 2, 0);
				return { kind: 'cylinder', line, r, h: b.height };
			}
			return null;
		}

		/** Point the silhouette lines at the camera. */
		function updateSilhouette(s: Silhouette) {
			if (s.kind === 'sphere') {
				s.line.quaternion.copy(camera.quaternion);
				return;
			}
			const d = camera.getWorldDirection(new THREE.Vector3());
			const px = -d.y;
			const py = d.x;
			const n = Math.hypot(px, py) || 1;
			const x = (px / n) * s.r;
			const y = (py / n) * s.r;
			const pos = s.line.geometry.getAttribute('position') as THREE.BufferAttribute;
			pos.setXYZ(0, x, y, 0);
			pos.setXYZ(1, x, y, s.h);
			pos.setXYZ(2, -x, -y, 0);
			pos.setXYZ(3, -x, -y, s.h);
			pos.needsUpdate = true;
		}

		function buildBlock(b: Block) {
			const group = new THREE.Group();
			const geo = blockGeometry(b);
			const mesh = new THREE.Mesh(geo, blockMaterials(b));
			mesh.userData = { kind: 'block', id: b.id };
			group.add(mesh);
			const edges = shapeEdges(b, geo, edgeMat);
			if (edges) group.add(edges);
			const sil = buildSilhouette(b, edgeMat) ?? undefined;
			if (sil) group.add(sil.line);

			const text = b.label.trim();
			if (text) {
				const { mesh: lm } = labelMesh(text, b.labelSize);
				placeLabel(lm, b.edge, b.size, b.size, 0.15 + b.labelSize / 2);
				group.add(lm);
			}
			group.position.set(b.x, b.y, 0);
			return { group, mesh, sil };
		}

		function buildPlane(p: Plane) {
			const group = new THREE.Group();
			const hex = PALETTE[p.color]?.hex ?? '#ffffff';
			const mesh = new THREE.Mesh(
				new THREE.PlaneGeometry(p.w, p.h),
				new THREE.MeshBasicMaterial({ color: hex })
			);
			mesh.position.set(p.w / 2, p.h / 2, Z_PLANE);
			mesh.userData = { kind: 'plane', id: p.id };
			const outline = new THREE.LineLoop(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(0, 0, Z_PLANE + 0.002),
					new THREE.Vector3(p.w, 0, Z_PLANE + 0.002),
					new THREE.Vector3(p.w, p.h, Z_PLANE + 0.002),
					new THREE.Vector3(0, p.h, Z_PLANE + 0.002)
				]),
				new THREE.LineBasicMaterial({ color: mix(hex, '#151515', 0.35) })
			);
			group.add(mesh, outline);
			const text = p.label.trim();
			if (text) {
				const { mesh: lm } = labelMesh(text, p.labelSize);
				placeLabel(lm, p.edge, p.w, p.h, -(0.2 + p.labelSize / 2));
				group.add(lm);
			}
			group.position.set(p.x, p.y, 0);
			return { group, mesh };
		}

		/** The floor route of a link, honouring its style, bend and anchors. */
		function linkPath(l: Link, a: Block, b: Block): THREE.Vector3[] {
			const [ax, ay] = anchorPoint(a, l.from);
			const [bx, by] = anchorPoint(b, l.to);
			const P = (x: number, y: number) => new THREE.Vector3(x, y, Z_LINK);
			const start = P(ax, ay);
			const end = P(bx, by);
			const corner = l.bend === 'x' ? P(bx, ay) : P(ax, by);
			const bent = !corner.equals(start) && !corner.equals(end);
			switch (l.style) {
				case 'straight':
					return [start, end];
				case 'elbow':
					return bent ? [start, corner, end] : [start, end];
				case 'curve':
					return bent
						? new THREE.QuadraticBezierCurve3(start, corner, end).getPoints(32)
						: [start, end];
			}
		}

		function lineMaterial(l: Link, color = INK): THREE.Material {
			switch (l.dash) {
				case 'solid':
					return new THREE.LineBasicMaterial({ color });
				case 'dashed':
					return new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.18 });
				case 'dotted':
					return new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.14 });
			}
		}

		/** A flat arrowhead whose tip sits at `tip`, pointing along `dir`. */
		function arrowhead(tip: THREE.Vector3, dir: THREE.Vector3) {
			const n = new THREE.Vector3(-dir.y, dir.x, 0);
			const base = tip.clone().addScaledVector(dir, -ARROW_LEN);
			const l = base.clone().addScaledVector(n, ARROW_HALF);
			const r = base.clone().addScaledVector(n, -ARROW_HALF);
			const geo = new THREE.BufferGeometry().setFromPoints([tip, l, r]);
			const mesh = new THREE.Mesh(
				geo,
				new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide })
			);
			mesh.position.z = 0.005;
			return mesh;
		}

		function buildFlow(path: THREE.Vector3[], cum: number[], dir: 1 | -1): Flow {
			const length = cum[cum.length - 1];
			const count = Math.max(1, Math.ceil(length / FLOW_SPACING));
			const mesh = new THREE.InstancedMesh(
				new THREE.CircleGeometry(FLOW_RADIUS, 16),
				new THREE.MeshBasicMaterial({ color: INK }),
				count
			);
			mesh.position.z = 0.01;
			return { mesh, path, cum, length, dir };
		}

		function updateFlow(f: Flow, now: number) {
			const phase = ((now / 1000) * FLOW_SPEED) % FLOW_SPACING;
			const m = new THREE.Matrix4();
			for (let i = 0; i < f.mesh.count; i++) {
				let d = i * FLOW_SPACING + phase;
				if (f.dir < 0) d = f.length - d;
				const { p } = alongPath(f.path, f.cum, d);
				const visible = d >= 0 && d <= f.length;
				m.makeTranslation(p.x, p.y, 0);
				if (!visible) m.scale(new THREE.Vector3(0, 0, 0));
				f.mesh.setMatrixAt(i, m);
			}
			f.mesh.instanceMatrix.needsUpdate = true;
		}

		function buildLink(l: Link, a: Block, b: Block) {
			const group = new THREE.Group();
			const pickables: THREE.Object3D[] = [];
			const flows: Flow[] = [];
			const path = linkPath(l, a, b);
			const cum = cumulative(path);
			const ref = { kind: 'link', id: l.id };

			const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), lineMaterial(l));
			if (l.dash !== 'solid') line.computeLineDistances();
			line.userData = ref;
			group.add(line);
			pickables.push(line);

			if (l.direction !== 'none' && path.length > 1) {
				const endT = path[path.length - 1]
					.clone()
					.sub(path[path.length - 2])
					.normalize();
				const head = arrowhead(path[path.length - 1], endT);
				head.userData = ref;
				group.add(head);
				pickables.push(head);
				if (l.direction === 'both') {
					const startT = path[0].clone().sub(path[1]).normalize();
					const tail = arrowhead(path[0], startT);
					tail.userData = ref;
					group.add(tail);
					pickables.push(tail);
				}
				if (l.animated) {
					flows.push(buildFlow(path, cum, 1));
					if (l.direction === 'both') flows.push(buildFlow(path, cum, -1));
					for (const f of flows) group.add(f.mesh);
				}
			}

			const text = l.label.trim();
			if (text && cum[cum.length - 1] > 0) {
				const { mesh: lm } = labelMesh(text, l.labelSize);
				const { p, t } = alongPath(path, cum, cum[cum.length - 1] / 2);
				// Run the label along the line, never upside down, just to one side of it.
				let ang = Math.atan2(t.y, t.x);
				if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
				const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
				lm.position.copy(p).addScaledVector(n, 0.1 + l.labelSize / 2);
				lm.position.z = Z_LINK + 0.01;
				lm.rotation.z = ang;
				group.add(lm);
			}
			return { group, pickables, flows };
		}

		// ---------- reactive sync ----------

		$effect(() => {
			void fontGen;
			const seen = new Set<number>();
			for (const b of doc.blocks) {
				const sig = JSON.stringify(b) + fontGen;
				seen.add(b.id);
				const prev = blockObjs.get(b.id);
				if (prev && prev.sig === sig) continue;
				let drop = prev?.drop;
				let z = 0;
				if (prev) {
					z = prev.group.position.z;
					scene.remove(prev.group);
					disposeObject(prev.group);
				} else if (dropQueue.delete(b.id)) {
					drop = performance.now();
				}
				const built = buildBlock($state.snapshot(b));
				built.group.position.z = z;
				blockObjs.set(b.id, { ...built, sig, drop });
				scene.add(built.group);
			}
			for (const [id, o] of blockObjs) {
				if (seen.has(id)) continue;
				scene.remove(o.group);
				disposeObject(o.group);
				blockObjs.delete(id);
			}
		});

		$effect(() => {
			void fontGen;
			const seen = new Set<number>();
			for (const p of doc.planes) {
				const sig = JSON.stringify(p) + fontGen;
				seen.add(p.id);
				const prev = planeObjs.get(p.id);
				if (prev && prev.sig === sig) continue;
				if (prev) {
					scene.remove(prev.group);
					disposeObject(prev.group);
				}
				const built = buildPlane($state.snapshot(p));
				planeObjs.set(p.id, { ...built, sig });
				scene.add(built.group);
			}
			for (const [id, o] of planeObjs) {
				if (seen.has(id)) continue;
				scene.remove(o.group);
				disposeObject(o.group);
				planeObjs.delete(id);
			}
		});

		$effect(() => {
			void fontGen;
			const seen = new Set<number>();
			for (const l of doc.links) {
				const a = doc.blocks.find((b) => b.id === l.a);
				const b = doc.blocks.find((bb) => bb.id === l.b);
				if (!a || !b) continue;
				const sig = JSON.stringify([l, anchorPoint(a, l.from), anchorPoint(b, l.to)]) + fontGen;
				seen.add(l.id);
				const prev = linkObjs.get(l.id);
				if (prev && prev.sig === sig) continue;
				if (prev) {
					scene.remove(prev.group);
					disposeObject(prev.group);
				}
				const built = buildLink($state.snapshot(l), $state.snapshot(a), $state.snapshot(b));
				linkObjs.set(l.id, { ...built, sig });
				scene.add(built.group);
			}
			for (const [id, o] of linkObjs) {
				if (seen.has(id)) continue;
				scene.remove(o.group);
				disposeObject(o.group);
				linkObjs.delete(id);
			}
		});

		/** Drawn over the block so the handles stay grabbable from any angle. */
		function overlay(mesh: THREE.Object3D, order: number, handle: Handle | null) {
			mesh.renderOrder = order;
			mesh.scale.setScalar(handleScale(doc.camera.zoom));
			if (handle !== null) {
				const hit = new THREE.Mesh(
					new THREE.SphereGeometry(HANDLE_HIT_RADIUS, 12, 8),
					new THREE.MeshBasicMaterial()
				);
				hit.visible = false; // raycasting ignores visibility, so this still picks
				hit.userData = { handle };
				mesh.add(hit);
				hitAreas.push(hit);
			}
			handles.push(mesh as THREE.Mesh);
			selectionGroup.add(mesh);
		}

		function buildHandle(x: number, y: number, z: number, corner: Handle | null) {
			const mesh = new THREE.Mesh(
				new THREE.SphereGeometry(HANDLE_RADIUS, 24, 16),
				new THREE.MeshLambertMaterial({ color: 0x2a2925, depthTest: false })
			);
			const outline = new THREE.Mesh(
				new THREE.SphereGeometry(HANDLE_RADIUS * 1.18, 24, 16),
				new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, depthTest: false })
			);
			outline.renderOrder = 10;
			mesh.add(outline);
			mesh.position.set(x, y, z);
			overlay(mesh, 11, corner);
		}

		/** Four-sided pyramid standing on the top face, base edges aligned with the block's. */
		function buildHeightHandle(x: number, y: number, z: number) {
			const geo = new THREE.ConeGeometry(PYRAMID_RADIUS, PYRAMID_HEIGHT, 4)
				.rotateY(Math.PI / 4)
				.translate(0, PYRAMID_HEIGHT / 2, 0)
				.rotateX(Math.PI / 2);
			const mesh = new THREE.Mesh(
				geo,
				new THREE.MeshLambertMaterial({ color: 0x2a2925, flatShading: true, depthTest: false })
			);
			const edges = new THREE.LineSegments(
				new THREE.EdgesGeometry(geo),
				new THREE.LineBasicMaterial({ color: INK, depthTest: false })
			);
			edges.renderOrder = 12;
			mesh.add(edges);
			mesh.position.set(x, y, z);
			overlay(mesh, 11, 'height');
		}

		$effect(() => {
			for (const c of [...selectionGroup.children]) {
				selectionGroup.remove(c);
				disposeObject(c);
			}
			handles.length = 0;
			hitAreas.length = 0;
			const s = ui.selection;
			const pad = 0.12;
			if (s?.kind === 'block') {
				const b = doc.blocks.find((x) => x.id === s.id);
				if (b) {
					selectionGroup.add(
						ring(b.x - pad, b.y - pad, b.x + b.size + pad, b.y + b.size + pad, Z_SEL)
					);
					if (ui.tool === 'select') {
						const top = blockHeight(b);
						CORNERS.forEach(([fx, fy], i) =>
							buildHandle(b.x + fx * b.size, b.y + fy * b.size, top, i)
						);
						if (b.shape !== 'sphere') buildHeightHandle(b.x + b.size / 2, b.y + b.size / 2, top);
					}
				}
			} else if (s?.kind === 'plane') {
				const p = doc.planes.find((x) => x.id === s.id);
				if (p)
					selectionGroup.add(ring(p.x - pad, p.y - pad, p.x + p.w + pad, p.y + p.h + pad, Z_SEL));
			} else if (s?.kind === 'link') {
				const l = doc.links.find((x) => x.id === s.id);
				const a = l && doc.blocks.find((x) => x.id === l.a);
				const b = l && doc.blocks.find((x) => x.id === l.b);
				if (l && a && b) {
					const [ax, ay] = anchorPoint(a, l.from);
					const [bx, by] = anchorPoint(b, l.to);
					buildHandle(ax, ay, Z_SEL, null);
					buildHandle(bx, by, Z_SEL, null);
				}
			}
			if (ui.linkFrom != null) {
				const b = doc.blocks.find((x) => x.id === ui.linkFrom);
				if (b)
					selectionGroup.add(
						ring(b.x - pad, b.y - pad, b.x + b.size + pad, b.y + b.size + pad, Z_SEL)
					);
			}
		});

		// ---------- ghost preview for the block tool ----------

		let ghostCell: { x: number; y: number } | null = null;

		function clearGhost() {
			ghostCell = null;
			for (const c of [...ghostGroup.children]) {
				ghostGroup.remove(c);
				disposeObject(c);
			}
		}

		/** Show where the next block will land: its footprint shadow on the grid plus a faint shape. */
		function setGhost(cell: { x: number; y: number } | null) {
			if (cell && ghostCell && cell.x === ghostCell.x && cell.y === ghostCell.y) return;
			clearGhost();
			if (!cell) return;
			ghostCell = cell;
			const b = nextBlock(cell.x, cell.y);
			const shadow = new THREE.Mesh(
				new THREE.PlaneGeometry(b.size, b.size),
				new THREE.MeshBasicMaterial({
					color: INK,
					transparent: true,
					opacity: 0.22,
					depthWrite: false
				})
			);
			shadow.position.set(b.size / 2, b.size / 2, Z_SEL);
			const geo = blockGeometry(b);
			const body = new THREE.Mesh(
				geo,
				new THREE.MeshBasicMaterial({
					color: INK,
					transparent: true,
					opacity: 0.07,
					depthWrite: false
				})
			);
			const outlineMat = new THREE.LineBasicMaterial({
				color: INK,
				transparent: true,
				opacity: 0.5
			});
			ghostGroup.add(shadow, body);
			const edges = shapeEdges(b, geo, outlineMat);
			if (edges) ghostGroup.add(edges);
			const sil = buildSilhouette(b, outlineMat);
			if (sil) {
				ghostGroup.add(sil.line);
				ghostGroup.userData.sil = sil;
			} else ghostGroup.userData.sil = undefined;
			ghostGroup.add(ring(0, 0, b.size, b.size, Z_SEL + 0.002));
			ghostGroup.position.set(cell.x, cell.y, 0);
		}

		$effect(() => {
			void ui.shape;
			if (ui.tool !== 'shape') clearGhost();
			else {
				// Rebuild on the next move so a shape change shows immediately.
				const c = ghostCell;
				clearGhost();
				if (c) setGhost(c);
			}
		});

		// ---------- interaction ----------

		let drag: Drag | null = null;
		let spaceDown = false;

		function rectFromDrag(d: { start: THREE.Vector3; cur: THREE.Vector3 }) {
			const x0 = Math.floor(Math.min(d.start.x, d.cur.x));
			const y0 = Math.floor(Math.min(d.start.y, d.cur.y));
			const x1 = Math.max(Math.ceil(Math.max(d.start.x, d.cur.x)), x0 + 1);
			const y1 = Math.max(Math.ceil(Math.max(d.start.y, d.cur.y)), y0 + 1);
			return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
		}

		function updatePreview() {
			for (const c of [...previewGroup.children]) {
				previewGroup.remove(c);
				disposeObject(c);
			}
			if (drag?.kind === 'rect') {
				const r = rectFromDrag(drag);
				previewGroup.add(ring(r.x, r.y, r.x + r.w, r.y + r.h, Z_SEL));
			}
		}

		function onPointerDown(e: PointerEvent) {
			const v = ndc(e);
			el.setPointerCapture(e.pointerId);
			if (e.button === 1 || (e.button === 0 && spaceDown)) {
				drag = { kind: 'pan', v };
				cursor = 'grabbing';
				return;
			}
			if (e.button === 2 || (e.button === 0 && e.altKey)) {
				drag = { kind: 'rotate', x: e.clientX, y: e.clientY, az: doc.camera.az, el: doc.camera.el };
				cursor = 'ew-resize';
				return;
			}
			if (e.button !== 0) return;
			const hit = pick(v);
			const fh = floorHit(v);
			switch (ui.tool) {
				case 'shape': {
					if (hit?.kind === 'block') {
						select(hit);
						break;
					}
					if (fh) {
						addBlock(Math.floor(fh.x), Math.floor(fh.y));
						clearGhost();
						// Hold shift to keep dropping blocks.
						if (!e.shiftKey) setTool('select');
					}
					break;
				}
				case 'plane': {
					if (fh) {
						drag = { kind: 'rect', start: fh.clone(), cur: fh.clone() };
						updatePreview();
					}
					break;
				}
				case 'link': {
					if (hit?.kind === 'block') {
						if (ui.linkFrom == null) ui.linkFrom = hit.id;
						else {
							addLink(ui.linkFrom, hit.id);
							ui.linkFrom = null;
						}
					} else ui.linkFrom = null;
					break;
				}
				default: {
					const handle = pickHandle(v);
					const sb = selectedBlock();
					if (handle === 'height' && sb) {
						// Vertical plane through the block's centre, facing the camera.
						syncMatrices();
						const n = camera.getWorldDirection(new THREE.Vector3()).setZ(0).normalize();
						const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
							n,
							new THREE.Vector3(sb.x + sb.size / 2, sb.y + sb.size / 2, 0)
						);
						raycaster.setFromCamera(v, camera);
						const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
						drag = { kind: 'height', id: sb.id, plane, off: p ? p.z - sb.height : 0 };
						cursor = 'ns-resize';
						break;
					}
					if (typeof handle === 'number' && sb) {
						const [fx, fy] = CORNERS[handle];
						drag = {
							kind: 'resize',
							id: sb.id,
							ax: sb.x + (1 - fx) * sb.size,
							ay: sb.y + (1 - fy) * sb.size,
							sx: fx ? 1 : -1,
							sy: fy ? 1 : -1,
							h: blockHeight(sb)
						};
						cursor = 'grabbing';
						break;
					}
					if (hit) {
						select(hit);
						if (hit.kind === 'block' && fh) {
							const b = doc.blocks.find((x) => x.id === hit.id)!;
							drag = { kind: 'move', sel: hit, offX: fh.x - b.x, offY: fh.y - b.y };
						} else if (hit.kind === 'plane' && fh) {
							const p = doc.planes.find((x) => x.id === hit.id)!;
							drag = { kind: 'move', sel: hit, offX: fh.x - p.x, offY: fh.y - p.y };
						}
					} else {
						select(null);
						drag = { kind: 'pan', v };
						cursor = 'grabbing';
					}
				}
			}
		}

		function onPointerMove(e: PointerEvent) {
			const v = ndc(e);
			if (!drag) {
				if (ui.tool === 'shape') {
					const hit = pick(v);
					const fh = hit?.kind === 'block' ? null : floorHit(v);
					setGhost(fh ? { x: Math.floor(fh.x), y: Math.floor(fh.y) } : null);
					cursor = hit?.kind === 'block' ? 'pointer' : 'crosshair';
					return;
				}
				if (ui.tool === 'select') {
					const handle = pickHandle(v);
					if (handle != null) {
						cursor = handle === 'height' ? 'ns-resize' : 'grab';
						return;
					}
				}
				if (ui.tool === 'select' || ui.tool === 'link') {
					const hit = pick(v);
					cursor = hit
						? 'pointer'
						: ui.tool === 'select'
							? spaceDown
								? 'grab'
								: 'default'
							: 'crosshair';
				}
				return;
			}
			switch (drag.kind) {
				case 'pan': {
					const a = floorHit(drag.v);
					const b = floorHit(v);
					if (a && b) {
						doc.camera.tx += a.x - b.x;
						doc.camera.ty += a.y - b.y;
						applyCamera();
					}
					drag.v = v;
					break;
				}
				case 'rotate': {
					const dx = e.clientX - drag.x;
					const dy = e.clientY - drag.y;
					const az = normAngle(drag.az - Math.round(dx / 30) * ANGLE_STEP);
					const elv = clamp(drag.el + Math.round(dy / 30) * ANGLE_STEP, MIN_EL, MAX_EL);
					if (az !== doc.camera.az) doc.camera.az = az;
					if (elv !== doc.camera.el) doc.camera.el = elv;
					break;
				}
				case 'move': {
					const fh = floorHit(v);
					if (!fh) break;
					const nx = Math.round(fh.x - drag.offX);
					const ny = Math.round(fh.y - drag.offY);
					const sel = drag.sel;
					const target =
						sel.kind === 'block'
							? doc.blocks.find((x) => x.id === sel.id)
							: doc.planes.find((x) => x.id === sel.id);
					if (target && (target.x !== nx || target.y !== ny)) {
						target.x = nx;
						target.y = ny;
					}
					break;
				}
				case 'resize': {
					// Project onto the block's top face so the corner tracks the pointer.
					syncMatrices();
					raycaster.setFromCamera(v, camera);
					const top = new THREE.Plane(new THREE.Vector3(0, 0, 1), -drag.h);
					const p = raycaster.ray.intersectPlane(top, new THREE.Vector3());
					const id = drag.id;
					const b = doc.blocks.find((x) => x.id === id);
					if (!p || !b) break;
					const size = clamp(
						Math.round(Math.max((p.x - drag.ax) * drag.sx, (p.y - drag.ay) * drag.sy)),
						1,
						MAX_SIZE
					);
					const nx = drag.sx > 0 ? drag.ax : drag.ax - size;
					const ny = drag.sy > 0 ? drag.ay : drag.ay - size;
					if (b.size !== size || b.x !== nx || b.y !== ny) {
						b.size = size;
						b.x = nx;
						b.y = ny;
					}
					break;
				}
				case 'height': {
					syncMatrices();
					raycaster.setFromCamera(v, camera);
					const p = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3());
					const id = drag.id;
					const b = doc.blocks.find((x) => x.id === id);
					if (!p || !b) break;
					const h = clamp(Math.round(p.z - drag.off), 1, MAX_HEIGHT);
					if (b.height !== h) b.height = h;
					break;
				}
				case 'rect': {
					const fh = floorHit(v);
					if (fh) {
						drag.cur = fh;
						updatePreview();
					}
					break;
				}
			}
		}

		function onPointerUp(e: PointerEvent) {
			if (drag?.kind === 'rect') {
				const r = rectFromDrag(drag);
				addPlane(r.x, r.y, r.w, r.h);
				// Hold shift to keep drawing planes.
				if (!e.shiftKey) setTool('select');
			}
			drag = null;
			updatePreview();
			cursor = ui.tool === 'select' ? 'default' : 'crosshair';
			if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
		}

		function onPointerLeave() {
			if (!drag) setGhost(null);
		}

		function onWheel(e: WheelEvent) {
			e.preventDefault();
			const v = ndc(e);
			const before = floorHit(v);
			const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
			doc.camera.zoom = clamp(doc.camera.zoom * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM);
			applyCamera();
			const after = floorHit(v);
			if (before && after) {
				doc.camera.tx += before.x - after.x;
				doc.camera.ty += before.y - after.y;
				applyCamera();
			}
		}

		function screenAxes(): { right: [number, number]; up: [number, number] } {
			const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
			const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
			const dom = (v: THREE.Vector3): [number, number] =>
				Math.abs(v.x) >= Math.abs(v.y) ? [Math.sign(v.x), 0] : [0, Math.sign(v.y)];
			return { right: dom(r), up: dom(u) };
		}

		function onKeyDown(e: KeyboardEvent) {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
			if (e.metaKey || e.ctrlKey) {
				if (e.altKey) return;
				const k = e.key.toLowerCase();
				if (k === 'z' || (k === 'y' && !e.shiftKey)) {
					const isRedo = k === 'y' || e.shiftKey;
					if (isRedo) toast(redo() ? 'Redo' : 'Nothing to redo');
					else toast(undo() ? 'Undo' : 'Nothing to undo');
					e.preventDefault();
					return;
				}
				if (e.shiftKey) return;
				if (k === 'c' && ui.tool === 'select') {
					const sel = ui.selection;
					if (copySelection()) {
						toast(`Copied ${sel?.kind}`);
						e.preventDefault();
					}
				} else if (k === 'v' && ui.tool === 'select') {
					const pasted = pasteClipboard();
					if (pasted) {
						toast(`Pasted ${ui.selection?.kind}`);
						e.preventDefault();
					}
				}
				return;
			}
			switch (e.key) {
				case ' ':
					spaceDown = true;
					if (!drag) cursor = 'grab';
					e.preventDefault();
					break;
				case 'Delete':
				case 'Backspace': {
					const kind = ui.selection?.kind;
					deleteSelection();
					if (kind) toast(`Deleted ${kind}`);
					e.preventDefault();
					break;
				}
				case 'Escape':
					if (ui.help) {
						toggleHelp(false);
						break;
					}
					if (ui.tool !== 'select') toast('Select tool');
					else if (ui.selection) toast('Deselected');
					setTool('select');
					select(null);
					break;
				case '?':
					toggleHelp();
					break;
				case 'v':
					setTool('select');
					toast('Select tool');
					break;
				case 'b':
					pickShape('box');
					toast('Box shape');
					break;
				case 'c':
					pickShape('cylinder');
					toast('Cylinder shape');
					break;
				case 's':
					pickShape('sphere');
					toast('Sphere shape');
					break;
				case 'y':
					pickShape('pyramid');
					toast('Pyramid shape');
					break;
				case 'p':
					setTool('plane');
					toast('Plane tool');
					break;
				case 'l':
					setTool('link');
					toast('Link tool');
					break;
				case 'q':
					rotateBy(1);
					toast('Rotate left');
					break;
				case 'e':
					rotateBy(-1);
					toast('Rotate right');
					break;
				case '=':
				case '+':
					zoomBy(1.25);
					toast('Zoom in');
					break;
				case '-':
					zoomBy(0.8);
					toast('Zoom out');
					break;
				case 'ArrowUp':
				case 'ArrowDown':
				case 'ArrowLeft':
				case 'ArrowRight': {
					const s = ui.selection;
					if (!s || s.kind === 'link') return;
					const target =
						s.kind === 'block'
							? doc.blocks.find((x) => x.id === s.id)
							: doc.planes.find((x) => x.id === s.id);
					if (!target) return;
					const ax = screenAxes();
					const dir =
						e.key === 'ArrowUp'
							? ax.up
							: e.key === 'ArrowDown'
								? [-ax.up[0], -ax.up[1]]
								: e.key === 'ArrowRight'
									? ax.right
									: [-ax.right[0], -ax.right[1]];
					target.x += dir[0];
					target.y += dir[1];
					toast(`Nudged ${s.kind}`);
					e.preventDefault();
					break;
				}
			}
		}

		function onKeyUp(e: KeyboardEvent) {
			if (e.key === ' ') {
				spaceDown = false;
				if (!drag) cursor = ui.tool === 'select' ? 'default' : 'crosshair';
			}
		}

		const preventCtx = (e: Event) => e.preventDefault();
		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerUp);
		el.addEventListener('pointerleave', onPointerLeave);
		el.addEventListener('wheel', onWheel, { passive: false });
		el.addEventListener('contextmenu', preventCtx);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);

		// Re-render labels once the web font is available.
		if (document.fonts?.load) {
			document.fonts
				.load(LABEL_FONT)
				.then(() => (fontGen += 1))
				.catch(() => {});
		}

		// ---------- render loop ----------

		let raf = 0;
		const DROP_MS = 700;
		const DROP_HEIGHT = 8;
		const loop = (now: number) => {
			applyCamera();
			camera.updateMatrixWorld();
			const hs = handleScale(doc.camera.zoom);
			for (const h of handles) h.scale.setScalar(hs);
			for (const o of blockObjs.values()) {
				if (o.sil) updateSilhouette(o.sil);
				if (o.drop === undefined) continue;
				const t = (now - o.drop) / DROP_MS;
				if (t >= 1) {
					o.group.position.z = 0;
					o.drop = undefined;
				} else {
					o.group.position.z = DROP_HEIGHT * (1 - easeOutBounce(Math.max(0, t)));
				}
			}
			if (ghostGroup.userData.sil) updateSilhouette(ghostGroup.userData.sil as Silhouette);
			for (const o of linkObjs.values()) for (const f of o.flows) updateFlow(f, now);
			renderer.render(scene, camera);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerUp);
			el.removeEventListener('pointerleave', onPointerLeave);
			el.removeEventListener('wheel', onWheel);
			el.removeEventListener('contextmenu', preventCtx);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			renderer.dispose();
			container.removeChild(el);
		};
	});
</script>

<div bind:this={container} class="scene" style:cursor></div>

<style>
	.scene {
		position: absolute;
		inset: 0;
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}
	.scene :global(canvas) {
		display: block;
	}
</style>
