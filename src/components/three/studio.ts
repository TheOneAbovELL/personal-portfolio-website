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
 * environment, because on lacquered paint the shape of the lights *is* the picture. It is
 * lit the way cars are photographed: one large overhead softbox as the key, drawing a long
 * highlight down the spine and over the shoulders; a cool-neutral strip on the camera's side
 * as the fill, drawing the waistline; and a warm rim from behind that separates the car's
 * top line and tail from the dark. Colour comes from the car's own paint, never from the light.
 */

interface Softbox {
  position: [number, number, number];
  size: [number, number, number];
  colour: string;
  /** Radiance relative to white paper under the key. */
  power: number;
}

const SOFTBOXES: Softbox[] = [
  // Key: a large overhead bank, long axis along the car, set slightly toward the camera.
  { position: [0.3, 7, 1.6], size: [12, 0.2, 4.2], colour: COLORS.key, power: 5.2 },
  // Fill: a strip at the camera's side, just above the horizon — the shoulder line.
  { position: [3, 2.1, 9], size: [13, 0.5, 0.2], colour: COLORS.fill, power: 2.4 },
  // A softer fill ahead of the car so the nose and front wing are not lost.
  { position: [10, 3.2, 3], size: [0.2, 3, 5.5], colour: COLORS.fill, power: 0.55 },
  // Far wall wash, low: what every upward-facing surface mirrors at this camera height.
  // Kept neutral and dim, so the tops get a soft sheen and never a slab of light.
  { position: [-2, 1.6, -11], size: [18, 3.2, 0.2], colour: "#b4b8bc", power: 0.2 },
  // A broad, dim scrim on the camera's side and a bounce card on the studio floor in front of
  // the car: flat panels facing the lens (the endplates) mirror these, and pick up a soft
  // graded sheen instead of reading as flat colour.
  { position: [3, 3.2, 12], size: [18, 5, 0.2], colour: COLORS.fill, power: 0.3 },
  { position: [-5, -1.6, 9], size: [12, 0.1, 7], colour: COLORS.fill, power: 0.55 },
  // Warm rim: a tall strip behind and above the car's far shoulder, and a lower one behind
  // its tail. Only rear-facing and top edges see them: one warm line along the engine cover,
  // the fin and the rear wing.
  { position: [-3.5, 3.4, -8.5], size: [6, 0.7, 0.2], colour: COLORS.warm, power: 2 },
  { position: [-10, 1.8, -2.5], size: [0.2, 2.4, 4.5], colour: COLORS.warm, power: 1.2 },
  // The lit patch of floor under the car, seen by the bodywork's undersides.
  { position: [0, -0.4, 0.6], size: [9, 0.1, 5], colour: "#86888a", power: 0.1 },
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

  // Walls: a dark room, but not a void — black lacquer needs something to be black against.
  const walls = add({ position: [0, 6, 0], size: [40, 24, 40], colour: "#58595b", power: 0.3 });
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
  const key = new DirectionalLight(COLORS.key, 0);
  key.position.set(3, 8, 5);
  const fill = new DirectionalLight(COLORS.fill, 0);
  fill.position.set(4, 1.6, 9);
  // The rim comes from behind along the car's length, not across it: from across, every
  // horizontal surface would throw it straight back at the camera as a sheet of light.
  const rim = new DirectionalLight(COLORS.warm, 0);
  rim.position.set(-9, 3, -4);
  // Sky and floor bounce.
  const bounce = new HemisphereLight("#cdd0d3", "#232323", 0);
  scene.add(key, fill, rim, bounce);

  const rig = [
    { light: key, intensity: 1.25 },
    { light: fill, intensity: 0.35 },
    { light: rim, intensity: 0.6 },
    { light: bounce, intensity: 0.38 },
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
