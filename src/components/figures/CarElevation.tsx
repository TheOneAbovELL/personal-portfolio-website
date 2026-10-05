import type { Vec2 } from "@/lib/car/types";
import { buildCar, CAR } from "@/lib/car/model";

/**
 * FIG. 01 — the car as a flat side elevation.
 *
 * Rendered on the server from the same geometry the WebGL scene uses, so the drawing is in
 * the HTML before any JavaScript runs. Parts are painted far-to-near and each part's
 * silhouette is filled with the background colour, which removes hidden lines.
 */

// Centimetres, y flipped for SVG. The viewBox is centred on the WebGL camera target.
const VIEW = { width: 600, height: 150, cx: ((CAR.noseX + CAR.tailX) / 2) * 100, cy: -42 };

/** Width of the SVG relative to the car's length — used by CSS to size the drawing. */
export const ELEVATION_SCALE = VIEW.width / (CAR.length * 100);

const STROKE = {
  contour: { opacity: 0.3, width: 1 },
  edge: { opacity: 0.62, width: 1 },
  detail: { opacity: 0.34, width: 1 },
} as const;

/** Long polylines are thinned for the inline SVG; short ones (small parts) keep every point. */
const stride = (points: Vec2[], every: number) => (points.length > 40 ? every : 1);

function toPath(points: Vec2[], closed = false, stride = 1): string {
  const out: string[] = [];
  for (let i = 0; i < points.length; i += stride) {
    const [x, y] = points[i];
    out.push(`${i === 0 ? "M" : "L"}${(x * 100).toFixed(1)} ${(-y * 100).toFixed(1)}`);
  }
  // Always land exactly on the final point when decimating.
  if (stride > 1 && (points.length - 1) % stride !== 0) {
    const [x, y] = points[points.length - 1];
    out.push(`L${(x * 100).toFixed(1)} ${(-y * 100).toFixed(1)}`);
  }
  return out.join("") + (closed ? "Z" : "");
}

export function CarElevation({ className }: { className?: string }) {
  const parts = buildCar()
    .parts.filter((part) => part.elevation)
    .sort((a, b) => a.elevation!.layer - b.elevation!.layer);

  let drawIndex = 0;
  const minX = VIEW.cx - VIEW.width / 2;
  const minY = VIEW.cy - VIEW.height / 2;

  return (
    <svg
      className={className}
      viewBox={`${minX} ${minY} ${VIEW.width} ${VIEW.height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ground datum with axle ticks */}
      <path
        d={`M${minX} 0H${minX + VIEW.width}`}
        stroke="var(--color-rule-strong)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {[CAR.frontAxleX, CAR.rearAxleX].map((x) => (
        <path
          key={x}
          d={`M${x * 100} 0v7`}
          stroke="var(--color-faint)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {parts.map((part) => {
        const elevation = part.elevation!;
        return (
          <g key={part.id}>
            {elevation.fill && (
              <path d={toPath(elevation.fill, true, stride(elevation.fill, 4))} fill="var(--color-carbon)" />
            )}
            {elevation.strokes.map((stroke, i) => {
              const style = STROKE[stroke.role];
              const index = drawIndex++;
              return (
                <path
                  key={i}
                  className="draw-on"
                  style={{ "--draw-index": index } as React.CSSProperties}
                  d={toPath(stroke.points, stroke.closed, stroke.role === "contour" ? stride(stroke.points, 3) : 1)}
                  pathLength={1}
                  stroke={stroke.signal ? "var(--color-signal)" : "var(--color-bone)"}
                  strokeOpacity={stroke.signal ? 0.95 : style.opacity}
                  strokeWidth={style.width}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
