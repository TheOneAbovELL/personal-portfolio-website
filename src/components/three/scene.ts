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
import { buildLineGeometry, buildSolidGeometries, buildStreakGeometry } from "./geometry";
import {
  createFloorMaterial,
  createLineMaterial,
  createStreakMaterial,
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
  /**
   * Resolves once every shader is compiled. Compilation runs off the main thread where the
   * browser supports it (KHR_parallel_shader_compile); nothing is drawn before it resolves,
   * so the first frame never stalls the page.
   */
  ready: Promise<void>;
  start: () => void;
  stop: () => void;
  dispose: () => void;
  /** Render a single settled frame at a given scroll progress. Used for testing and stills. */
  renderStill: (progress: number) => void;
}

/** Pixel-ratio ceilings. Phones get less: their screens are dense enough that 1.5x plus MSAA is clean. */
const MAX_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO_COARSE = 1.5;
const MAX_ANISOTROPY = 8;
const ENVIRONMENT_INTENSITY = 0.9;
const EXPOSURE = 1.0;
/** The reflection is blurred before it is seen, so it is rendered at a fraction of the canvas. */
const REFLECTION_SCALE = 0.5;
/** Idle drift of the resting camera, in degrees and radians per second. Barely perceptible by design. */
const DRIFT = { azimuth: 0.55, elevation: 0.2, rate: 0.13 };
/**
 * The exit. As the hero scrolls away the car pulls away: it accelerates forward out of frame,
 * trailing speed streaks drawn from its own lines, while the camera swings lower and wider and
 * lags behind, as a trackside camera does. All of it is a pure function of scroll progress, so
 * it plays backward exactly as it plays forward.
 */
