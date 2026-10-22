/**
 * First-person view on the diorama rig: the eye sits at the followed feet + FP_EYE_HEIGHT_M, looks along the client's
 * yaw (forward = (−sin yaw, −cos yaw)) and pitch, with the wide lens; null restores the diorama pose and lens; a
 * battle shot ignores it.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { DioramaRig, FOV_V, FP_EYE_FORWARD_M, FP_EYE_HEIGHT_M, FP_FOV_V, FP_NEAR_M } from '../src/camera/rig.js';

function makeRig() {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const feet = new Vector3(10, 2, -4);
  const r = new DioramaRig(cam, { effects: () => ALL_EFFECTS, feet: (_id, out) => out.copy(feet) });
  r.follow('me');
  r.update(16);
  return { r, cam };
}

describe('first-person view', () => {
  it('puts the eye at the head and looks along the yaw / pitch with the wide lens', () => {
    const { r, cam } = makeRig();
    r.setFirstPerson({ yaw: 0, pitch: 0 });
    r.update(16);
    expect(cam.fov).toBe(FP_FOV_V);
    expect(cam.near).toBe(FP_NEAR_M);
    expect(cam.position.x).toBeCloseTo(10);
    expect(cam.position.y).toBeCloseTo(2 + FP_EYE_HEIGHT_M);
    expect(cam.position.z).toBeCloseTo(-4 - FP_EYE_FORWARD_M);
    const dir = cam.getWorldDirection(new Vector3());
    expect(dir.x).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(-1);
    r.setFirstPerson({ yaw: Math.PI / 2, pitch: 0.3 });
    r.update(16);
    cam.getWorldDirection(dir);
    expect(dir.x).toBeCloseTo(-Math.cos(0.3));
    expect(dir.y).toBeCloseTo(Math.sin(0.3));
  });

  it('null restores the diorama lens and pose; a battle shot ignores first person', () => {
    const { r, cam } = makeRig();
    r.setFirstPerson({ yaw: 0, pitch: 0 });
    r.update(16);
    r.setFirstPerson(null);
    r.update(16);
    expect(cam.fov).toBe(FOV_V);
    expect(cam.near).toBe(0.5);
    expect(cam.position.y).toBeGreaterThan(10);
    r.setFirstPerson({ yaw: 0, pitch: 0 });
    r.pushIn({ x: 10, z: -4 }, 0);
    r.update(16);
    expect(cam.fov).toBe(FOV_V);
  });
});
