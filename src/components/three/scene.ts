import {
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineSegments,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { footprint } from "@/lib/car/footprint";
import { buildCar } from "@/lib/car/model";
import { clamp01, easeInOutCubic, lerp, smoothstep } from "@/lib/motion";
import { applyPose, mixPose, POSES, TARGET, type Framing } from "./camera";
import { buildSolidGeometries, buildStreakGeometry } from "./geometry";
import {
  createFloorMaterial,
  createStreakMaterial,
  createSurfaceMaterials,
  disposeMaterials,
  lightSurfaces,
  sweep,
} from "./materials";
import { createStudioEnvironment, createStudioLights } from "./studio";
import { createShadowMap } from "./textures";

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  /** Element whose size the canvas follows and whose CSS variables define the framing. */
  stage: HTMLElement;
  /** 0 at the top of the page → 1 once the hero has scrolled away. */
  getProgress: () => number;
  /** Idle life: drift, pointer parallax, the recurring light sweep. Off for reduced motion. */
  motion: boolean;
  onContextLost: () => void;
}

export interface HeroScene {
  /**
   * Resolves once every shader is compiled. Compilation runs off the main thread where the
   * browser supports it (KHR_parallel_shader_compile); nothing is drawn before it resolves,
   * so the first frame never stalls the page.
   */
  ready: Promise<void>;
  /** Draw one settled frame now (after `ready`): the frame the page is revealed on. */
  renderNow: () => void;
  start: () => void;
  stop: () => void;
  /**
   * Frames per second while the page is still covered (the loader): the car keeps rendering
   * so it is warm when revealed, without taking frames from the loader's own animation.
   * 0 renders every frame.
   */
  setCadence: (fps: number) => void;
  /** Play the arrival: a short camera settle and the first light sweep. */
  reveal: () => void;
  dispose: () => void;
  /** Render a single settled frame at a given scroll progress. Used for testing and stills. */
  renderStill: (progress: number, sweepAt?: number) => void;
}

/** Pixel-ratio ceilings. Phones get less: their screens are dense enough that 1.5x plus MSAA is clean. */
const MAX_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO_COARSE = 1.5;
/** Most pixels the canvas may have: keeps 4K and dense laptop panels inside the frame budget. */
const MAX_PIXELS = 4.2e6;
const MAX_ANISOTROPY = 8;
const ENVIRONMENT_INTENSITY = 1;
/** Neutral tone mapping (Khronos PBR Neutral) keeps the rosso's hue: ACES pushes it to orange. */
const EXPOSURE = 1.05;
/** The reflection is blurred before it is seen, so it is rendered at a fraction of the canvas. */
const REFLECTION_SCALE = 0.5;
/** Idle drift of the resting camera, in degrees and radians per second. Barely perceptible by design. */
const DRIFT = { azimuth: 0.6, elevation: 0.22, rate: 0.13 };
/** How quickly the exit follows the scroll position (per second). Lenis already smooths the wheel. */
const FOLLOW_RATE = 9;
/**
 * The arrival: as the page is revealed the camera settles the last few degrees into place,
 * and a light passes over the bodywork. Then the light comes round again, slowly, now and then.
 */
const ARRIVAL = { ms: 1900, from: { azimuth: 40, elevation: 8.5, fov: 27 }, pullBack: 0.93 };
const SWEEP = {
  /** First pass begins this long into the arrival. */
  delay: 350,
  /** One pass, in ms. */
  ms: 2600,
  /** Then once every… */
  every: 11000,
  /** Reflection-ring angles it travels between (radians about the vertical). */
  from: -0.35,
  to: Math.PI + 0.35,
  level: 0.6,
};
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

/** Sweep level over one pass: eases in and out so the light never pops on or off. */
const passLevel = (t: number) => Math.max(0, Math.sin(Math.PI * clamp01(t))) ** 1.5;

