<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity, svelte/no-dom-manipulating --
	   The Maps/Sets here track Three.js objects and must stay non-reactive; the DOM calls mount the WebGL canvas. */
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import {
		ANGLE_STEP,
		type Block,
		clamp,
		GRID_EXTENT,
		type Link,
		MAX_EL,
		MAX_HEIGHT,
		MAX_SIZE,
		MAX_ZOOM,
		MIN_EL,
		MIN_ZOOM,
		normAngle,
		PALETTE,
		type Plane,
		type SelectionRef
	} from '$lib/model';
	import {
		addBlock,
		addLink,
		addPlane,
		deleteSelection,
		doc,
		dropQueue,
		rotateBy,
		select,
		selectedBlock,
		setTool,
		toggleHelp,
		ui,
		zoomBy
	} from '$lib/state.svelte';
	import { disposeObject, faceMaterials, INK, LABEL_FONT, labelTexture, mix } from './materials';

	let container: HTMLDivElement;
	let cursor = $derived(ui.tool === 'select' ? 'default' : 'crosshair');
	let fontGen = $state(0);

	const BASE_VIEW = 24; // world units visible vertically at zoom 1
	const DIST = 300;
	const Z_PLANE = 0.01;
	const Z_EDGE = 0.04; // block outlines sit just above the grid and plane rugs so they never z-fight
	const Z_LABEL = 0.06;
	const Z_LINK = 0.08;
	const Z_SEL = 0.1;
	const HANDLE_RADIUS = 0.075; // world units at zoom 1; scaled by 1/zoom to stay constant on screen
	const HANDLE_HIT_RADIUS = 0.25; // invisible pick target, larger than the handles so they're easy to grab
	const PYRAMID_RADIUS = 0.12; // centre to base corner
	const PYRAMID_HEIGHT = 0.15;
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

	/** A corner handle's index into CORNERS, or the centre height handle. */
	type Handle = number | 'height';

	function easeOutBounce(t: number): number {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) return n1 * (t - 1.5 / d1) ** 2 + 0.75;
		if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) ** 2 + 0.9375;
		return n1 * (t - 2.625 / d1) ** 2 + 0.984375;
	}

	function buildGrid(): THREE.Group {
		const g = new THREE.Group();
		const N = GRID_EXTENT;
		const minor: number[] = [];
		const major: number[] = [];
		const axis: number[] = [];
		for (let i = -N; i <= N; i++) {
			const target = i === 0 ? axis : i % 5 === 0 ? major : minor;
			target.push(i, -N, 0, i, N, 0, -N, i, 0, N, i, 0);
		}
		const mk = (arr: number[], color: number) => {
			const geo = new THREE.BufferGeometry();
			geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
			return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
		};
		g.add(mk(minor, 0xdedbcf), mk(major, 0xcbc8b9), mk(axis, 0xb3b0a1));
		return g;
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

	/** Grid line nearest the block's centre, so links stay on grid lines. */
	function anchor(b: Block): [number, number] {
		return [Math.round(b.x + b.size / 2), Math.round(b.y + b.size / 2)];
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
		scene.add(buildGrid());
		// Only the lit selection handles use these; everything else is MeshBasicMaterial.
		const sun = new THREE.DirectionalLight(0xffffff, 2.2);
		sun.position.set(-3, -5, 10);
		scene.add(new THREE.AmbientLight(0xffffff, 1.4), sun);

		const edgeMat = new THREE.LineBasicMaterial({ color: INK });
		const blockObjs = new Map<
			number,
			{ group: THREE.Group; mesh: THREE.Mesh; sig: string; drop?: number }
		>();
		const planeObjs = new Map<number, { group: THREE.Group; mesh: THREE.Mesh; sig: string }>();
		const linkObjs = new Map<number, { line: THREE.Line; sig: string }>();
		const selectionGroup = new THREE.Group();
		const handles: THREE.Mesh[] = [];
		const hitAreas: THREE.Mesh[] = [];
		const previewGroup = new THREE.Group();
		scene.add(selectionGroup, previewGroup);

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
			for (const o of linkObjs.values()) lines.push(o.line);
			const mh = raycaster.intersectObjects(meshes, false)[0];
			const lh = raycaster.intersectObjects(lines, false)[0];
			let best: { d: number; ref: SelectionRef } | null = null;
			if (mh) best = { d: mh.distance, ref: mh.object.userData as SelectionRef };
			if (lh && (!best || lh.distance < best.d))
				best = { d: lh.distance, ref: lh.object.userData as SelectionRef };
			return best ? { kind: best.ref.kind, id: best.ref.id } : null;
		}

		// ---------- builders ----------

		function buildBlock(b: Block) {
			const group = new THREE.Group();
			const geo = new THREE.BoxGeometry(b.size, b.size, b.height);
			const mesh = new THREE.Mesh(geo, faceMaterials(b));
			mesh.position.set(b.size / 2, b.size / 2, b.height / 2);
			mesh.userData = { kind: 'block', id: b.id };
			const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
			edges.position.copy(mesh.position);
			edges.position.z += Z_EDGE;
			group.add(mesh, edges);

			const text = b.label.trim();
			if (text) {
				const { tex, aspect } = labelTexture(text, maxAniso);
				const lh = b.labelSize;
				const lw = lh * aspect;
				const gap = 0.15 + lh / 2;
				const lm = new THREE.Mesh(
					new THREE.PlaneGeometry(lw, lh),
					new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
				);
				const s = b.size;
				switch (b.edge) {
					case 'S':
						lm.position.set(s / 2, -gap, Z_LABEL);
						break;
					case 'N':
						lm.position.set(s / 2, s + gap, Z_LABEL);
						lm.rotation.z = Math.PI;
						break;
					case 'E':
						lm.position.set(s + gap, s / 2, Z_LABEL);
						lm.rotation.z = Math.PI / 2;
						break;
					case 'W':
						lm.position.set(-gap, s / 2, Z_LABEL);
						lm.rotation.z = -Math.PI / 2;
						break;
				}
				group.add(lm);
			}
			group.position.set(b.x, b.y, 0);
			return { group, mesh };
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
			group.position.set(p.x, p.y, 0);
			return { group, mesh };
		}

		function buildLink(l: Link, a: Block, b: Block, selected: boolean) {
			const [ax, ay] = anchor(a);
			const [bx, by] = anchor(b);
			const pts = [
				new THREE.Vector3(ax, ay, Z_LINK),
				new THREE.Vector3(bx, ay, Z_LINK),
				new THREE.Vector3(bx, by, Z_LINK)
			];
			const geo = new THREE.BufferGeometry().setFromPoints(pts);
			const mat = selected
				? new THREE.LineDashedMaterial({ color: INK, dashSize: 0.2, gapSize: 0.12 })
				: new THREE.LineBasicMaterial({ color: INK });
			const line = new THREE.Line(geo, mat);
			if (selected) line.computeLineDistances();
			line.userData = { kind: 'link', id: l.id };
			return line;
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
			const seen = new Set<number>();
			for (const p of doc.planes) {
				const sig = JSON.stringify(p);
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
			const seen = new Set<number>();
			const sel = ui.selection;
			for (const l of doc.links) {
				const a = doc.blocks.find((b) => b.id === l.a);
				const b = doc.blocks.find((bb) => bb.id === l.b);
				if (!a || !b) continue;
				const selected = sel?.kind === 'link' && sel.id === l.id;
				const sig = JSON.stringify([l, anchor(a), anchor(b), selected]);
				seen.add(l.id);
				const prev = linkObjs.get(l.id);
				if (prev && prev.sig === sig) continue;
				if (prev) {
					scene.remove(prev.line);
					disposeObject(prev.line);
				}
				const line = buildLink(l, a, b, selected);
				linkObjs.set(l.id, { line, sig });
				scene.add(line);
			}
			for (const [id, o] of linkObjs) {
				if (seen.has(id)) continue;
				scene.remove(o.line);
				disposeObject(o.line);
				linkObjs.delete(id);
			}
		});

		/** Drawn over the block so the handles stay grabbable from any angle. */
		function overlay(mesh: THREE.Object3D, order: number, handle: Handle) {
			mesh.renderOrder = order;
			mesh.scale.setScalar(1 / doc.camera.zoom);
			const hit = new THREE.Mesh(
				new THREE.SphereGeometry(HANDLE_HIT_RADIUS, 12, 8),
				new THREE.MeshBasicMaterial()
			);
			hit.visible = false; // raycasting ignores visibility, so this still picks
			hit.userData = { handle };
			mesh.add(hit);
			hitAreas.push(hit);
			handles.push(mesh as THREE.Mesh);
			selectionGroup.add(mesh);
		}

		function buildHandle(x: number, y: number, z: number, corner: number) {
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
						CORNERS.forEach(([fx, fy], i) => {
							buildHandle(b.x + fx * b.size, b.y + fy * b.size, b.height, i);
						});
						buildHeightHandle(b.x + b.size / 2, b.y + b.size / 2, b.height);
					}
				}
			} else if (s?.kind === 'plane') {
				const p = doc.planes.find((x) => x.id === s.id);
				if (p)
					selectionGroup.add(ring(p.x - pad, p.y - pad, p.x + p.w + pad, p.y + p.h + pad, Z_SEL));
			}
			if (ui.linkFrom != null) {
				const b = doc.blocks.find((x) => x.id === ui.linkFrom);
				if (b)
					selectionGroup.add(
						ring(b.x - pad, b.y - pad, b.x + b.size + pad, b.y + b.size + pad, Z_SEL)
					);
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
				case 'block': {
					if (hit?.kind === 'block') {
						select(hit);
						break;
					}
					if (fh) addBlock(Math.floor(fh.x), Math.floor(fh.y));
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
							h: sb.height
						};
						cursor = 'grabbing';
						break;
					}
					if (hit) {
						select(hit);
						if (hit.kind === 'block' && fh) {
							const b = doc.blocks.find((x) => x.id === hit.id);
							if (b) drag = { kind: 'move', sel: hit, offX: fh.x - b.x, offY: fh.y - b.y };
						} else if (hit.kind === 'plane' && fh) {
							const p = doc.planes.find((x) => x.id === hit.id);
							if (p) drag = { kind: 'move', sel: hit, offX: fh.x - p.x, offY: fh.y - p.y };
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
			}
			drag = null;
			updatePreview();
			cursor = ui.tool === 'select' ? 'default' : 'crosshair';
			if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
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
			if (e.metaKey || e.ctrlKey) return;
			switch (e.key) {
				case ' ':
					spaceDown = true;
					if (!drag) cursor = 'grab';
					e.preventDefault();
					break;
				case 'Delete':
				case 'Backspace':
					deleteSelection();
					e.preventDefault();
					break;
				case 'Escape':
					if (ui.help) {
						toggleHelp(false);
						break;
					}
					setTool('select');
					select(null);
					break;
				case '?':
					toggleHelp();
					break;
				case 'v':
					setTool('select');
					break;
				case 'b':
					setTool('block');
					break;
				case 'p':
					setTool('plane');
					break;
				case 'l':
					setTool('link');
					break;
				case 'q':
					rotateBy(1);
					break;
				case 'e':
					rotateBy(-1);
					break;
				case '=':
				case '+':
					zoomBy(1.25);
					break;
				case '-':
					zoomBy(0.8);
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
			for (const h of handles) h.scale.setScalar(1 / doc.camera.zoom);
			for (const o of blockObjs.values()) {
				if (o.drop === undefined) continue;
				const t = (now - o.drop) / DROP_MS;
				if (t >= 1) {
					o.group.position.z = 0;
					o.drop = undefined;
				} else {
					o.group.position.z = DROP_HEIGHT * (1 - easeOutBounce(Math.max(0, t)));
				}
			}
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
