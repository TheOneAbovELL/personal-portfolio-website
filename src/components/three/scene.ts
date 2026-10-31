import {
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineSegments,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { footprint } from "@/lib/car/footprint";
import { buildCarAsync, CAR } from "@/lib/car/model";
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
import { yieldToMain } from "./yield";

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  /** Element whose size the canvas follows and whose CSS variables define the framing. */
  stage: HTMLElement;
  /** 0 at the top of the page → 1 once the hero has scrolled away. */
  getProgress: () => number;
  /** Idle life: drift, pointer parallax, the recurring light sweep. Off for reduced motion. */
  motion: boolean;
  onContextLost: () => void;
  /** Build milestones, in order: the geometry is complete; every shader is compiled. */
  onStage?: (stage: "geometry" | "shaders") => void;
}

export interface HeroScene {
  /** Draw one settled frame now: the frame the page is revealed on. */
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
/**
 * How quickly the exit follows the scroll position (per second). Lenis already smooths the
 * wheel (lerp 0.09, a ~175 ms time constant); this only rounds off the last of it, so it is
 * fast enough never to read as lag.
 */
const FOLLOW_RATE = 16;
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
 * The exit. As the hero scrolls away the car launches at the viewer: it pulls out of the shot
 * along its own nose, bends onto the camera's axis and comes straight down the lens — growing,
 * nose first, speed streaks drawn from its own lines — until it passes just beside the camera
 * and is gone. The camera stands its ground trackside, dropping low and widening its lens,
 * and only turns its head. All of it is a pure function of scroll progress, so it plays
 * backward exactly as it plays forward.
 */
const EXIT = {
  /** Where the camera ends up: low, wide, ahead of the car. */
  pose: { azimuth: 66, elevation: 3.2, fov: 34 },
  /** Metres to the camera's right of its own position: the car passes on that side, close. */
  pass: 1.45,
  /** Metres the car's centre carries on past the camera by the end (the fade covers the rest). */
  beyond: 1,
  /** How much the camera's aim follows the car, as a fraction of its displacement. */
  follow: 0.18,
  /** Scroll progress at which the car launches; before it only the camera moves. */
  launchAt: 0.06,
  /** Distance travelled grows with this power of time since the launch (2 = constant acceleration). */
  power: 2.3,
  /** Scroll progress over which the car is faded out as it passes the lens, so nothing is ever clipped. */
  fade: { from: 0.87, to: 0.975 },
};
/** Fraction of the rest framing span the car shrinks to as the camera widens its lens. */
const EXIT_PULL_BACK = 0.92;

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
 *
 * Building it is seconds of work on a cold machine — the environment's and the car's shaders
 * above all — and it happens under the loader, whose own animation must keep running. So the
 * build is spread over many short tasks (one part, one texture, one geometry at a time) and
 * every shader is compiled in parallel, off the main thread, before it is first used. Nothing
 * is drawn until the promise resolves, so the first frame never stalls the page.
 */
export async function createHeroScene(options: HeroSceneOptions): Promise<HeroScene> {
  const { canvas, stage, getProgress, motion, onStage } = options;

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
  await yieldToMain();

  const environment = await createStudioEnvironment(renderer, yieldToMain);
  scene.environment = environment.texture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  const lights = createStudioLights(scene);
  lights.setLevel(1);
  await yieldToMain();

  const model = await buildCarAsync(yieldToMain);
  const anisotropy = Math.min(MAX_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
  const surfaceMaterials = await createSurfaceMaterials(anisotropy, yieldToMain);
  lightSurfaces(surfaceMaterials, 1);
  const surfaces = new Group();
  const solidGeometries = await buildSolidGeometries(model, yieldToMain);
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

  const shadowMap = await createShadowMap(footprint(), yieldToMain);
  // Wide enough for the car to drive the whole way to the camera over it, on any aspect ratio.
  const floorGeometry = new PlaneGeometry(56, 40);
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
  onStage?.("geometry");

  // Compile every program up front, in parallel where supported. The shaders are the single
  // largest start-up cost (seconds, on some Windows GPUs, if compiled on first draw).
  // The reflection pass renders into a linear target without tone mapping, which needs its
  // own variant of every surface program, so it is compiled separately against that target.
  applyPose(camera, POSES.hero, framing, width, height);
  // compileAsync only visits visible objects: the streaks (hidden at rest) must be included,
  // or their program links mid-scroll, on the first frame of the exit.
  // One compileAsync per mesh, issued a task apart: each program's first-use bookkeeping
  // (uniform and attribute look-ups, every one a round trip to the GPU process) then lands
  // in its own task, and the linking itself runs in parallel off the main thread.
  streaks.visible = true;
  const meshes = [...surfaces.children, streaks, floor];
  const pending: Promise<unknown>[] = [];
  renderer.setRenderTarget(reflectionTarget);
  reflection.visible = true;
  for (const mesh of reflection.children) pending.push(renderer.compileAsync(mesh, camera, scene));
  reflection.visible = false;
  renderer.setRenderTarget(null);
  await yieldToMain();
  for (const mesh of meshes) {
    pending.push(renderer.compileAsync(mesh, camera, scene));
    await yieldToMain();
  }
  try {
    await Promise.all(pending);
  } catch {
    // A program that failed to compile reports itself on first draw; the rest still run.
  }

  // Direct3D finishes a program on its first draw, so draw each one once, alone, a task
  // apart — rather than all of them in the first frame the page is revealed on.
  const warm = async (members: Object3D[], target: WebGLRenderTarget | null) => {
    for (const member of members) member.visible = false;
    for (const member of members) {
      member.visible = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      member.visible = false;
      await yieldToMain();
    }
    for (const member of members) member.visible = true;
  };
  car.visible = floor.visible = false;
  reflection.visible = true;
  await warm([...reflection.children], reflectionTarget);
  reflection.visible = false;
  car.visible = true;
  await warm([...surfaces.children, streaks, floor], null);
  streaks.visible = false;
  renderer.setRenderTarget(null);
  renderer.clear();
  onStage?.("shaders");

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

  // Scratch for the exit path (allocated once; draw runs every frame).
  const aim = new Vector3();
  const view = new Vector2();
  const pass = new Vector2();
  const bend = new Vector2();
  const carAt = new Vector2();
  const heading = new Vector2();
  let faded = 1;

  /** Fade the car's finishes together: 1 is opaque (and the materials stay opaque). */
  function fadeCar(k: number) {
    if (k === faded) return;
    faded = k;
    for (const material of Object.values(surfaceMaterials)) {
      material.transparent = k < 1;
      material.opacity = k;
    }
  }

  function draw(now: number, still = false) {
    lastDrawAt = now;

    // Exit: the camera starts to move at once, the car a beat later, and it keeps
    // accelerating: distance grows with a power of time, as it would from a standing start.
    const swing = smoothstep(0, 0.9, progress);
    const launch = clamp01((progress - EXIT.launchAt) / (1 - EXIT.launchAt)) ** EXIT.power;
    const speed = smoothstep(0.1, 0.8, progress);

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
    framed.span = framing.span * lerp(ARRIVAL.pullBack, 1, arrival) * lerp(1, EXIT_PULL_BACK, swing);
    // Place the camera first (aimed at rest), then lay the car's path out from where it stands.
    const distance = applyPose(camera, pose, framed, width, height);

    // The path, in plan: the car leaves along its nose, bends onto the camera's axis and runs
    // down it to a point just beside the lens — one quadratic curve whose control point sits
    // on the car's own centreline, so it starts straight and arrives straight.
    view.set(camera.position.x - TARGET.x, camera.position.z - TARGET.z).normalize();
    // The camera's right-hand side, on the floor.
    pass.set(view.y, -view.x).multiplyScalar(EXIT.pass);
    pass.x += camera.position.x - TARGET.x;
    pass.y += camera.position.z - TARGET.z;
    const run = pass.y / view.y;
    bend.set(Math.max(0.5, pass.x - view.x * run), 0);
    const curveLength = bend.x + run;
    const travel = launch * (curveLength + EXIT.beyond);

    let yaw: number;
    if (travel < curveLength) {
      const t = travel / curveLength;
      const u = 1 - t;
      // Quadratic Bézier from the rest (origin) through `bend` to `pass`, and its tangent.
      carAt.set(2 * u * t * bend.x + t * t * pass.x, 2 * u * t * bend.y + t * t * pass.y);
      heading.set(2 * u * bend.x + 2 * t * (pass.x - bend.x), 2 * t * (pass.y - bend.y));
      yaw = Math.atan2(-heading.y, heading.x);
    } else {
      carAt.copy(view).multiplyScalar(travel - curveLength).add(pass);
      yaw = Math.atan2(-view.y, view.x);
    }
    // Rest to world (the path is laid out from the car's resting centre).
    carAt.x += TARGET.x;
    carAt.y += TARGET.z;

    car.position.set(carAt.x, 0, carAt.y);
    car.rotation.y = yaw;
    reflection.position.copy(car.position);
    reflection.rotation.y = yaw;
    (floorMaterial.uniforms.uCar.value as Vector2).copy(carAt);
    floorMaterial.uniforms.uCarYaw.value = yaw;

    // The camera turns its head after the car, a little; its feet stay put.
    aim.set(TARGET.x + (carAt.x - TARGET.x) * EXIT.follow, TARGET.y, TARGET.z + (carAt.y - TARGET.z) * EXIT.follow);
    camera.lookAt(aim);
    // As the car nears the lens the near plane comes in with it, so nothing is ever cut; it
    // is faded out over the last of the pass rather than clipped.
    const carDistance = Math.hypot(camera.position.x - carAt.x, camera.position.z - carAt.y);
    camera.near = Math.min(Math.max(0.1, distance - 12), Math.max(0.08, carDistance - CAR.length));
    camera.updateProjectionMatrix();
    fadeCar(1 - smoothstep(EXIT.fade.from, EXIT.fade.to, progress));

    const light = sweepAt(now);
    sweep.uSweepAngle.value = light.angle;
    sweep.uSweepLevel.value = light.level * settled;

    renderReflection();

    streakMaterial.uniforms.uStretch.value = speed;
    streakMaterial.uniforms.uOpacity.value = smoothstep(0.02, 0.25, progress) * faded;
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

  return { renderNow, start, stop, setCadence, reveal, dispose, renderStill };
}
