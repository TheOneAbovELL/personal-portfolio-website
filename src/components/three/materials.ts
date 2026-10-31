import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Texture,
  Vector2,
} from "three";
import type { MaterialId } from "@/lib/car/types";
import { createCarbonMaps, createRubberMaps, createTurnedMaps, SHADOW_EXTENT } from "./textures";

/**
 * The scene's palette (see the tokens in app/globals.css): Ferrari-led — warm carbon, ivory
 * line work, deep rosso as the one signature colour, champagne for the finest detail.
 */
export const COLORS = {
  carbon: "#0b0a0a",
  bone: "#efebe4",
  champagne: "#c9a96e",
  rosso: "#c8102e",
  /** The studio's light: a neutral key, a cool fill, a warm rim. */
  key: "#f3f4f4",
  fill: "#d9e2ec",
  warm: "#ffe6d2",
} as const;

// Surfaces are pushed back a touch in depth so the drawing's strokes, which lie exactly
// on them, always pass the depth test.
const offset = { polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2, side: DoubleSide } as const;

/**
 * How strongly each accent holds its own colour when fully lit. The tyre marking gets a
 * trace so it stays legible on the shaded sidewall; only the rain light is actually a lamp.
 */
const EMISSIVE: Partial<Record<MaterialId, number>> = { marking: 0.035, lamp: 0.9 };

export type SurfaceMaterials = Record<MaterialId, MeshStandardMaterial | MeshBasicMaterial>;

/**
 * The light sweep: a tall, narrow softbox that travels once around the car (see scene.ts).
 * It exists only in the lacquer's reflections — a ring of directions in world space, turned
 * about the vertical by `uSweepAngle` — so its highlight flows over the bodywork following
 * the form of every panel, as a real light carried past a car on a stand would.
 */
export const sweep = {
  uSweepAngle: { value: 0 },
  uSweepLevel: { value: 0 },
  uSweepColor: { value: new Color(COLORS.key) },
};

function withSweep<T extends MeshPhysicalMaterial>(material: T): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sweep);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uSweepAngle;
        uniform float uSweepLevel;
        uniform vec3 uSweepColor;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          #ifdef USE_CLEARCOAT
            vec3 sweepN = clearcoatNormal;
          #else
            vec3 sweepN = normal;
          #endif
          // Ground occlusion: the floor and the car's own floor shade the lower bodywork, so
          // lacquer darkens toward the ground — what keeps flat panels from reading as cut-outs.
          vec3 sweepWorld = cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz;
          outgoingLight *= mix(0.42, 1.0, smoothstep(0.02, 0.62, sweepWorld.y));
          vec3 sweepV = normalize(vViewPosition);
          vec3 sweepR = inverseTransformDirection(reflect(-sweepV, sweepN), viewMatrix);
          vec3 sweepAxis = vec3(cos(uSweepAngle), 0.0, sin(uSweepAngle));
          float sweepD = dot(sweepR, sweepAxis) / 0.055;
          // A vertical strip: nothing from straight above or from the floor.
          float sweepTall = smoothstep(0.92, 0.45, abs(sweepR.y - 0.12));
          float sweepFresnel = 0.35 + 0.65 * pow(1.0 - saturate(dot(sweepV, sweepN)), 2.0);
          outgoingLight += uSweepColor * exp(-sweepD * sweepD) * sweepTall * sweepFresnel * uSweepLevel;
        }
        #include <opaque_fragment>`,
      );
  };
  // Same chunk edit for every sweep material, so they can share programs.
  material.customProgramCacheKey = () => "sweep";
  return material;
}

