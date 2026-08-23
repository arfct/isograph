import { WebGLRenderer } from 'three';
import { createViewer } from './scene';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('Missing #stage canvas');

const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
const viewer = createViewer(renderer, canvas);

window.addEventListener('resize', () => {
  viewer.resize();
  viewer.render();
});

viewer.render();
