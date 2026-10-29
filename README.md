# Isograph

A 3D viewer and editor for simple primitive isometric diagrams on the web.

## Features

- **Blocks**: square footprint, grid-snapped position/size/height, four shapes (box, cylinder, sphere, pyramid), four shading styles (flat, shaded, dither, hatch) with six hatch patterns at three densities, pastel/grey palette, floor-aligned labels on any edge.
- **Planes**: coloured rugs at z=0 for grouping blocks, resizable from their corners, with an optional label along any edge.
- **Links**: lines between blocks, anchored at a block's centre, an edge or a corner. Elbow (grid-routed), straight or curved; solid, dashed or dotted; optional label, one-way or two-way arrowheads, and an animated flow of dots along the line.
- **Multi-select**: shift-click or shift-drag a box to build a selection, drag to move it together, and edit shared attributes (colour, shading, hatch, line style…) across items of the same kind at once.
- **Camera**: orthographic, rotates in 15° steps, zoom and pan over an endless grid.
- **Sharing**: the whole document is encoded in the URL hash, so a link is a save file.
- **Export**: download the scene as a readable JSON file to use elsewhere (see [Export format](#export-format)).

## Controls

| Action             | Input                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools              | `V` select · `P` plane · `L` link · `Esc` back to select                                                                                                 |
| Shapes             | `B` box · `C` cylinder · `S` sphere · `Y` pyramid                                                                                                        |
| Adding             | dropping a shape or plane returns to select; hold `Shift` to add more                                                                                    |
| Undo / redo        | `Cmd`/`Ctrl` + `Z` / `Shift` + `Z`                                                                                                                       |
| Multi-select       | `Shift`-click adds or removes an item; `Shift`-drag empty floor to box-select · `Cmd`/`Ctrl` + `A` selects all · drag any selected item to move them all |
| Resize             | drag a corner handle of a selected block or plane                                                                                                        |
| Copy / paste       | `Cmd`/`Ctrl` + `C` / `V` duplicates the selected blocks and planes                                                                                       |
| Pan                | drag empty floor, middle-drag, or space+drag                                                                                                             |
| Zoom               | wheel, `+` / `-`                                                                                                                                         |
| Rotate             | right-drag, alt-drag, `Q` / `E`                                                                                                                          |
| Nudge selection    | arrow keys                                                                                                                                               |
| Delete selection   | `Delete` / `Backspace`                                                                                                                                   |
| Keyboard shortcuts | `?`                                                                                                                                                      |

## Export format

**Export** in the toolbar downloads `isograph.json`. The URL hash is packed for length; this file
is meant for other programs to read, so fields are named, enums are strings and colours are
palette names. It is written by `src/lib/export.ts`.

```json
{
	"format": "isograph",
	"version": 1,
	"camera": { "az": 45, "el": 30, "zoom": 1, "tx": 0, "ty": 0 },
	"palette": { "white": "#ffffff", "sky": "#c7d9e7", "…": "…" },
	"blocks": [
		{
			"id": 1,
			"shape": "cylinder",
			"x": 0,
			"y": 0,
			"size": 2,
			"height": 3,
			"color": "sky",
			"shade": "hatch",
			"hatch": "cross",
			"density": "coarse",
			"label": { "text": "api", "edge": "E", "size": 0.7 }
		}
	],
	"planes": [
		{
			"id": 3,
			"x": -1,
			"y": -1,
			"w": 8,
			"h": 4,
			"color": "sage",
			"label": { "text": "zone", "edge": "N", "size": 1 }
		}
	],
	"links": [
		{
			"id": 4,
			"from": { "block": 1, "anchor": "NE" },
			"to": { "block": 2, "anchor": "W" },
			"style": "curve",
			"bend": "x",
			"dash": "dotted",
			"direction": "forward",
			"animated": true,
			"label": { "text": "calls", "size": 0.5 }
		}
	]
}
```

**Coordinates.** Everything sits on an integer grid in grid units. `x` grows east, `y` grows
north and height grows up from the floor at 0. A shape or plane's `x`, `y` is its south-west
corner.

**Top level.** `format` is always `"isograph"`. `version` is bumped only when a change would
break a reader of the previous version; new fields may be added without a bump, so ignore
fields you don't know. `palette` maps every colour name used in the file to its hex value.

**`camera`.** Orthographic, looking at the floor point (`tx`, `ty`). `az` is the compass
direction the camera sits in, in degrees: 0 puts it south of the target, looking north, and 90
puts it east, so it increases counter-clockwise seen from above. `el` is degrees above the floor (15–75). Both move in 15°
steps. `zoom` is a scale factor; 1 is the default.

**`blocks`.** Shapes on the floor.

| Field     | Values                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | Integer, unique across blocks, planes and links                                                                                        |
| `shape`   | `box`, `cylinder`, `sphere`, `pyramid`                                                                                                 |
| `x`, `y`  | South-west corner of the footprint                                                                                                     |
| `size`    | Footprint is `size` × `size` cells (1–12)                                                                                              |
| `height`  | Height as drawn, 1–24. A sphere is always as tall as its `size`                                                                        |
| `color`   | Palette name                                                                                                                           |
| `shade`   | `flat`, `shaded`, `dither`, `hatch`                                                                                                    |
| `hatch`   | `diagonal`, `backslash`, `cross`, `horizontal`, `vertical`, `grid`; only drawn when `shade` is `hatch`, but always present             |
| `density` | `fine`, `medium`, `coarse`; the hatch spacing, same rule as `hatch`                                                                    |
| `label`   | `null`, or `{ text, edge, size }`: text laid flat on the floor along `edge` (`N`, `E`, `S`, `W`), `size` the text height in grid units |

**`planes`.** Flat coloured rectangles on the floor, drawn under blocks: `id`, `x`, `y`, `w`
(east–west extent), `h` (north–south extent), `color`, and a `label` like a block's.

**`links`.** Lines between two blocks.

| Field       | Values                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`/`to` | `{ block, anchor }`: a block `id`, and where on it the line attaches: `C` (centre), an edge midpoint `N` `E` `S` `W`, or a corner `NE` `SE` `SW` `NW` |
| `style`     | `elbow` (right-angled, along grid lines), `straight`, `curve`                                                                                         |
| `bend`      | `x` or `y`: the axis an elbow travels along first                                                                                                     |
| `dash`      | `solid`, `dashed`, `dotted`                                                                                                                           |
| `direction` | `none`, `forward` (arrowhead at `to`), `both`                                                                                                         |
| `animated`  | Dots flow toward each arrowhead; ignored when `direction` is `none`                                                                                   |
| `label`     | `null`, or `{ text, size }`, placed at the middle of the line                                                                                         |

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
- `src/lib/export.ts` — the JSON export (see [Export format](#export-format)).
- `src/lib/url.ts` — compact encoding of a document into the URL hash; its first character names the format, so old links keep opening when the encoding changes.
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
