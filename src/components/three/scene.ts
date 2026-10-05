import {
  ACESFilmicToneMapping,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { footprint } from "@/lib/car/footprint";
import { buildCar } from "@/lib/car/model";
import { clamp01, duration, easeInOutCubic, lerp, smoothstep } from "@/lib/motion";
import { applyPose, mixPose, POSES, TARGET, type Framing } from "./camera";
import { buildLineGeometry, buildSolidGeometries } from "./geometry";
import {
  createFloorMaterial,
  createLineMaterial,
  createSurfaceMaterials,
  disposeMaterials,
  lightSurfaces,
} from "./materials";
import { createStudioEnvironment, createStudioLights } from "./studio";
import { createShadowMap } from "./textures";

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  /** Element whose size the canvas follows and whose CSS variables define the framing. */
  stage: HTMLElement;
  /** 0 at the top of the page → 1 once the hero has scrolled away. */
  getProgress: () => number;
  /** Play the drawing → object move. Skipped if the visitor has already scrolled. */
  intro: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
}

export interface HeroScene {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  /** Render a single settled frame at a given scroll progress. Used for testing and stills. */
  renderStill: (progress: number) => void;
}

const MAX_PIXEL_RATIO = 2;
const MAX_ANISOTROPY = 8;
const ENVIRONMENT_INTENSITY = 0.9;
const EXPOSURE = 1.0;
/** The reflection is blurred before it is seen, so it is rendered at a fraction of the canvas. */
const REFLECTION_SCALE = 0.5;
/** Idle drift of the resting camera, in degrees and radians per second. Barely perceptible by design. */
const DRIFT = { azimuth: 0.55, elevation: 0.2, rate: 0.13 };

function readFraming(stage: HTMLElement): Framing {
  const style = getComputedStyle(stage);
  const read = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    cx: read("--car-cx", 0.5),
    cy: read("--car-cy", 0.5),
    span: read("--car-span", 0.6),
  };
}

/**
 * The hero scene has three states, driven by one number each:
 *
 *   drawing  — a flat side elevation in construction lines (matches the server-rendered SVG)
 *   object   — the same car, lit in a studio, seen three-quarter on
 *   traces   — the lines relaxed into straight horizontal signals
 *
 * The intro moves drawing → object. Scrolling moves object → drawing → traces.
 */
