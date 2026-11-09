---
title: Isograph
date: 2026-09
category: product
tags:
  - web
url: https://isograph.fyi
links:
  source: https://github.com/arfct/isograph
media:
  - src: diagram.png
    caption: A small architecture drawn on the grid, with links animated along their lines
    alt: Isometric diagram on a cream grid with a lilac client plane holding a blue box labelled web, and a green backend plane holding an orange hatched cylinder labelled api, a pink dotted cylinder labelled db, a yellow box labelled queue and a blue box labelled worker, joined by labelled dotted and solid lines
  - src: shapes.png
    caption: All four shapes on two planes, in flat, shaded, dithered and hatched fills
    alt: Isometric scene on a cream grid with a lilac plane holding a blue box and a hatched peach cylinder, and a green plane holding a dotted green cube, a pink sphere and a yellow pyramid, joined by dotted, solid and dashed labelled links
credits:
  - liquidx
unconfirmed: [date]
---

Diagrams that sit on the floor. Isograph is a page of endless isometric grid where you drop blocks, lay coloured planes under them to group what belongs together, and draw links between them. Boxes, cylinders, spheres and pyramids snap to the grid; shading is flat, shaded, dithered or hatched in six patterns at three densities in a pastel or grey palette.

The links do the explaining. They run elbow, straight or curved, solid, dashed or dotted, with a label, arrowheads in either direction and dots that flow along the line. The camera is orthographic and turns in 15° steps. The whole document is packed into the URL hash, so a link is the file. Export writes the same scene as readable JSON for other programs.

It began as liquidx-isograph, the repo this one was migrated from; the first commit there is September 2026.

SvelteKit, Three.js and Tailwind, on Cloudflare Workers.
