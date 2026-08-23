# iso

A 3D viewer and editor for simple primitive isometric diagrams on the web.

## Run it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Biome format + lint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |

## Stack

Vanilla TypeScript with [Three.js](https://threejs.org), bundled by Vite. No UI framework —
the editor chrome is plain DOM, so the only large dependency is the renderer.

Diagrams are real 3D scenes viewed through an `OrthographicCamera` positioned along the
`(1, 1, 1)` diagonal. That is what makes the projection isometric rather than a 2D fake: the
three world axes land 120° apart on screen, but the scene underneath stays a normal Three.js
scene graph, so unlocking the camera, lighting a scene, or exporting glTF stay open later.

`src/scene.ts` owns the camera and stage; `src/main.ts` binds them to the canvas and the
resize loop. Resizing widens the frustum rather than scaling it, so window shape never
changes how large a diagram reads.

## Status

Scaffold only. The app renders an empty ground grid through the isometric camera — enough to
prove the toolchain and pin down the projection. No primitives, no editing, no persistence yet.

## Deviations from the Artifact Primer

This repo does not yet meet every convention in the
[Primer](https://github.com/arfct/ops/tree/main/primer). Each gap below is deliberate and
temporary; they are listed here so nobody has to rediscover them.

- **No remote, no PRs.** The Primer requires branching off `main` with Linear-derived branch
  names and landing every change through a PR
  ([standards](https://github.com/arfct/ops/blob/main/primer/standards.md#commits--branches),
  [collaboration](https://github.com/arfct/ops/blob/main/primer/collaboration.md)). This repo
  is local-only for now, so there is nowhere to open a PR and the scaffold landed directly on
  `main`. Adopt the branch-and-PR flow as soon as a remote exists.
- **No GitHub repo description or homepage URL.** Required by
  [repo hygiene](https://github.com/arfct/ops/blob/main/primer/standards.md#repo-hygiene),
  and blocked on the same missing remote.
- **No CI.** The Primer expects `biome check` to run as its own CI step, and warns that a repo
  without it "drifts silently"
  ([standards](https://github.com/arfct/ops/blob/main/primer/standards.md#formatting--linting)).
  Until then `npm run check`, `npm run typecheck` and `npm test` are habit, not enforcement.
- **No Linear project or issues.** Work tracking lives in the `arfct` Linear workspace
  ([linear](https://github.com/arfct/ops/blob/main/primer/linear.md)); nothing has been filed
  for this project yet.
- **No deployment target.** No hosting, domain, or `npm run deploy`, so nothing in
  [deployment](https://github.com/arfct/ops/blob/main/primer/deployment.md) applies yet.

## License

MIT — see [LICENSE](LICENSE).
