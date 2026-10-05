import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { Footprint } from "@/lib/car/footprint";

/**
 * Surface detail, painted to small canvases at runtime — no image assets.
 *
 * Geometry carries texture coordinates in metres, so each texture declares the physical size
 * of one tile and the pattern lands on the car at its real scale.
 */

function canvasOf(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx, image: ctx.createImageData(size, size) };
}

function tiled(canvas: HTMLCanvasElement, tile: number, anisotropy: number, colour = false): Texture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = anisotropy;
  texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  return texture;
}

/** Tangent-space normal map from a tiling height field. */
function normalsFrom(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const { canvas, ctx, image } = canvasOf(size);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = (-dx / length) * 127.5 + 127.5;
      image.data[i + 1] = (-dy / length) * 127.5 + 127.5;
      image.data[i + 2] = (1 / length) * 127.5 + 127.5;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export interface SurfaceMaps {
  map?: Texture;
  normalMap?: Texture;
  roughnessMap?: Texture;
}

/** Width of one tow of fibre, in metres. */
const TOW = 0.008;

/**
 * Carbon fibre in a 2×2 twill: every tow passes over two and under two, each row stepped one
 * across, which is what draws the diagonal. One tile is a single repeat — four tows square.
 *
 * Warp and weft catch the light differently because their fibres run at right angles, so the
 * weave is carried mostly by the normal and roughness maps and only faintly by colour: it
 * shows where a highlight grazes the surface and disappears where the part is face-on.
 */
export function createCarbonMaps(anisotropy: number): SurfaceMaps {
  const size = 128;
  const tows = 4;
  const height = new Float32Array(size * size);
  const albedo = canvasOf(size);
  const rough = canvasOf(size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * tows;
      const v = (y / size) * tows;
      const column = Math.floor(u);
      const row = Math.floor(v);
      const phase = (((column - row) % 4) + 4) % 4;
      const warp = phase < 2;
      // Position across the tow, and along its two-cell float over the tows beneath.
      const across = warp ? u - column : v - row;
      const along = warp ? (1 - phase + (v - row)) / 2 : (phase - 2 + (u - column)) / 2;
      const crown = 1 - (2 * across - 1) ** 4;
      const arch = Math.sin(Math.PI * along);
      const index = y * size + x;
      height[index] = crown * (0.55 + 0.45 * arch);

      const edge = 1 - crown;
      const tone = (warp ? 21 : 12) - edge * 7;
      const roughness = (warp ? 0.4 : 0.56) + edge * 0.3;
      const i = index * 4;
      albedo.image.data[i] = tone;
      albedo.image.data[i + 1] = tone + 1;
      albedo.image.data[i + 2] = tone + 2;
      albedo.image.data[i + 3] = 255;
      rough.image.data[i] = rough.image.data[i + 1] = rough.image.data[i + 2] = roughness * 255;
      rough.image.data[i + 3] = 255;
    }
  }
  albedo.ctx.putImageData(albedo.image, 0, 0);
  rough.ctx.putImageData(rough.image, 0, 0);

  const tile = TOW * tows;
  return {
    map: tiled(albedo.canvas, tile, anisotropy, true),
    normalMap: tiled(normalsFrom(height, size, 2.2), tile, anisotropy),
    roughnessMap: tiled(rough.canvas, tile, anisotropy),
  };
}

// Small deterministic hash: the textures are identical on every visit.
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Tiling value noise in 0…1 on a `cells`-square lattice. */
function noise(u: number, v: number, cellsU: number, cellsV: number): number {
  const x = u * cellsU;
  const y = v * cellsV;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const corner = (dx: number, dy: number) => hash((x0 + dx) % cellsU, (y0 + dy) % cellsV);
  const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * sx;
  const bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/**
 * Tyre rubber: a matte surface that is never quite even. Grain is stretched around the
 * circumference (u), the way a moulded and scrubbed tyre actually wears its finish.
 */
export function createRubberMaps(anisotropy: number): SurfaceMaps {
  const size = 256;
  const height = new Float32Array(size * size);
  const rough = canvasOf(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const streak = noise(u, v, 6, 48);
      const grain = noise(u, v, 96, 96);
      const blotch = noise(u, v, 5, 5);
      const index = y * size + x;
      height[index] = streak * 0.6 + grain * 0.4;
      const roughness = 0.8 + 0.12 * streak + 0.08 * (blotch - 0.5);
      const i = index * 4;
      rough.image.data[i] = rough.image.data[i + 1] = rough.image.data[i + 2] = roughness * 255;
      rough.image.data[i + 3] = 255;
    }
  }
  rough.ctx.putImageData(rough.image, 0, 0);
  const tile = 0.24;
  return {
    normalMap: tiled(normalsFrom(height, size, 1.4), tile, anisotropy),
    roughnessMap: tiled(rough.canvas, tile, anisotropy),
  };
}