/**
 * The hero scene: the car on a satin studio floor, lit like a photograph. Scroll drives the
 * exit (see EXIT); time drives only the idle life — drift, parallax, the light sweep.
 */
export function createHeroScene(options: HeroSceneOptions): HeroScene {
  const { canvas, stage, getProgress, motion } = options;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const scene = new Scene();
  const camera = new PerspectiveCamera();

  const environment = createStudioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  const lights = createStudioLights(scene);
  lights.setLevel(1);

  const model = buildCar();
  const anisotropy = Math.min(MAX_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
  const surfaceMaterials = createSurfaceMaterials(anisotropy);
  lightSurfaces(surfaceMaterials, 1);
  const surfaces = new Group();
  const solidGeometries = buildSolidGeometries(model);
  for (const [id, geometry] of solidGeometries) surfaces.add(new Mesh(geometry, surfaceMaterials[id]));

  const streakMaterial = createStreakMaterial();
  const streaks = new LineSegments(buildStreakGeometry(model), streakMaterial);
  // The tails are stretched in the shader, so the CPU-side bounds are not reliable.
  streaks.frustumCulled = false;
  streaks.renderOrder = 3;

  // Everything that belongs to the car moves together on the exit.
  const car = new Group();
  car.add(surfaces, streaks);

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
  floorMaterial.uniforms.uLit.value = 1;
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
  let lastDrawAt = -1;

  const resize = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    framing = readFraming(stage);
    const coarse = width < 768 || window.matchMedia("(pointer: coarse)").matches;
    const budget = Math.sqrt(MAX_PIXELS / (width * height));
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, coarse ? MAX_PIXEL_RATIO_COARSE : MAX_PIXEL_RATIO, Math.max(1, budget)),
    );
    renderer.setSize(width, height, false);
    reflectionTarget.setSize(Math.ceil(width * REFLECTION_SCALE), Math.ceil(height * REFLECTION_SCALE));
    renderer.getDrawingBufferSize(floorMaterial.uniforms.uResolution.value as Vector2);
    // Resizing clears the canvas; repaint if the loop is paused.
    if (!running && lastDrawAt >= 0) draw(lastDrawAt);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  // Compile every program up front, in parallel where supported. The shaders are the single
  // largest start-up cost (seconds, on some Windows GPUs, if compiled on first draw).
  // The reflection pass renders into a linear target without tone mapping, which needs its
  // own variant of every surface program, so it is compiled separately against that target.
  applyPose(camera, POSES.hero, framing, width, height);
  // compileAsync only visits visible objects: the streaks (hidden at rest) must be included,
  // or their program links mid-scroll, on the first frame of the exit.
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
  const finePointer = motion && window.matchMedia("(pointer: fine)").matches;
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
  let minInterval = 0;
  /** When the arrival started; -1 until revealed (the covered page shows the settled view). */
  let arrivedAt = -1;

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
  let warmed = false;

  /** Sweep position and level at `now`, from the arrival's clock. */
  function sweepAt(now: number) {
    if (arrivedAt < 0) return { angle: 0, level: 0 };
    let t = now - arrivedAt - SWEEP.delay;
    if (t < 0) return { angle: 0, level: 0 };
    if (t > SWEEP.ms) {
      if (!motion) return { angle: 0, level: 0 };
      t = (t - SWEEP.ms) % SWEEP.every;
      // Later passes are slower and softer than the first.
      const ms = SWEEP.ms * 1.4;
      if (t > ms) return { angle: 0, level: 0 };
      const k = t / ms;
      return { angle: lerp(SWEEP.from, SWEEP.to, easeInOutCubic(k)), level: SWEEP.level * 0.6 * passLevel(k) };
    }
    const k = t / SWEEP.ms;
    return { angle: lerp(SWEEP.from, SWEEP.to, easeInOutCubic(k)), level: SWEEP.level * passLevel(k) };
  }

  function draw(now: number, still = false) {
    lastDrawAt = now;

    // Exit: the camera starts to move at once, the car a beat later, and it keeps
    // accelerating: distance grows with the square of time, as it would from a standing start.
    const swing = smoothstep(0, 0.9, progress);
    const launch = smoothstep(0.08, 1, progress);
    const travel = EXIT.distance * launch * launch;
    const speed = smoothstep(0.1, 0.75, progress);

    // Arrival: 0 → 1 over ARRIVAL.ms after the reveal; settled (1) before it and on stills.
    const arrival = still || arrivedAt < 0 || !motion ? 1 : easeInOutCubic(clamp01((now - arrivedAt) / ARRIVAL.ms));

    const pose = mixPose(mixPose(ARRIVAL.from, POSES.hero, arrival), EXIT.pose, swing);
    const settled = 1 - swing;
    if (!still) {
      pose.azimuth += pointer.x * 4 * settled;
      pose.elevation -= pointer.y * 2 * settled;
      if (motion) {
        // The resting view breathes: two slow, unrelated sways.
        const t = (now / 1000) * DRIFT.rate;
        pose.azimuth += Math.sin(t) * DRIFT.azimuth * settled;
        pose.elevation += Math.sin(t * 0.71 + 1.3) * DRIFT.elevation * settled;
      }
    }
    framed.cx = framing.cx;
    framed.cy = framing.cy;
    framed.span = framing.span * lerp(ARRIVAL.pullBack, 1, arrival) * lerp(1, EXIT.pullBack, swing);
    applyPose(camera, pose, framed, width, height, travel * EXIT.follow);

    car.position.x = travel;
    reflection.position.x = travel;
    (floorMaterial.uniforms.uCar.value as Vector2).x = TARGET.x + travel;

    const light = sweepAt(now);
    sweep.uSweepAngle.value = light.angle;
    sweep.uSweepLevel.value = light.level * settled;

    renderReflection();

    streakMaterial.uniforms.uStretch.value = speed;
    streakMaterial.uniforms.uOpacity.value = smoothstep(0.02, 0.25, progress);
    // Drawn (invisibly) on the first frame too, so the program's first use — which blocks on
    // the driver — happens under the loader, not on the first frame of a scroll.
    streaks.visible = speed > 0.001 || !warmed;
    warmed = true;

    renderer.render(scene, camera);
  }

  let lastRender = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    // Frame-rate independent smoothing of scroll and pointer. Lenis has already smoothed the
    // wheel, so this only rounds off what is left (touch flicks, keyboard jumps).
    progress = lerp(progress, getProgress(), 1 - Math.exp(-dt * FOLLOW_RATE));
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 3));
    pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 3));

    if (minInterval && now - lastRender < minInterval) return;
    lastRender = now;
    draw(now);
  };

  function renderNow() {
    progress = getProgress();
    draw(performance.now());
  }

  function renderStill(value: number, sweepPhase?: number) {
    progress = clamp01(value);
    const now = performance.now();
    if (sweepPhase !== undefined) {
      // A still of the sweep: place the arrival clock so the first pass is at `sweepPhase`.
      arrivedAt = now - SWEEP.delay - SWEEP.ms * clamp01(sweepPhase);
    }
    draw(now, true);
  }

  function setCadence(fps: number) {
    minInterval = fps > 0 ? 1000 / fps - 2 : 0;
  }

  function reveal() {
    if (arrivedAt >= 0) return;
    arrivedAt = performance.now();
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
    streaks.geometry.dispose();
    floorGeometry.dispose();
    for (const geometry of solidGeometries.values()) geometry.dispose();
    disposeMaterials([streakMaterial, floorMaterial, ...Object.values(surfaceMaterials)]);
    shadowMap.dispose();
    reflectionTarget.dispose();
    environment.dispose();
    renderer.dispose();
  }

  return { ready, renderNow, start, stop, setCadence, reveal, dispose, renderStill };
}
