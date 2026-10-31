import { Fragment } from "react";
import { profile } from "@/content";
import { IntroGate } from "./IntroGate";

/**
 * The first moment of every full page load (never client navigation: the root layout does not
 * re-render then). One typographic event — the name, set once, revealed through a mask, with a
 * red hairline tracing real readiness beneath it — which then becomes the hero's heading.
 *
 * The markup mirrors #hero-title (Hero.tsx): same display face and `.hero-name` type settings
 * (styles/hero.css; only the size differs), same words, the same line break below md, so the
 * hand-off can be a pure translate + scale. The timeline lives in boot.ts
 * (inlined in the head); the styles, including the no-script failsafe, in styles/loader.css.
 */
export function Intro() {
  const [first, ...rest] = profile.name.split(" ");
  return (
    <IntroGate>
      <div id="intro" className="intro" aria-hidden="true" suppressHydrationWarning>
        <div className="intro-backdrop" suppressHydrationWarning />
        <div className="intro-stage" suppressHydrationWarning>
          <p className="intro-name display hero-name" suppressHydrationWarning>
            <span className="intro-mask">
              <span style={{ "--i": 0 } as React.CSSProperties}>{first}</span>
            </span>
            <br className="md:hidden" />
            {rest.map((word, index) => (
              <Fragment key={word}>
                {" "}
                <span className="intro-mask">
                  <span style={{ "--i": index + 1 } as React.CSSProperties}>{word}</span>
                </span>
              </Fragment>
            ))}
          </p>
          <span className="intro-rule" suppressHydrationWarning>
            <span className="intro-rule-fill" suppressHydrationWarning />
          </span>
        </div>
      </div>
    </IntroGate>
  );
}