/** Physically based finishes for each part of the car. `anisotropy` is the renderer's limit. */
export function createSurfaceMaterials(anisotropy: number): SurfaceMaterials {
  const carbon = createCarbonMaps(anisotropy);
  const lacquered = createCarbonMaps(anisotropy, 0.62);
  const rubber = createRubberMaps(anisotropy);
  const turned = createTurnedMaps(anisotropy);

  return {
    // Lacquered carbon: the weave under a deep gloss clearcoat. The base is satin, so the
    // weave shows as a faint shimmer of roughness where a highlight crosses it; the lacquer
    // over it carries crisp reflections of the softboxes.
    paint: withSweep(
      new MeshPhysicalMaterial({
        color: "#ffffff",
        map: lacquered.map,
        normalMap: lacquered.normalMap,
        normalScale: new Vector2(0.3, 0.3),
        roughnessMap: lacquered.roughnessMap,
        roughness: 1,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        ...offset,
      }),
    ),
    // Rosso metallic: a deep red base coat with metallic flake, which tints its own
    // reflections red and gives the panels depth where they turn from the light, under a
    // clear lacquer that throws back the studio's lights in white. Deep enough to hold its
    // hue through the tone mapping: never orange, never brick.
    livery: withSweep(
      new MeshPhysicalMaterial({
        color: "#a40a1e",
        metalness: 0.42,
        roughness: 0.36,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        ...offset,
      }),
    ),
    // Bare twill carbon under a satin lacquer. Specular is held down so flat panels never
    // flare under the rim light; what reflection there is, the weave breaks up.
    carbon: new MeshPhysicalMaterial({
      // A hair cool and dark, so upward faces under the key read as carbon, not bronze.
      color: "#b9bfc6",
      map: carbon.map,
      normalMap: carbon.normalMap,
      normalScale: new Vector2(0.55, 0.55),
      roughnessMap: carbon.roughnessMap,
      roughness: 1,
      metalness: 0,
      specularIntensity: 0.55,
      envMapIntensity: 0.5,
      ...offset,
    }),
    rubber: new MeshStandardMaterial({
      color: "#0d0c0c",
      normalMap: rubber.normalMap,
      normalScale: new Vector2(0.35, 0.35),
      roughnessMap: rubber.roughnessMap,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.5,
      ...offset,
    }),
    // Dark graphite: anodised, turned on the lathe.
    rim: new MeshStandardMaterial({
      color: "#2c2d2f",
      normalMap: turned.normalMap,
      normalScale: new Vector2(0.4, 0.4),
      roughnessMap: turned.roughnessMap,
      roughness: 1,
      metalness: 0.9,
      ...offset,
    }),
    silver: new MeshStandardMaterial({ color: "#6f6d6b", metalness: 0.92, roughness: 0.3, ...offset }),
    glass: new MeshPhysicalMaterial({
      color: "#050506",
      metalness: 0.6,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ...offset,
    }),
    // Openings take no light at all.
    void: new MeshBasicMaterial({ color: "#020202", ...offset }),
    // Sidewall paint: a flat, slightly rough red.
    marking: new MeshStandardMaterial({
      color: "#c3121f",
      emissive: COLORS.rosso,
      emissiveIntensity: 0,
      metalness: 0,
      roughness: 0.62,
      ...offset,
    }),
    // Gold leaf: metallic, so it shows only where it catches a light, which is the point.
    pinstripe: new MeshStandardMaterial({
      color: COLORS.champagne,
      metalness: 1,
      roughness: 0.28,
      ...offset,
    }),
    lamp: new MeshStandardMaterial({
      color: "#2a0507",
      emissive: COLORS.rosso,
      emissiveIntensity: 0,
      metalness: 0,
      roughness: 0.3,
      ...offset,
    }),
  };
}

/** Bring the accents up with the studio lights: 0 in the line drawing, 1 fully lit. */
export function lightSurfaces(materials: SurfaceMaterials, lit: number): void {
  for (const [id, strength] of Object.entries(EMISSIVE) as [MaterialId, number][]) {
    const material = materials[id];
    if (material instanceof MeshStandardMaterial) material.emissiveIntensity = strength * lit;
  }
}

/**
 * The studio floor, as one transparent plane over the page's own background.
 *
 * It adds light — a pool that falls off into the dark, faint coloured spill from the rim and
 * kicker, and a rough reflection of the car — and takes light away where the car shades the
 * ground. The reflection is sampled in screen space from a separate reduced-size render of
 * the mirrored car; it is read at a coarser mip level and smeared further the farther the
 * ground is from the car, so it is sharpest at the tyres and gone within a metre or so.
 */
