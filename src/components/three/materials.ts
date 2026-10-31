import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  ShaderMaterial,
  type Texture,
  Vector2,
} from "three";
import type { MaterialId } from "@/lib/car/types";
import { createCarbonMaps, createRubberMaps, createTurnedMaps, SHADOW_EXTENT } from "./textures";

/** The site palette, as the scene needs it (see the tokens in app/globals.css). */
export const COLORS = {
  carbon: "#07090b",
  bone: "#e9e7e1",
  signal: "#f2c230",
  data: "#3ccfc0",
  perf: "#d7262f",
} as const;

// Surfaces are pushed back a touch in depth so the drawing's strokes, which lie exactly
// on them, always pass the depth test.
const offset = { polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2, side: DoubleSide } as const;

/**
 * How strongly each accent holds its own colour when fully lit. Paint and markings get a
 * trace so they stay legible in shadow; only the rain light is actually a lamp.
 */
const EMISSIVE: Partial<Record<MaterialId, number>> = { signal: 0.05, data: 0.08, lamp: 0.9 };

export type SurfaceMaterials = Record<MaterialId, MeshStandardMaterial | MeshBasicMaterial>;

/** Physically based finishes for each part of the car. `anisotropy` is the renderer's limit. */
export function createSurfaceMaterials(anisotropy: number): SurfaceMaterials {
  const carbon = createCarbonMaps(anisotropy);
  const rubber = createRubberMaps(anisotropy);
  const turned = createTurnedMaps(anisotropy);

  return {
    // Metallic graphite under clearcoat. The base coat is fairly rough, so highlights have a
    // soft shoulder; the lacquer over it adds the tight reflection of the studio lights.
    paint: new MeshPhysicalMaterial({
      color: "#3a4046",
      metalness: 0.8,
      roughness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      ...offset,
    }),
    // Racing red under the same lacquer — the livery's one colour, on the fin and rear
    // endplates only. A deep base so it reads as paint, not plastic, and holds its hue under
    // the tone mapping; the clearcoat carries the studio's highlights over it. Same feature set
    // as the graphite paint, so the two share one shader program.
    livery: new MeshPhysicalMaterial({
      color: "#b0141d",
      metalness: 0.25,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      ...offset,
    }),
    // Bare twill carbon under a satin lacquer. Specular is held down so flat panels never
    // flare under the rim light; what reflection there is, the weave breaks up.
    carbon: new MeshPhysicalMaterial({
      color: "#ffffff",
      map: carbon.map,
      normalMap: carbon.normalMap,
      normalScale: new Vector2(0.55, 0.55),
      roughnessMap: carbon.roughnessMap,
      roughness: 1,
      metalness: 0,
      specularIntensity: 0.6,
      envMapIntensity: 0.55,
      ...offset,
    }),
    rubber: new MeshStandardMaterial({
      color: "#0b0b0c",
      normalMap: rubber.normalMap,
      normalScale: new Vector2(0.35, 0.35),
      roughnessMap: rubber.roughnessMap,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.5,
      ...offset,
    }),
    rim: new MeshStandardMaterial({
      color: "#474d53",
      normalMap: turned.normalMap,
      normalScale: new Vector2(0.4, 0.4),
      roughnessMap: turned.roughnessMap,
      roughness: 1,
      metalness: 0.92,
      ...offset,
    }),
    silver: new MeshStandardMaterial({ color: "#9aa1a7", metalness: 0.9, roughness: 0.34, ...offset }),
    glass: new MeshPhysicalMaterial({
      color: "#05070a",
      metalness: 0.6,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ...offset,
    }),
    // Openings take no light at all.
    void: new MeshBasicMaterial({ color: "#020203", ...offset }),
    signal: new MeshStandardMaterial({
      color: COLORS.signal,
      emissive: COLORS.signal,
      emissiveIntensity: 0,
      metalness: 0,
      roughness: 0.5,
      ...offset,
    }),
    data: new MeshStandardMaterial({
      color: COLORS.data,
      emissive: COLORS.data,
      emissiveIntensity: 0,
      metalness: 0,
      roughness: 0.45,
      ...offset,
    }),
    lamp: new MeshStandardMaterial({
      color: "#2a0507",
      emissive: COLORS.perf,
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
      uKey: { value: new Color("#c9d6e2") },
      uRim: { value: new Color(COLORS.data) },
      uKicker: { value: new Color(COLORS.perf) },
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

        // Light on the floor: the key's pool under the car, teal behind it, red low in front.
        vec3 light = uKey * 0.034 * pool(p, vec2(0.3, 0.7), vec2(4.4, 2.5));
        light += uRim * 0.02 * pool(p, vec2(-3.4, -2.6), vec2(3.2, 2.2));
        light += uKicker * 0.022 * pool(p, vec2(3.6, -2.2), vec2(2.8, 1.9));

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

export function createLineMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uColor: { value: new Color(COLORS.bone) },
      uSignal: { value: new Color(COLORS.signal) },
      uOpacity: { value: 1 },
      uLit: { value: 0 },
      uTime: { value: 0 },
      uPulse: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      attribute float aAlpha;
      attribute float aSignal;

      varying float vAlong;
      varying float vAlpha;
      varying float vSignal;

      void main() {
        vAlong = aAlong;
        vAlpha = aAlpha;
        vSignal = aSignal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSignal;
      uniform float uOpacity;
      uniform float uLit;
      uniform float uTime;
      uniform float uPulse;

      varying float vAlong;
      varying float vAlpha;
      varying float vSignal;

      void main() {
        // A soft band that travels nose → tail every few seconds, like air over the surface.
        float head = fract(uTime / 7.0) * 1.9 - 0.45;
        float d = (vAlong - head) / 0.09;
        float band = exp(-d * d) * uPulse;

        vec3 color = mix(uColor, uSignal, vSignal);
        color = mix(color, uSignal, band * 0.55);

        // Once the surfaces are lit, the construction lines recede to a faint trace.
        float base = vAlpha * mix(1.0, 0.16, uLit);
        float alpha = mix(base, 0.95, vSignal);
        alpha += band * 0.3;

        gl_FragColor = vec4(color, alpha * uOpacity);
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
      uRed: { value: new Color(COLORS.perf) },
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
