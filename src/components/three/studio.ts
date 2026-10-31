import {
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { COLORS } from "./materials";
import type { Yield } from "./yield";

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

/** Resolution of the prefiltered environment (PMREMGenerator's default). */
const ENVIRONMENT_SIZE = 256;

/**
 * The parts of PMREMGenerator (three r186) that are reached into to prepare its programs.
 * Each is checked before use; without them the environment is simply built the slow way.
 */
interface PMREMInternals {
  _setSize?(size: number): void;
  _allocateTargets?(): WebGLRenderTarget;
  _blurMaterial?: ShaderMaterial | null;
  _ggxMaterial?: ShaderMaterial | null;
}

/**
 * PMREMGenerator's convolution shaders loop over a compile-time sample count (256 for the
 * GGX filter). Direct3D's compiler unrolls such loops in full, and that takes over a second
 * on a cold machine — the single largest stall in the page's start-up. Reading the same
 * count from a uniform leaves the loop rolled and the compile quick; the samples, and so the
 * result, are identical. Leaves the material alone if its source is not the one expected.
 */
function rollLoop(material: ShaderMaterial, token: string): void {
  const count = material.defines?.[token];
  const declaration = "uniform float mipInt;";
  if (typeof count !== "number" || !material.fragmentShader.includes(declaration)) return;
  const bounds = new RegExp(`\\b(uint\\(|float\\(\\s*|<\\s*)${token}\\b`, "g");
  if (!bounds.test(material.fragmentShader)) return;
  material.fragmentShader = material.fragmentShader
    .replace(declaration, `${declaration}\n\t\t\tuniform int uSampleCount;`)
    .replace(bounds, "$1uSampleCount");
  material.uniforms.uSampleCount = { value: count };
}

/**
 * Compile the environment's programs before `fromScene` needs them: the room's two (front
 * and back faces) and the generator's blur and GGX convolutions. Linking runs in parallel
 * off the main thread (compileAsync, KHR_parallel_shader_compile); the first draw of each —
 * where Direct3D finishes its compile — is then made one program per task, so the loader
 * keeps animating between them. The program cache keys on the render state at compile
 * time, so the environment's own kind of target is bound and tone mapping is off, exactly
 * as `fromScene` renders.
 */
async function precompile(renderer: WebGLRenderer, pmrem: PMREMGenerator, room: Scene, yieldNow: Yield): Promise<void> {
  const internals = pmrem as unknown as PMREMInternals;
  if (typeof internals._setSize !== "function" || typeof internals._allocateTargets !== "function") return;
  internals._setSize(ENVIRONMENT_SIZE);
  const target = internals._allocateTargets();
  if (internals._ggxMaterial) rollLoop(internals._ggxMaterial, "GGX_SAMPLES");
  if (internals._blurMaterial) rollLoop(internals._blurMaterial, "SAMPLES");

  const camera = new PerspectiveCamera();
  const plane = new PlaneGeometry(1, 1);
  const passes: Scene[] = [room];
  for (const material of [internals._blurMaterial, internals._ggxMaterial]) {
    if (!material) continue;
    const pass = new Scene();
    pass.add(new Mesh(plane, material));
    passes.push(pass);
  }

  const previousTarget = renderer.getRenderTarget();
  const previousToneMapping = renderer.toneMapping;
  const bind = () => {
    renderer.setRenderTarget(target);
    renderer.toneMapping = NoToneMapping;
  };
  const unbind = () => {
    renderer.setRenderTarget(previousTarget);
    renderer.toneMapping = previousToneMapping;
  };

  bind();
  const pending = passes.map((pass) => renderer.compileAsync(pass, camera));
  unbind();
  try {
    await Promise.all(pending);
  } catch {
    // Compilation errors surface again, properly, in fromScene.
  }
  for (const pass of passes) {
    bind();
    renderer.render(pass, camera);
    unbind();
    await yieldNow();
  }
  plane.dispose();
  target.dispose();
}

/**
 * Render the softbox room once into a prefiltered environment map. Asynchronous only so the
 * shader compilation can run in parallel (see precompile); the render itself is quick.
 */
export async function createStudioEnvironment(renderer: WebGLRenderer, yieldNow: Yield): Promise<WebGLRenderTarget> {
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
  await precompile(renderer, pmrem, room, yieldNow);
  const environment = pmrem.fromScene(room, 0.03, 0.1, 60, { size: ENVIRONMENT_SIZE });
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
