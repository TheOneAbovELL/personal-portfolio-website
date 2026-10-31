import { CarElevation } from "@/components/figures/CarElevation";
import { profile } from "@/content";
import { IntroGate } from "./IntroGate";

/** Timing-tower code: the first three letters of the surname, as a broadcast tower prints it. */
const TOWER_CODE = (profile.name.split(" ").at(-1) ?? profile.name).slice(0, 3).toUpperCase();

/**
 * The start sequence, played on every full document load (never on client navigation — the
 * root layout does not re-render then).
 *
 * The whole timeline is CSS (styles/loader.css), so it completes even if JavaScript never
 * arrives: the car draws itself under a gantry of five start lights named after the working
 * loop, the lights go out, the car launches into the exact place the hero's own drawing
 * occupies, and the curtain lifts onto that drawing. JavaScript only adds skipping
 * (`INTRO_BOOT`, inlined in the document head) and removes the node afterwards (`IntroGate`).
 */
export function Intro() {
  return (
    <IntroGate>
      <div id="intro" className="intro" aria-hidden="true" suppressHydrationWarning>
        <div className="intro-frame">
          <div className="intro-head shell">
            <p className="intro-tower">
              <span className="intro-tower-bar" />
              <span className="intro-tower-code">{TOWER_CODE}</span>
              <span className="label text-steel">{profile.name}</span>
            </p>
            <p className="intro-status label">
              <span className="text-faint">Start</span>
              <span className="text-metal-3">/</span>
              <span className="intro-status-word">
                <span className="text-steel">On the grid</span>
                <span className="text-signal">Lights out</span>
              </span>
            </p>
          </div>

          <div className="intro-gantry">
            <div className="intro-rail weave" />
            <ol className="intro-lights">
              {profile.loop.map((step, index) => (
                <li key={step} style={{ "--light": index } as React.CSSProperties}>
                  <span className="intro-stem" />
                  <span className="intro-pod">
                    <span className="intro-lamp" />
                    <span className="intro-lamp" />
                  </span>
                  <span className="intro-light-label label">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="intro-car" suppressHydrationWarning>
            <CarElevation className="block h-auto w-full" />
          </div>

          <p className="intro-hint label text-faint">
            <span className="intro-hint-fine">Any key</span>
            <span className="intro-hint-touch">Tap</span>
            <span className="text-metal-3">/</span>
            <span>Skip</span>
          </p>

          <div className="intro-edge" />
        </div>
      </div>
    </IntroGate>
  );
}
