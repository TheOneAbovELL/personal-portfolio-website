import { profile } from "@/content";
import { LABELS, LAP, LAP2, SECTORS, START, TICKS, VIEWBOX } from "./circuit";
import { IntroGate } from "./IntroGate";

/** The trail: stacked dashes ending at the light, each longer and fainter, scaled by its speed. */
const TAIL = [10, 22, 40, 66, 100, 145, 200];
const SECTOR_SPANS: [number, number][] = [
  [0, SECTORS[0]],
  [SECTORS[0], SECTORS[1]],
  [SECTORS[1], 1000],
];

/** A two-row chequer across the start/finish line (the track is horizontal there). */
function Chequer() {
  const cells = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      if ((row + col) % 2) continue;
      cells.push(<rect key={`${row}-${col}`} x={START[0] - 2.4 + row * 2.4} y={START[1] - 6 + col * 2.4} width="2.4" height="2.4" />);
    }
  }
  return <g className="ic-chequer">{cells}</g>;
}

/**
 * The first moment of every full page load (never client navigation: the root layout does not
 * re-render then): a qualifying lap. A thin circuit draws itself on, and a small red light laps it
 * while the page really loads — each sector is a real loading stage (boot.ts), lit with its real
 * split when the light crosses its line, and the light may not cross a line before that stage is
 * done. The timing strip is live: the lap clock counts, the sector in progress counts, the trail
 * stretches with speed, and a simulated speed/throttle readout keeps the strip breathing. When
 * the lap is in, the line flashes, the circuit zooms away, the curtain lifts from the car, and
 * the name becomes the hero's heading.
 *
 * The name mirrors #hero-title (Hero.tsx): same `.display .hero-name` settings (only the size
 * differs), the same words on one line, so the hand-off is a pure translate + scale.
 * The timeline lives in boot.ts (inlined in the head); the styles, including the no-script
 * failsafe, in styles/loader.css; the circuit geometry in circuit.ts.
 */
export function Intro() {
  return (
    <IntroGate>
      <div id="intro" className="intro" aria-hidden="true" suppressHydrationWarning>
        <div className="intro-backdrop" suppressHydrationWarning />
        <div className="intro-vignette" suppressHydrationWarning />
        <div className="intro-wash" suppressHydrationWarning />
        <div className="intro-stage" suppressHydrationWarning>
          <div className="intro-circuit" suppressHydrationWarning>
            <svg viewBox={VIEWBOX} className="intro-svg" focusable="false">
              <path className="ic-bed" d={LAP} />
              <path className="ic-track" d={LAP} pathLength={1000} />
              {SECTOR_SPANS.map(([from, to], index) => (
                <path
                  key={index}
                  className="ic-sector"
                  data-sector={index}
                  d={LAP}
                  pathLength={1000}
                  strokeDasharray={`${(to - from).toFixed(2)} 2000`}
                  strokeDashoffset={(-from).toFixed(2)}
                  suppressHydrationWarning
                />
              ))}
              {/* The same spans again, bright: each flashes once as its line is crossed (boot.ts). */}
              {SECTOR_SPANS.map(([from, to], index) => (
                <path
                  key={index}
                  className="ic-flash"
                  d={LAP}
                  pathLength={1000}
                  strokeDasharray={`${(to - from).toFixed(2)} 2000`}
                  strokeDashoffset={(-from).toFixed(2)}
                  suppressHydrationWarning
                />
              ))}
              <g className="ic-marks">
                {TICKS.map(([x1, y1, x2, y2], index) => (
                  <line key={index} className="ic-tick" data-tick={index} x1={x1} y1={y1} x2={x2} y2={y2} suppressHydrationWarning />
                ))}
                <Chequer />
                {LABELS.map(([x, y], index) => (
                  <text key={index} className="ic-label" data-label={index} x={x} y={y} suppressHydrationWarning>
                    S{index + 1}
                  </text>
                ))}
              </g>
              {/* The finish line, flashed rosso as the lap comes in. */}
              <line className="ic-finish" x1={START[0]} y1={START[1] - 9} x2={START[0]} y2={START[1] + 9} suppressHydrationWarning />
              <g className="ic-light" suppressHydrationWarning>
                {TAIL.map((length) => (
                  <path
                    key={length}
                    className="ic-tail"
                    d={LAP2}
                    pathLength={2000}
                    strokeDasharray={`${length} 4000`}
                    data-length={length}
                    suppressHydrationWarning
                  />
                ))}
                <path className="ic-halo" d={LAP2} pathLength={2000} suppressHydrationWarning />
                <path className="ic-head" d={LAP2} pathLength={2000} suppressHydrationWarning />
              </g>
            </svg>
          </div>

          <div className="intro-card" suppressHydrationWarning>
            <div className="intro-id">
              <p className="intro-name display hero-name" suppressHydrationWarning>
                {profile.name}
              </p>
              <p className="intro-status">
                <span className="intro-stage-text" suppressHydrationWarning>
                  Out lap · loading fonts
                </span>
              </p>
            </div>
            <p className="intro-lap">
              <span className="intro-lap-label">Lap</span>
              <span className="intro-lap-time" suppressHydrationWarning>
                0.000
              </span>
            </p>
            <ol className="intro-sectors">
              {SECTOR_SPANS.map((_, index) => (
                <li key={index} className="intro-sector" data-sector={index} suppressHydrationWarning>
                  <span className="intro-sector-flash" suppressHydrationWarning />
                  <span className="intro-sector-bar">
                    <span className="intro-sector-fill" suppressHydrationWarning />
                  </span>
                  <span className="intro-sector-tag">S{index + 1}</span>
                  {/* Rendered with its text so boot.ts only ever changes it (never adds a node: hydration). */}
                  <span className="intro-sector-chip" suppressHydrationWarning>
                    Split
                  </span>
                  <span className="intro-sector-time" suppressHydrationWarning>
                    0.000
                  </span>
                </li>
              ))}
            </ol>
            {/* Instrumentation: a simulated speed and throttle for the light (boot.ts). */}
            <p className="intro-telemetry" suppressHydrationWarning>
              <span className="intro-speed">
                <span className="intro-telemetry-label">Spd</span>
                <span className="intro-speed-value" suppressHydrationWarning>
                  0
                </span>
              </span>
              <span className="intro-throttle">
                <span className="intro-telemetry-label">Thr</span>
                <span className="intro-throttle-bar">
                  <span className="intro-throttle-fill" suppressHydrationWarning />
                </span>
              </span>
            </p>
          </div>
        </div>
        {/* The name at the heading's own size, for the hand-off (boot.ts scales it down to the
            card's name, then glides it to scale 1 on the heading). Invisible until then. */}
        <p className="intro-ghost display hero-name" suppressHydrationWarning>
          {profile.name}
        </p>
      </div>
    </IntroGate>
  );
}