const EXIT = {
  /** Metres travelled by the time the hero has gone. */
  distance: 7.5,
  /** How far the camera's aim follows the car, as a fraction of the distance it has travelled. */
  follow: 0.22,
  /** Where the camera ends up. */
  pose: { azimuth: 20, elevation: 5.5, fov: 22 },
  /** Fraction of the resting framing span the car shrinks to as the camera pulls back. */
  pullBack: 0.86,
};

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
 * The hero scene has two moves, driven by one number each:
 *
 *   intro  drawing → object: the flat side elevation in construction lines (matching the
 *          server-rendered SVG) gains perspective and light, and becomes the car in a studio
 *   exit   object → gone: scrolling, the car accelerates out of frame (see EXIT)
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
  lines.renderOrder = 2;

  const streakMaterial = createStreakMaterial();
  const streaks = new LineSegments(buildStreakGeometry(model), streakMaterial);
  // The tails are stretched in the shader, so the CPU-side bounds are not reliable.
  streaks.frustumCulled = false;
  streaks.renderOrder = 3;

  // Everything that belongs to the car moves together on the exit.
  const car = new Group();
  car.add(surfaces, lines, streaks);

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

  scene.add(reflection, floor, car);

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
    const coarse = width < 768 || window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? MAX_PIXEL_RATIO_COARSE : MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    reflectionTarget.setSize(Math.ceil(width * REFLECTION_SCALE), Math.ceil(height * REFLECTION_SCALE));
    renderer.getDrawingBufferSize(floorMaterial.uniforms.uResolution.value as Vector2);
    // Resizing clears the canvas; repaint if the loop is paused.
    if (!running && lastDraw) draw(lastDraw.now, lastDraw.intro, lastDraw.drift);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  // Compile every program up front, in parallel where supported. The shaders are the single
  // largest start-up cost (seconds, on some Windows GPUs, if compiled on first draw).
  // The reflection pass renders into a linear target without tone mapping, which needs its
  // own variant of every surface program, so it is compiled separately against that target.
  applyPose(camera, POSES.hero, framing, width, height);
  streaks.visible = true;
  renderer.setRenderTarget(reflectionTarget);
  reflection.visible = true;
  const reflectionReady = renderer.compileAsync(reflection, camera, scene);
  reflection.visible = false;
  renderer.setRenderTarget(null);
  const ready = Promise.all([reflectionReady, renderer.compileAsync(scene, camera)])
    .catch(() => undefined)
    .then(() => undefined);

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
    car.visible = floor.visible = false;

    renderer.setRenderTarget(reflectionTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    reflection.visible = false;
    car.visible = floor.visible = true;
    scene.environmentRotation.z = 0;
    lights.mirror();
  }

  const framed: Framing = { cx: 0, cy: 0, span: 0 };

  function draw(now: number, intro: number, drift: boolean) {
    lastDraw = { now, intro, drift };

    const depth = intro;
    // Surfaces light up through the middle of the move, not at its edges.
    const lit = smoothstep(0.12, 0.9, depth);

    // Exit: the camera starts to move at once, the car a beat later, and it keeps
    // accelerating: distance grows with the square of time, as it would from a standing start.
    const swing = smoothstep(0, 0.9, progress);
    const launch = smoothstep(0.08, 1, progress);
    const travel = EXIT.distance * launch * launch;
    const speed = smoothstep(0.1, 0.75, progress);

    const pose = mixPose(mixPose(POSES.drawing, POSES.hero, depth), EXIT.pose, swing * depth);
    const settled = depth * (1 - swing);
    pose.azimuth += pointer.x * 4 * settled;
    pose.elevation -= pointer.y * 2 * settled;
    if (drift) {
      // The resting view breathes: two slow, unrelated sways, scaled away as the car flattens.
      const t = (now / 1000) * DRIFT.rate;
      pose.azimuth += Math.sin(t) * DRIFT.azimuth * settled;
      pose.elevation += Math.sin(t * 0.71 + 1.3) * DRIFT.elevation * settled;
    }
    framed.cx = framing.cx;
    framed.cy = framing.cy;
    framed.span = framing.span * lerp(1, EXIT.pullBack, swing);
    applyPose(camera, pose, framed, width, height, travel * EXIT.follow);

    car.position.x = travel;
    reflection.position.x = travel;
    (floorMaterial.uniforms.uCar.value as Vector2).x = TARGET.x + travel;

    scene.environmentIntensity = ENVIRONMENT_INTENSITY * lit;
    lights.setLevel(lit);
    lightSurfaces(surfaceMaterials, lit);
    floorMaterial.uniforms.uLit.value = lit;

    const grounded = lit > 0.001;
    if (grounded) renderReflection();
    floor.visible = grounded;

    lineMaterial.uniforms.uLit.value = lit;
    lineMaterial.uniforms.uTime.value = now / 1000;
    // The air band belongs to the resting car; at speed the streaks take over from it.
    lineMaterial.uniforms.uPulse.value = intro * (1 - speed);
    streakMaterial.uniforms.uStretch.value = speed;
    streakMaterial.uniforms.uOpacity.value = lit * smoothstep(0.02, 0.25, progress);
    streaks.visible = speed > 0.001;

    renderer.render(scene, camera);
  }

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (introStart < 0) introStart = now;
    const intro = options.intro ? easeInOutCubic(clamp01((now - introStart) / duration.cinematic)) : 1;

    // Frame-rate independent smoothing of scroll and pointer.
    // Quick enough to track the wheel, slow enough that a notched wheel never reads as steps.
    progress = lerp(progress, getProgress(), 1 - Math.exp(-dt * 5));
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
    streaks.geometry.dispose();
    floorGeometry.dispose();
    for (const geometry of solidGeometries.values()) geometry.dispose();
    disposeMaterials([lineMaterial, streakMaterial, floorMaterial, ...Object.values(surfaceMaterials)]);
    shadowMap.dispose();
    reflectionTarget.dispose();
    environment.dispose();
    renderer.dispose();
  }

  return { ready, start, stop, dispose, renderStill };
}
