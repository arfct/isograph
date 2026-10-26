# Isograph

A 3D viewer and editor for simple primitive isometric diagrams on the web.

## Features

- **Blocks**: square footprint, grid-snapped position/size/height, four shapes (box, cylinder, sphere, pyramid), four shading styles (flat, shaded, dither, hatch) with six hatch patterns at three densities, pastel/grey palette, floor-aligned labels on any edge.
- **Planes**: coloured rugs at z=0 for grouping blocks, with an optional label along any edge.
- **Links**: lines between blocks, anchored at a block's centre, an edge or a corner. Elbow (grid-routed), straight or curved; solid, dashed or dotted; optional label, one-way or two-way arrowheads, and an animated flow of dots along the line.
- **Camera**: orthographic, rotates in 15° steps, zoom and pan over an endless grid.
- **Sharing**: the whole document is encoded in the URL hash, so a link is a save file.

## Controls

| Action             | Input                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Tools              | `V` select · `P` plane · `L` link · `Esc` back to select              |
| Shapes             | `B` box · `C` cylinder · `S` sphere · `Y` pyramid                     |
| Adding             | dropping a shape or plane returns to select; hold `Shift` to add more |
| Undo / redo        | `Cmd`/`Ctrl` + `Z` / `Shift` + `Z`                                    |
| Copy / paste       | `Cmd`/`Ctrl` + `C` / `V` duplicates the selected block or plane       |
| Pan                | drag empty floor, middle-drag, or space+drag                          |
| Zoom               | wheel, `+` / `-`                                                      |
| Rotate             | right-drag, alt-drag, `Q` / `E`                                       |
| Nudge selection    | arrow keys                                                            |
| Delete selection   | `Delete` / `Backspace`                                                |
| Keyboard shortcuts | `?`                                                                   |

## Run it

```bash
pnpm install
pnpm run dev
```

| Script               | What it does                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `pnpm run dev`       | Vite dev server with hot reload                                                    |
| `pnpm run build`     | Production build via `@sveltejs/adapter-cloudflare` into `.svelte-kit/cloudflare/` |
| `pnpm run preview`   | Build, then serve it in the local Workers runtime (`wrangler dev`)                 |
| `pnpm run deploy`    | Build, then `wrangler deploy` to Cloudflare Workers                                |
| `pnpm run lint`      | Prettier check + ESLint                                                            |
| `pnpm run format`    | Prettier write                                                                     |
| `pnpm run biome`     | Biome format + lint (not yet enforced; see below)                                  |
| `pnpm run typecheck` | `svelte-check`                                                                     |
| `pnpm test`          | Vitest                                                                             |

`package.json` pins the toolchain in `devEngines`: Node 24 and pnpm 12. npm and pnpm both refuse
to run under anything else. pnpm only runs dependency build scripts that are listed in
`allowBuilds` in `pnpm-workspace.yaml`; `esbuild` and `workerd` are allowed there so their
binaries install.

## Stack

[SvelteKit](https://svelte.dev/docs/kit) (Svelte 5 runes) with [Three.js](https://threejs.org)
and Tailwind 4, deployed to Cloudflare Workers with static assets. The page is client-only
(`ssr = false`); the Worker just serves the SPA shell and assets.

- `src/lib/model.ts` — document types and limits.
- `src/lib/state.svelte.ts` — the reactive document and editor state, and every mutation.
- `src/lib/url.ts` — compact encoding of a document into the URL hash.
- `src/lib/scene/` — the Three.js scene, picking, dragging, and procedural materials.
- `src/lib/ui/` — the toolbar, inspector, camera bar and help pane.

SvelteKit config lives in `vite.config.ts` (passed to the `sveltekit()` plugin), not a
separate `svelte.config.js`.

Formatting and linting use Prettier + ESLint (the SvelteKit defaults), not Biome. This departs
from the Primer; see below. `biome.json` is kept with the same style as Prettier (tabs, single
quotes, no trailing commas), so `pnpm run biome` shows how far the code is from switching.
Most of what it reports is formatting in Svelte markup, HTML and CSS, where Biome's support is
still experimental, plus a handful of lint findings in code kept verbatim from isograph.

## Status

Migrated from `liquidx-isograph`, which deployed to Vercel. Deployed with `pnpm run deploy` to
the `isograph` Worker on the Artifact Cloudflare account (`account_id` is pinned in
`wrangler.jsonc`), served at <https://isograph.fyi> (a Workers custom domain, so Cloudflare
manages its DNS record and certificate) and still at <https://isograph.arfct.workers.dev>.
`www.isograph.fyi` 301s to the bare domain through a Redirect Rule on the `isograph.fyi` zone,
which is configured in the dashboard, not in this repo.

## Deviations from the Artifact Primer

This repo does not yet meet every convention in the
[Primer](https://github.com/arfct/ops/tree/main/primer). Each gap below is deliberate and
temporary; they are listed here so nobody has to rediscover them.

- **Prettier + ESLint instead of Biome.** The Primer asks for Biome alone
  ([standards](https://github.com/arfct/ops/blob/main/primer/standards.md#formatting--linting)),
  but Biome's Svelte support is experimental: it formats only `<script>` blocks by default, and
  its full-file mode lays markup out inconsistently. Switch once `pnpm run biome` is clean
  under `biome check --write` without hand fixes.
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
  Until then `pnpm run lint`, `pnpm run typecheck` and `pnpm test` are habit, not enforcement.
- **No Linear project or issues.** Work tracking lives in the `arfct` Linear workspace
  ([linear](https://github.com/arfct/ops/blob/main/primer/linear.md)); nothing has been filed
  for this project yet.
- **Deploys from a laptop, no CI gate.** `pnpm run deploy` ships whatever is checked out; there
  is no GitHub Actions run to check first
  ([deployment](https://github.com/arfct/ops/blob/main/primer/deployment.md#dont-deploy-past-a-red-ci)),
  so run `pnpm test` and `pnpm run typecheck` before deploying. The Worker isn't yet listed in
  `arfct/internal`'s `deployments.md`.

## License

MIT — see [LICENSE](LICENSE).
