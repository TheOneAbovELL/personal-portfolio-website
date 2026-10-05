"use client";

import { useEffect, useRef, useState } from "react";
import { PIPELINE, PROFILES, type ProfileId } from "@/content/pipeline";
import { prefersReducedMotion } from "@/lib/motion";

const STEP_MS = 1100;
const LOOP_PAUSE_STEPS = 2;

/**
 * FIG. 02 — the Legal Lens request pipeline.
 *
 * Every stage is always visible (it is a plain ordered list). Two things are interactive:
 * the complexity selector, which changes the profile-dependent parameters, and the signal,
 * which steps through the stages while the figure is on screen.
 *
 * Colour is semantic: teal for the values the profile sets, racing yellow for what is active
 * (the selected profile, the stepping signal), and red only on the stages that can end a
 * request — the gates.
 */
export function PipelineFigure() {
  const [profile, setProfile] = useState<ProfileId>("balanced");
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Step the signal through the pipeline only while the figure is visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const total = PIPELINE.length + LOOP_PAUSE_STEPS;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % total);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const current = PROFILES.find((item) => item.id === profile)!;

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <p id="pipeline-complexity" className="label text-steel">
          Query complexity
        </p>
        <div role="group" aria-labelledby="pipeline-complexity" className="flex">
          {PROFILES.map((item) => {
            const selected = item.id === profile;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setProfile(item.id)}
                className={`label -ml-px min-h-9 border px-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] first:ml-0 ${
                  selected
                    ? "relative z-10 border-signal text-signal"
                    : "border-rule-strong text-steel hover:text-bone"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <ol className="relative border-b border-rule">
        {PIPELINE.map((stage, index) => {
          const on = index === active;
          const firstOfGroup = index === 0 || PIPELINE[index - 1].group !== stage.group;
          return (
            <li
              key={stage.id}
              className={`grid grid-cols-[1.75rem_1fr] items-baseline gap-x-3 border-t py-2.5 sm:grid-cols-[5rem_1.75rem_9rem_1fr_auto] ${
                firstOfGroup ? "border-rule-strong" : "border-rule"
              }`}
            >
              {/* The phase a stage belongs to, named once where the phase begins. */}
              <span className="label hidden text-data sm:block">{firstOfGroup ? stage.group : ""}</span>

              <span className="relative flex items-center">
                <span
                  aria-hidden="true"
                  className={`absolute -left-3 top-1/2 h-px -translate-y-1/2 bg-signal transition-[width,opacity] duration-[var(--dur-base)] ease-[var(--ease-out)] ${
                    on ? "w-2 opacity-100" : "w-0 opacity-0"
                  }`}
                />
                <span
                  className={`label transition-colors duration-[var(--dur-fast)] ${on ? "text-signal" : "text-faint"}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>

              <span className="flex items-baseline justify-between gap-3 sm:block">
                <span
                  className={`text-[0.9375rem] font-medium transition-colors duration-[var(--dur-fast)] ${
                    on ? "text-signal" : "text-bone"
                  }`}
                >
                  {stage.name}
                </span>
                {firstOfGroup && <span className="label text-data sm:hidden">{stage.group}</span>}
              </span>

              <span className="col-start-2 text-[0.875rem] leading-snug text-steel sm:col-start-4">
                {stage.description}
              </span>

              {stage.value && (
                <span className="label col-start-2 mt-1 text-data sm:col-start-5 sm:mt-0 sm:text-right">
                  {stage.value[profile]}
                </span>
              )}
              {stage.gate && (
                <span className="label col-start-2 mt-1 flex items-center gap-2 text-perf-bright sm:col-start-5 sm:mt-0 sm:justify-end">
                  <span aria-hidden="true" className="gate-mark" />
                  Gate
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="sr-only" aria-live="polite">
        Showing the {current.profile} retrieval profile, used for {current.label.toLowerCase()} queries.
      </p>
    </div>
  );
}