export function createFloorMaterial(reflection: Texture, shadow: Texture, centre: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Output is premultiplied: colour is added to the page, alpha only darkens it.
    premultipliedAlpha: true,
    uniforms: {
      uReflection: { value: reflection },
      uShadow: { value: shadow },
      uResolution: { value: new Vector2(1, 1) },
      uCentre: { value: new Vector2(centre, 0) },
      // Where the car is now: the shadow and reflection go with it, the studio's light stays.
      uCar: { value: new Vector2(centre, 0) },
      uShadowExtent: { value: new Vector2(SHADOW_EXTENT.x, SHADOW_EXTENT.z) },
      uKey: { value: new Color(COLORS.key) },
      uRim: { value: new Color(COLORS.warm) },
      uKicker: { value: new Color(COLORS.rosso) },
      uLit: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uReflection;
      uniform sampler2D uShadow;
      uniform vec2 uResolution;
      uniform vec2 uCentre;
      uniform vec2 uCar;
      uniform vec2 uShadowExtent;
      uniform vec3 uKey;
      uniform vec3 uRim;
      uniform vec3 uKicker;
      uniform float uLit;

      varying vec3 vWorld;

      // Half-extents of the car in plan, in metres.
      const vec2 FOOTPRINT = vec2(2.75, 0.95);

      float pool(vec2 p, vec2 centre, vec2 radius) {
        vec2 d = (p - centre) / radius;
        return exp(-dot(d, d));
      }

      void main() {
        vec2 p = vWorld.xz - uCentre;
        vec2 c = vWorld.xz - uCar;

        // Light on the floor: the key's pool under the car, warm spill from the rim behind
        // it, and the faintest rosso glow thrown down by the paint itself.
        vec3 light = uKey * 0.03 * pool(p, vec2(0.3, 0.7), vec2(4.4, 2.5));
        light += uRim * 0.014 * pool(p, vec2(-3.4, -2.6), vec2(3.2, 2.2));
        light += uKicker * 0.008 * pool(p, vec2(0.0, 0.2), vec2(2.6, 1.2));

        float shade = texture2D(uShadow, c / (2.0 * uShadowExtent) + 0.5).r;
        vec2 inside = step(abs(c), uShadowExtent);
        shade *= inside.x * inside.y;

        // Reflection: rougher and fainter with distance from the car's footprint.
        float away = length(max(abs(c) - FOOTPRINT, 0.0));
        vec2 screen = gl_FragCoord.xy / uResolution;
        float level = 2.0 + away * 2.4;
        vec2 smear = vec2(0.0025, 0.006) + away * vec2(0.004, 0.014);
        vec3 mirrored = vec3(0.0);
        float weight = 0.0;
        for (int i = -4; i <= 4; i++) {
          float t = float(i) / 4.0;
          // Mostly vertical, with a slight alternating sideways step so the taps do not band.
          vec2 tap = vec2(mod(float(i), 2.0) - 0.5, t) * smear;
          float w = 1.0 - 0.7 * abs(t);
          mirrored += textureLod(uReflection, screen + tap, level).rgb * w;
          weight += w;
        }
        mirrored /= weight;

        // A satin floor reflects more at a glancing view, but never like a mirror.
        float glance = 1.0 - max(normalize(cameraPosition - vWorld).y, 0.0);
        float reflectance = mix(0.05, 0.42, pow(glance, 4.0)) * exp(-away * 1.7);

        vec3 added = light * (1.0 - shade) + mirrored * reflectance;
        gl_FragColor = vec4(added * uLit, shade * uLit);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Speed streaks (see buildStreakGeometry): each segment's tail is pulled aft by `uStretch`
 * metres times its own length factor, and fades from its anchor on the car to nothing.
 * Additive, so overlapping streaks brighten like light rather than stacking up as paint.
 */
export function createStreakMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(COLORS.bone) },
      uRed: { value: new Color(COLORS.rosso) },
      uStretch: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aTail;
      attribute float aLength;
      attribute float aSeed;
      attribute float aRed;

      uniform float uStretch;

      varying float vTail;
      varying float vSeed;
      varying float vRed;

      void main() {
        // Streaks start one after another, not all at once.
        float grow = clamp(uStretch * 1.5 - aSeed * 0.5, 0.0, 1.0);
        vec3 p = position;
        p.x -= aTail * aLength * grow * grow;
        vTail = aTail;
        vSeed = aSeed;
        vRed = aRed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uRed;
      uniform float uOpacity;

      varying float vTail;
      varying float vSeed;
      varying float vRed;

      void main() {
        float fade = pow(1.0 - vTail, 1.6);
        vec3 color = mix(uColor, uRed * 1.6, vRed);
        float alpha = fade * (0.18 + 0.32 * vSeed) * uOpacity;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap"] as const;

/** Dispose materials together with every texture they own. */
export function disposeMaterials(materials: Iterable<Material>): void {
  for (const material of materials) {
    const slots = material as Material & Partial<Record<(typeof TEXTURE_SLOTS)[number], Texture | null>>;
    for (const slot of TEXTURE_SLOTS) slots[slot]?.dispose();
    material.dispose();
  }
}
