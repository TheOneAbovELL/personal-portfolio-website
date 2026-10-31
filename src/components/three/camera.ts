import { PerspectiveCamera, Vector3 } from "three";
import { CAR } from "@/lib/car/model";
import { lerp } from "@/lib/motion";

/** Camera pose in degrees. Azimuth 0 looks at the car's right side, nose to the right. */
export interface Pose {
  azimuth: number;
  elevation: number;
  fov: number;
}

/**
 * Where the car sits in the viewport. `cx`/`cy` are the fractional position of the car's
 * centre; `span` is the fraction of the viewport width the car's length occupies in side view.
 * These come from CSS custom properties so the SVG drawing and the WebGL scene always agree.
 */
export interface Framing {
  cx: number;
  cy: number;
  span: number;
}

export const POSES = {
  /** The flat engineering drawing: a long lens, dead side-on. Matches the server-rendered SVG. */
  drawing: { azimuth: 0, elevation: 0, fov: 7 },
  /** The resting hero view: three-quarter front, slightly above. */
  hero: { azimuth: 34, elevation: 11, fov: 27 },
} satisfies Record<string, Pose>;

export const mixPose = (a: Pose, b: Pose, t: number): Pose => ({
  azimuth: lerp(a.azimuth, b.azimuth, t),
  elevation: lerp(a.elevation, b.elevation, t),
  fov: lerp(a.fov, b.fov, t),
});

/** Centre of the car, matching the centre of the SVG drawing's viewBox. */
export const TARGET = new Vector3((CAR.noseX + CAR.tailX) / 2, 0.42, 0);

const RAD = Math.PI / 180;
const aim = new Vector3();

export function applyPose(
  camera: PerspectiveCamera,
  pose: Pose,
  framing: Framing,
  width: number,
  height: number,
  /** Metres to move the aim point forward along the car's axis (the exit's camera follow). */
  aimX = 0,
): void {
  const aspect = width / height;
  // Distance is derived from the lens so the car keeps the same size on screen as the
  // field of view changes — the drawing gains perspective without growing or shrinking.
  const distance = CAR.length / (framing.span * 2 * Math.tan((pose.fov * RAD) / 2) * aspect);
  const az = pose.azimuth * RAD;
  const el = pose.elevation * RAD;

  camera.fov = pose.fov;
  camera.aspect = aspect;
  camera.near = Math.max(0.1, distance - 12);
  camera.far = distance + 30;
  aim.copy(TARGET);
  aim.x += aimX;
  camera.position.set(
    aim.x + distance * Math.cos(el) * Math.sin(az),
    TARGET.y + distance * Math.sin(el),
    TARGET.z + distance * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(aim);
  // Shift the principal point so the car sits at (cx, cy) instead of the viewport centre.
  camera.setViewOffset(width, height, (0.5 - framing.cx) * width, (0.5 - framing.cy) * height, width, height);
  camera.updateProjectionMatrix();
}
