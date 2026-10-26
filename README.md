# Isograph

A 3D viewer and editor for simple primitive isometric diagrams on the web.

## Features

- **Blocks**: square footprint, grid-snapped position/size/height, four shading styles (flat,
  shaded, dither, hatch), pastel/grey palette, floor-aligned labels on any edge.
- **Planes**: coloured rugs at z=0 for grouping blocks.
- **Links**: thin lines between block centres, routed along grid lines.
- **Camera**: orthographic, rotates in 15° steps, zoom and pan.
- **Sharing**: the whole document is encoded in the URL hash, so a link is a save file.

## Controls

| Action             | Input                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Tools              | `V` select · `B` block · `P` plane · `L` link · `Esc` back to select |
| Pan                | drag empty floor, middle-drag, or space+drag                         |
| Zoom               | wheel, `+` / `-`                                                     |
| Rotate             | right-drag, alt-drag, `Q` / `E`                                      |
| Nudge selection    | arrow keys                                                           |
| Delete selection   | `Delete` / `Backspace`                                               |
| Keyboard shortcuts | `?`                                                                  |

## Run it

```bash
npm install
npm run dev
```

| Script              | What it does                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload                                                    |
| `npm run build`     | Production build via `@sveltejs/adapter-cloudflare` into `.svelte-kit/cloudflare/` |
| `npm run preview`   | Build, then serve it in the local Workers runtime (`wrangler dev`)                 |
| `npm run deploy`    | Build, then `wrangler deploy` to Cloudflare Workers                                |
| `npm run lint`      | Prettier check + ESLint                                                            |
| `npm run format`    | Prettier write                                                                     |
| `npm run biome`     | Biome format + lint (not yet enforced; see below)                                  |
| `npm run typecheck` | `svelte-check`                                                                     |
| `npm test`          | Vitest                                                                             |

npm 11 blocks dependency install scripts by default; `esbuild` and `workerd` are approved in
`package.json` so their binaries install.

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
quotes, no trailing commas), so `npm run biome` shows how far the code is from switching.
Today its lint rules pass. The only differences are formatting in Svelte markup, HTML and CSS,
where Biome's support is still experimental.

## Status

Migrated from `liquidx-isograph`, which deployed to Vercel. Works locally under
`wrangler dev`; not yet deployed — no Cloudflare account, route or domain is configured.

## Deviations from the Artifact Primer

This repo does not yet meet every convention in the
[Primer](https://github.com/arfct/ops/tree/main/primer). Each gap below is deliberate and
temporary; they are listed here so nobody has to rediscover them.

- **Prettier + ESLint instead of Biome.** The Primer asks for Biome alone
  ([standards](https://github.com/arfct/ops/blob/main/primer/standards.md#formatting--linting)),
  but Biome's Svelte support is experimental: it formats only `<script>` blocks by default, and
  its full-file mode lays markup out inconsistently. Switch once `npm run biome` is clean
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
  Until then `npm run check`, `npm run typecheck` and `npm test` are habit, not enforcement.
- **No Linear project or issues.** Work tracking lives in the `arfct` Linear workspace
  ([linear](https://github.com/arfct/ops/blob/main/primer/linear.md)); nothing has been filed
  for this project yet.
- **Not deployed yet.** `npm run deploy` exists (Cloudflare Workers, per
  [deployment](https://github.com/arfct/ops/blob/main/primer/deployment.md)), but it hasn't
  been run, and the repo isn't in the primer's deployment table.

## License

MIT — see [LICENSE](LICENSE).
