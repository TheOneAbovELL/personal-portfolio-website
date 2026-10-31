import {
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { COLORS } from "./materials";

/**
 * The studio: what the car reflects, and what lights it.
 *
 * Reflections come from a small procedural room of softboxes rather than a generic
 * environment, because on glossy paint the shape of the lights *is* the picture: one long
 * overhead bank draws the highlight down the spine, a strip at the camera's side draws the
 * shoulder line, and coloured sources behind the car — teal on one side, red low ahead and high
 * behind on the other — are where the palette comes from. Apart from a few red livery panels, the car is never painted in colour.
 */

interface Softbox {
  position: [number, number, number];
  size: [number, number, number];
  colour: string;
  /** Radiance relative to white paper under the key. */
  power: number;
}

const KEY_COLOUR = "#eef3ff";

const SOFTBOXES: Softbox[] = [
  // Overhead bank, long axis along the car, set slightly toward the camera.
  { position: [0.4, 7, 1.8], size: [11, 0.2, 3], colour: KEY_COLOUR, power: 6 },
  // Strip at the camera's side, just above the horizon: the shoulder highlight.
  { position: [3, 2.2, 9], size: [12, 0.45, 0.2], colour: KEY_COLOUR, power: 3 },
  // Fill ahead of the car so the nose and wing are not lost.
  { position: [10, 3.4, 3], size: [0.2, 3, 5], colour: "#dfe8f2", power: 0.7 },
  // Far wall wash, low: what every upward-facing surface mirrors at this camera height.
  // Kept neutral and dim, so the tops of the car get a soft sheen and never a slab of colour.
  { position: [-2, 1.6, -11], size: [18, 3.2, 0.2], colour: "#aebccb", power: 0.3 },
  // Teal rim: behind the car. Only rear-facing shoulders can see it.
  { position: [-10, 1.9, -2.5], size: [0.2, 2.6, 4.5], colour: COLORS.data, power: 3 },
  // Red kicker: low, far side, ahead of the car. Only leading edges can see it.
  { position: [7.5, 0.8, -6], size: [3.4, 0.7, 0.2], colour: COLORS.perf, power: 2.8 },
  // Red rim: a tall strip high behind the car's far shoulder. It draws one warm line along the
  // top of the engine cover and the wing — the livery's colour, carried by light.
  { position: [-3.5, 3.6, -8.5], size: [5, 0.6, 0.2], colour: COLORS.perf, power: 1.8 },
  // The lit patch of floor under the car, seen by the bodywork's undersides.
  { position: [0, -0.4, 0.6], size: [9, 0.1, 5], colour: "#7f8a92", power: 0.1 },
];

/** Render the softbox room once into a prefiltered environment map. */
export function createStudioEnvironment(renderer: WebGLRenderer): WebGLRenderTarget {
  const room = new Scene();
  const unit = new BoxGeometry();
  const materials: MeshBasicMaterial[] = [];
  const add = (softbox: Softbox) => {
    const material = new MeshBasicMaterial({ color: new Color(softbox.colour).multiplyScalar(softbox.power) });
    materials.push(material);
    const mesh = new Mesh(unit, material);
    mesh.position.set(...softbox.position);
    mesh.scale.set(...softbox.size);
    room.add(mesh);
    return mesh;
  };

  // Walls: a dark room, but not a void — graphite paint needs something to be graphite against.
  const walls = add({ position: [0, 6, 0], size: [40, 24, 40], colour: "#5a6672", power: 0.45 });
  walls.material.side = BackSide;
  for (const softbox of SOFTBOXES) add(softbox);

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.03, 0.1, 60);
  pmrem.dispose();
  unit.dispose();
  for (const material of materials) material.dispose();
  return environment;
}

export interface StudioLights {
  /** Scale every light together: 0 in the line drawing, 1 fully lit. */
  setLevel(level: number): void;
  /**
   * Flip the rig about the floor plane (or back). The reflection pass renders the car
   * mirrored; its lighting only stays correct if the lights are mirrored with it.
   */
  mirror(): void;
}

/**
 * Direct lights matching the softboxes, for the surfaces that do not live on reflections:
 * rubber and bare carbon take their form from these.
 */
export function createStudioLights(scene: Scene): StudioLights {
  const key = new DirectionalLight(KEY_COLOUR, 0);
  key.position.set(3.5, 7.5, 6);
  // The rim comes from behind along the car's length, not across it: from across, every
  // horizontal surface would throw it straight back at the camera as a sheet of colour.
  const rim = new DirectionalLight(COLORS.data, 0);
  rim.position.set(-9, 2.4, -1.6);
  const kicker = new DirectionalLight(COLORS.perf, 0);
  kicker.position.set(7, 0.9, -5.5);
  // Warm rim from high behind the far side: separates the car's top line from the dark.
  const warmRim = new DirectionalLight("#ff3b44", 0);
  warmRim.position.set(-1.5, 0.9, -8);
  // Sky and floor bounce.
  const bounce = new HemisphereLight("#a9bccb", "#242a2f", 0);
  scene.add(key, rim, kicker, warmRim, bounce);

  const rig = [
    { light: key, intensity: 1.15 },
    { light: rim, intensity: 1.2 },
    { light: kicker, intensity: 0.85 },
    { light: warmRim, intensity: 0.12 },
    { light: bounce, intensity: 0.4 },
  ];

  return {
    setLevel(level) {
      for (const { light, intensity } of rig) light.intensity = intensity * level;
    },
    mirror() {
      for (const { light } of rig) light.position.y *= -1;
    },
  };
}