export function createHeroScene(options: HeroSceneOptions): HeroScene {
  const { canvas, stage, getProgress } = options;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const scene = new Scene();
  const camera = new PerspectiveCamera();

  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0;
  const lights = createStudioLights(scene);

  const model = buildCar();
  const anisotropy = Math.min(MAX_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
  const surfaceMaterials = createSurfaceMaterials(anisotropy);
  const surfaces = new Group();
  const solidGeometries = buildSolidGeometries(model);
  for (const [id, geometry] of solidGeometries) surfaces.add(new Mesh(geometry, surfaceMaterials[id]));

  const lineMaterial = createLineMaterial();
  const lines = new LineSegments(buildLineGeometry(model), lineMaterial);
  // The morph moves vertices in the shader, so the CPU-side bounds are not reliable.
  lines.frustumCulled = false;
  lines.renderOrder = 2;

  // The floor reflects a mirrored copy of the car. That copy is never drawn to the screen:
  // it is rendered on its own into a small mipmapped target, which the floor then reads
  // through a blur — a satin floor, not a mirror.
  const reflection = surfaces.clone();
  reflection.scale.y = -1;
  reflection.visible = false;
  const reflectionTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: true,
  });

  const shadowMap = createShadowMap(footprint());
  const floorGeometry = new PlaneGeometry(22, 16);
  const floorMaterial = createFloorMaterial(reflectionTarget.texture, shadowMap, TARGET.x);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(TARGET.x, 0, 0);
  floor.renderOrder = -1;

  scene.add(reflection, floor, surfaces, lines);

  let width = 1;
  let height = 1;
  let framing = readFraming(stage);
  let running = false;
  let progress = getProgress();
  let lastDraw: { now: number; intro: number; drift: boolean } | null = null;

  const resize = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    framing = readFraming(stage);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    reflectionTarget.setSize(Math.ceil(width * REFLECTION_SCALE), Math.ceil(height * REFLECTION_SCALE));
    renderer.getDrawingBufferSize(floorMaterial.uniforms.uResolution.value as Vector2);
    // Resizing clears the canvas; repaint if the loop is paused.
    if (!running && lastDraw) draw(lastDraw.now, lastDraw.intro, lastDraw.drift);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  // Pointer parallax — a few degrees, fine pointers only.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const onPointerMove = (event: PointerEvent) => {
    pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (finePointer) window.addEventListener("pointermove", onPointerMove, { passive: true });

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    options.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  let raf = 0;
  let last = 0;
  let introStart = -1;
  let firstFrame = true;

  /** Render the mirrored car, lit by a mirrored rig, into the reflection target. */
  function renderReflection() {
    lights.mirror();
    // Turning the environment over is the nearest a rotation gets to mirroring it.
    scene.environmentRotation.z = Math.PI;
    reflection.visible = true;
    surfaces.visible = lines.visible = floor.visible = false;

    renderer.setRenderTarget(reflectionTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    reflection.visible = false;
    surfaces.visible = lines.visible = floor.visible = true;
    scene.environmentRotation.z = 0;
    lights.mirror();
  }

  function draw(now: number, intro: number, drift: boolean) {
    lastDraw = { now, intro, drift };

    // Scroll plays the intro in reverse (object → drawing), then relaxes the lines.
    const settle = smoothstep(0, 0.55, progress);
    const depth = intro * (1 - settle);
    const morph = smoothstep(0.52, 0.96, progress);
    const opacity = 1 - smoothstep(0.84, 1, progress);
    // Surfaces light up through the middle of the move, not at its edges.
    const lit = smoothstep(0.12, 0.9, depth);

    const pose = mixPose(POSES.drawing, POSES.hero, depth);
    pose.azimuth += pointer.x * 4 * depth;
    pose.elevation -= pointer.y * 2 * depth;
    if (drift) {
      // The resting view breathes: two slow, unrelated sways, scaled away as the car flattens.
      const t = (now / 1000) * DRIFT.rate;
      pose.azimuth += Math.sin(t) * DRIFT.azimuth * depth;
      pose.elevation += Math.sin(t * 0.71 + 1.3) * DRIFT.elevation * depth;
    }
    applyPose(camera, pose, framing, width, height);

    scene.environmentIntensity = ENVIRONMENT_INTENSITY * lit;
    lights.setLevel(lit);
    lightSurfaces(surfaceMaterials, lit);
    floorMaterial.uniforms.uLit.value = lit;

    const solid = morph < 0.001;
    const grounded = solid && lit > 0.001;
    if (grounded) renderReflection();
    surfaces.visible = solid;
    floor.visible = grounded;

    lineMaterial.uniforms.uMorph.value = morph;
    lineMaterial.uniforms.uLit.value = lit;
    lineMaterial.uniforms.uOpacity.value = opacity;
    lineMaterial.uniforms.uTime.value = now / 1000;
    lineMaterial.uniforms.uPulse.value = intro;

    renderer.render(scene, camera);
  }

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (introStart < 0) introStart = now;
    const intro = options.intro ? easeInOutCubic(clamp01((now - introStart) / duration.cinematic)) : 1;

    // Frame-rate independent smoothing of scroll and pointer.
    progress = lerp(progress, getProgress(), 1 - Math.exp(-dt * 7));
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 3));
    pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 3));

    draw(now, intro, true);

    if (firstFrame) {
      firstFrame = false;
      options.onFirstFrame();
    }
  };

  function renderStill(value: number) {
    progress = clamp01(value);
    draw(0, 1, false);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function dispose() {
    stop();
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    lines.geometry.dispose();
    floorGeometry.dispose();
    for (const geometry of solidGeometries.values()) geometry.dispose();
    disposeMaterials([lineMaterial, floorMaterial, ...Object.values(surfaceMaterials)]);
    shadowMap.dispose();
    reflectionTarget.dispose();
    environment.dispose();
    renderer.dispose();
  }

  return { start, stop, dispose, renderStill };
}
