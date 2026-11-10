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
    caption: A diagram of a web client and a backend, with labelled links between five blocks
    alt: Isometric diagram on a cream grid with a lilac client plane holding a blue box labelled web, and a green backend plane holding an orange hatched cylinder labelled api, a pink dotted cylinder labelled db, a yellow box labelled queue and a blue box labelled worker, joined by labelled dotted and solid lines
  - src: shapes.png
    caption: Two planes holding all four shapes, with flat, shaded, dithered and hatched fills
    alt: Isometric scene on a cream grid with a lilac plane holding a blue box and a hatched peach cylinder, and a green plane holding a dotted green cube, a pink sphere and a yellow pyramid, joined by dotted, solid and dashed labelled links
credits:
  - liquidx
unconfirmed: [date]
---

Isograph is a web editor for isometric diagrams. A diagram is made of blocks, planes and links on a grid. Blocks are boxes, cylinders, spheres or pyramids, and they snap to the grid. Planes are coloured rectangles on the floor that group the blocks standing on them. Links are lines between two blocks.

A block's fill is flat, shaded, dithered or hatched, and hatching comes in six patterns at three densities. The palette has 13 colours, made up of white, six greys and six pastels. A link is routed as an elbow, a straight line or a curve, and is drawn solid, dashed or dotted. It can carry a label, arrowheads at one or both ends, and dots that move along the line. The camera is orthographic and rotates in 15° steps.

The whole document is encoded in the URL hash, so the link to a diagram is also its save file. Export downloads the scene as a JSON file for other programs to read.

Isograph was migrated in October 2026 from liquidx-isograph, a repo created in September 2026.

SvelteKit, Three.js and Tailwind, on Cloudflare Workers. 2026.