/**
 * A lathe-turned face: fine concentric grooves. The wheel covers map v to radius, so a
 * pattern that varies only in v becomes rings, and highlights break into arcs across them.
 */
export function createTurnedMaps(anisotropy: number): SurfaceMaps {
  const size = 64;
  const grooves = 4;
  const height = new Float32Array(size * size);
  const rough = canvasOf(size);
  for (let y = 0; y < size; y++) {
    const groove = 0.5 - 0.5 * Math.cos((2 * Math.PI * grooves * y) / size);
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      height[index] = groove;
      const roughness = 0.3 + 0.14 * groove + 0.06 * hash(x, y);
      const i = index * 4;
      rough.image.data[i] = rough.image.data[i + 1] = rough.image.data[i + 2] = roughness * 255;
      rough.image.data[i + 3] = 255;
    }
  }
  rough.ctx.putImageData(rough.image, 0, 0);
  const tile = 0.02;
  return {
    normalMap: tiled(normalsFrom(height, size, 1.2), tile, anisotropy),
    roughnessMap: tiled(rough.canvas, tile, anisotropy),
  };
}

/** Half-extents, in metres, of the ground area the occlusion map covers around the car. */
export const SHADOW_EXTENT = { x: 4, z: 2 } as const;

/**
 * Ground occlusion under the car, as one channel: a broad soft shadow from the bodywork, a
 * dense tight one under the floor (which runs a few centimetres off the ground), and a small
 * hard-edged patch where each tyre actually touches. Together they are what plant the car.
 */
export function createShadowMap(footprint: Footprint): Texture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const toX = (x: number) => ((x - footprint.centre) / (2 * SHADOW_EXTENT.x) + 0.5) * width;
  const toY = (z: number) => (z / (2 * SHADOW_EXTENT.z) + 0.5) * height;
  const perMetre = width / (2 * SHADOW_EXTENT.x);

  /** Rasterise shapes as coverage, then blur by `radius` metres. */
  const layer = (draw: () => void, radius: number): Float32Array => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    draw();
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const field = new Float32Array(width * height);
    for (let i = 0; i < field.length; i++) field[i] = pixels[i * 4] / 255;
    return blur(field, width, height, Math.max(1, Math.round(radius * perMetre)));
  };
  const polygons = (shapes: Footprint["low"]) => () => {
    for (const shape of shapes) {
      ctx.beginPath();
      shape.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(toX(x), toY(z)) : ctx.lineTo(toX(x), toY(z))));
      ctx.closePath();
      ctx.fill();
    }
  };

  const ambient = layer(polygons([...footprint.low, ...footprint.high]), 0.34);
  const under = layer(polygons(footprint.low), 0.07);
  const contact = layer(() => {
    for (const [x, z, halfLength, halfWidth] of footprint.patches) {
      ctx.fillRect(toX(x - halfLength), toY(z - halfWidth), 2 * halfLength * perMetre, 2 * halfWidth * perMetre);
    }
  }, 0.02);

  const image = ctx.createImageData(width, height);
  for (let i = 0; i < ambient.length; i++) {
    // Layers combine like stacked filters, so overlapping shadows deepen without clipping.
    const light = (1 - 0.72 * Math.min(1, ambient[i] * 1.5)) * (1 - 0.82 * under[i]) * (1 - 0.95 * contact[i]);
    const value = (1 - light) * 255;
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  // Keep canvas rows in step with +z, as the floor shader assumes.
  texture.flipY = false;
  return texture;
}

/** Three box-blur passes in each direction: close to a Gaussian, and cheap enough to run once at start-up. */
function blur(field: Float32Array, width: number, height: number, radius: number): Float32Array {
  let source: Float32Array = field;
  let target: Float32Array = new Float32Array(field.length);
  const pass = (stride: number, count: number, lines: number, lineStride: number) => {
    for (let line = 0; line < lines; line++) {
      const base = line * lineStride;
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += source[base + Math.min(count - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < count; i++) {
        target[base + i * stride] = sum / (2 * radius + 1);
        const leaving = Math.max(0, i - radius);
        const entering = Math.min(count - 1, i + radius + 1);
        sum += source[base + entering * stride] - source[base + leaving * stride];
      }
    }
    [source, target] = [target, source];
  };
  for (let i = 0; i < 3; i++) {
    pass(1, width, height, width);
    pass(width, height, width, 1);
  }
  return source;
}
