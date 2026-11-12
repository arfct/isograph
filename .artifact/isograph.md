---
title: Isograph
date: 2026-08
status: released
category: product
tags:
  - web
url: https://isograph.fyi
links:
  source: https://github.com/arfct/isograph
media:
  - src: diagram.png
    caption: A web client and a backend drawn as five blocks on two planes, with labelled links between them
    alt: Isometric diagram on a cream grid with a lilac client plane holding a blue box labelled web, and a green backend plane holding an orange hatched cylinder labelled api, a pink dotted cylinder labelled db, a yellow box labelled queue and a blue box labelled worker, joined by labelled dotted and solid lines
  - src: shapes.png
    caption: All four shapes on two planes, in flat, shaded, dithered and hatched fills
    alt: Isometric scene on a cream grid with a lilac plane holding a blue box and a hatched peach cylinder, and a green plane holding a dotted green cube, a pink sphere and a yellow pyramid, joined by dotted, solid and dashed labelled links
credits:
  - liquidx
unconfirmed: [date, status]
---

Every block in an Isograph diagram has a square footprint and sits on the lines of a grid. A block is a box, a cylinder, a sphere or a pyramid, from 1 to 12 cells wide and up to 24 high, though a sphere is always as tall as it is wide. Colored planes lie on the floor under the blocks to group them. Links run between two blocks and attach at a block's center, at an edge or at a corner.

A block's fill is flat, shaded, dithered or hatched, with hatching in six patterns at three densities, and its color comes from a palette of 13: white, six greys and six pastels. A link is routed as an elbow along the grid lines, a straight line or a curve, and drawn solid, dashed or dotted. It can carry a label, an arrowhead at one end or both, and dots that flow toward each arrowhead. The camera is orthographic and rotates in 15° steps.

The whole document is encoded in the URL hash, so the link to a diagram is also its save file. The first character of the hash names the encoding, which lets a later version change the encoding and still open every link shared before it. Export downloads the scene as a JSON file with named fields, for other programs to read. The editor was migrated from the liquidx-isograph repo in October 2026.

SvelteKit, Three.js and Tailwind, on Cloudflare Workers. 2026.
