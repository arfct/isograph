import { OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createIsometricCamera,
  createScene,
  DEFAULT_VIEW_HEIGHT,
  fitCameraToViewport,
} from './scene';

describe('createIsometricCamera', () => {
  it('projects orthographically', () => {
    expect(createIsometricCamera(1)).toBeInstanceOf(OrthographicCamera);
  });

  it('looks down the isometric diagonal', () => {
    const camera = createIsometricCamera(1);
    const { x, y, z } = camera.position;
    expect(x).toBeCloseTo(y);
    expect(y).toBeCloseTo(z);
    expect(x).toBeGreaterThan(0);
  });

  it('keeps a fixed world height so contents do not scale with the window', () => {
    const camera = createIsometricCamera(16 / 9);
    expect(camera.top - camera.bottom).toBeCloseTo(DEFAULT_VIEW_HEIGHT);
    expect(camera.right - camera.left).toBeCloseTo(DEFAULT_VIEW_HEIGHT * (16 / 9));
  });

  it('widens rather than distorts when the viewport changes shape', () => {
    const camera = createIsometricCamera(1);
    fitCameraToViewport(camera, 2);
    expect(camera.top - camera.bottom).toBeCloseTo(DEFAULT_VIEW_HEIGHT);
    expect(camera.right - camera.left).toBeCloseTo(DEFAULT_VIEW_HEIGHT * 2);
  });
});

describe('createScene', () => {
  it('starts with only the ground grid', () => {
    expect(createScene().children).toHaveLength(1);
  });
});
