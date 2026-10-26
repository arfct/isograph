# CLAUDE.md

This repo follows the Artifact Primer: https://github.com/arfct/ops/tree/main/primer

- Standards (style, commits, branches): https://github.com/arfct/ops/blob/main/primer/standards.md
- Work tracking: Linear workspace `arfct`, team Artifact (A) — https://github.com/arfct/ops/blob/main/primer/linear.md
- Bugs: https://github.com/arfct/ops/blob/main/primer/bugs.md · Deployment: https://github.com/arfct/ops/blob/main/primer/deployment.md
- Agent conventions and boundaries: https://github.com/arfct/ops/blob/main/primer/agents.md

## This repo

**Isograph** is a 3D viewer and editor for simple primitive isometric diagrams on the web — blocks, planes and links arranged on a grid and rendered through an orthographic camera, with the document saved in the URL hash. SvelteKit (Svelte 5 runes) + Three.js + Tailwind, deployed to Cloudflare Workers via `@sveltejs/adapter-cloudflare` (`pnpm run deploy`). Run it with `pnpm install && pnpm run dev` (Node 24, pnpm 12). See the README for layout and the conventions this repo does not yet meet.
