import { GridHelper, OrthographicCamera, Scene, Vector3, type WebGLRenderer } from 'three';

/**
 * Camera position for a true isometric projection: equal distance along each axis, so the
 * three world axes project to screen at 120° apart and unit cubes read as regular hexagons.
 */
export const ISOMETRIC_DIRECTION = new Vector3(1, 1, 1).normalize();

/**
 * World-space height of the camera frustum, sized so the whole ground grid is visible at rest.
 * Zooming changes this, not the camera position.
 */
export const DEFAULT_VIEW_HEIGHT = 26;

/** Distance along ISOMETRIC_DIRECTION. Orthographic projection ignores it, but clipping doesn't. */
const CAMERA_DISTANCE = 50;

const GRID_EXTENT = 20;

export function createIsometricCamera(aspect: number, viewHeight = DEFAULT_VIEW_HEIGHT) {
  const camera = new OrthographicCamera(0, 0, 0, 0, 0.1, CAMERA_DISTANCE * 4);
  camera.position.copy(ISOMETRIC_DIRECTION).multiplyScalar(CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);
  fitCameraToViewport(camera, aspect, viewHeight);
  return camera;
}

/**
 * Resize without distorting: the frustum keeps a fixed world height and widens with the viewport,
 * so scene contents stay the same size no matter the window shape.
 */
export function fitCameraToViewport(
  camera: OrthographicCamera,
  aspect: number,
  viewHeight = DEFAULT_VIEW_HEIGHT,
) {
  const halfHeight = viewHeight / 2;
  const halfWidth = halfHeight * aspect;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

/** An empty stage: the ground grid diagrams are built on, and nothing else yet. */
export function createScene() {
  const scene = new Scene();
  scene.add(new GridHelper(GRID_EXTENT, GRID_EXTENT, 0x999999, 0xcccccc));
  return scene;
}

export function createViewer(renderer: WebGLRenderer, canvas: HTMLCanvasElement) {
  const scene = createScene();
  const camera = createIsometricCamera(canvas.clientWidth / canvas.clientHeight);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    fitCameraToViewport(camera, clientWidth / clientHeight);
  };

  const render = () => renderer.render(scene, camera);

  resize();
  return { scene, camera, resize, render };
}
