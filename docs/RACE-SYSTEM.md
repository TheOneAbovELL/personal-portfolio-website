# Race system — design specification (v3)

Internal spec for the third pass. It defines the visual system that turns the site from
"a portfolio with an F1 car" into one continuous motorsport-engineering environment, and the
contracts that keep the pieces coherent. Hierarchy never changes:
**Omjee → engineering → evidence → motorsport language → 3D and motion.**

Reference for transitions: sites built as a fixed, persistent canvas behind transparent
sections, smooth scroll, scroll-scrubbed reveals and clip-path wipes (e.g. landonorris.com).
We take the technique, not the look. No team logos, liveries or trademarks.

## 1. Colour tokens (implemented in `src/app/globals.css`)

| Token (Tailwind class stem) | Hex | Meaning |
|---|---|---|
| `carbon` `graphite` `graphite-2` `graphite-3` `gunmetal` `metal` `metal-2` `metal-3` | `#07090B` → `#4D575D` | structure, the physical environment |
| `navy` `navy-2` | `#0A1826` `#0F2236` | the deep technical environment |
| `bone` | `#E9E7E1` | identity and content |
| `steel` `faint` | `#8F989E` `#7B858B` | supporting information |
| `signal` (`signal-bright`) | `#F2C230` | racing yellow — active state, selection, navigation, telemetry |
| `data` | `#3CCFC0` | technical teal — intelligence, systems, AI, data, research |
| `perf` (`perf-bright` for text) | `#D7262F` (`#F0525A`) | performance red — intensity, major transitions |
| `papaya` | `#FF7A1A` | the experimental; rare |
| `rule` `rule-strong` | hairlines | |

Principles: silver/teal = precision, navy/yellow = energy, red = intensity. Colour arrives as
**light** (atmosphere, rim light, a lit line), not as filled blocks. Never more than two accents
in one view. `perf` is not legible at small sizes — use `perf-bright` for text.

## 2. Page structure (implemented)

```
00 hero · 01 about · 02 capabilities · 03 ask · 04 work (Legal Lens → qEEG → ARGUS, then
research/direction, anchor #research) · 05 experience (paper) · 06 garage · 07 contact
```
Sector numbers derive from `site.sections`. Every zone element carries
`data-race-zone="<id>"` (`hero` included).

## 3. Background layers (`src/components/race`, `src/styles/race.css`)

A fixed layer behind the whole page, z-index −1. Sections are transparent windows onto it;
only panels and the paper section are opaque.

```
1 atmosphere   CSS gradients on .race-atmos, colours driven by custom properties
2 track        faint track-edge lines following the racing line's corridor   (canvas)
3 grid         starting-grid slots near sector boundaries                    (canvas)
4 racing line  one path down the whole page                                  (canvas)
5 markers      sector labels, apex ticks, short kerb marks at boundaries     (canvas)
6 telemetry    sweeps shown only while the interface reports activity        (canvas)
```
One 2D canvas, sized to the viewport. Content readability > navigation > environment.

## 4. Environment state (`src/components/race/store.ts` — contract, do not break)

`race.getState()`, `race.subscribe(fn)`, `race.setState(next)` (controller only),
`race.setActivity(0..1)`, `race.onWake(fn)`. State: `zone`, `sectorIndex`, `zoneProgress`,
`pageProgress`, `sectors[]`, `velocity`, `energy`, `boundary`, `activity`, `reducedMotion`.
Components state facts ("a query is in flight"); the controller decides how that looks.

- `velocity`: scroll speed in viewport-heights/second, exponentially smoothed.
- `energy`: 0→1, rises quickly with |velocity|, decays slowly (inertia). Never mapped raw.
- `boundary`: 0→1 proximity of the nearest sector boundary to the reading line (50% vh).
- All visual parameters are interpolated from these — nothing switches from 0 to 1.

## 5. Zone palettes (atmosphere and line colour interpolate across boundaries)

| Zone | Environment | Base → deep | Light A | Light B | Line style |
|---|---|---|---|---|---|
| hero | automotive studio | graphite → navy | teal edge | red warmth (faint) | plain |
| about | cool engineering room | graphite | teal | silver | telemetry trace |
| capabilities | control room | graphite → navy | teal | yellow | circuit steps |
| ask | data room | navy | teal | yellow (faint) | query ticks |
| work | engineering lab | graphite | teal, then blue, then green by programme | red (faint) | signal |
| experience | printed document | — opaque paper; the line passes behind | | | hidden |
| garage | workshop | gunmetal | yellow | silver | fragments (dashes) |
| contact | night pit lane | warm graphite | red | yellow | straight to the finish |

## 6. Racing line

One deterministic path in page coordinates built from zone rectangles. It runs in the gutters
beside content and crosses the viewport in the whitespace at sector boundaries (long S-curves:
"corners"). Resting opacity is very low; the stretch around the reading line is lit in the
zone's accent and travels with scroll. It may be dashed, pass behind panels, vanish behind the
paper section and reappear. Apex ticks at corners. Never brighter than content.

## 7. Grid and sector crossing (the signature transition)

Driven by `boundary` and `energy`, fully reversible, no timers:
1. grid slots (open-backed brackets in two staggered files) fade up near the boundary,
2. they align to the corridor, 3. the sector marker (`SECTOR 03` + hairline + short kerb) lights,
4. the lit stretch of the racing line crosses the viewport, 5. the next section's light arrives,
6. the grid falls back to near-invisible. Faster scroll → more energy → slightly more
displacement and brightness, then it settles. Different depths move at different rates.

## 8. Transition vocabulary (each has one job)

| Name | Where | What |
|---|---|---|
| `GRID_FORMATION` + `SECTOR_PASS` | every sector boundary | §7 |
| `RACING_LINE` | whole page | §6 |
| `TELEMETRY_SWEEP` | while Ask Omjee is retrieving | a light runs the line; grid stirs |
| `DATA_MORPH` | between programmes | documents → signal; waveform → chart; chart → grid |
| `mask` `snap` `trace` `rise` `settle` | inside sections | the existing motion grammar |
| hero drawing → object → traces | hero | existing |

## 9. Car and studio (`src/lib/car`, `src/components/three`, `src/styles/hero.css`)

Target: automotive studio photography of an original prototype. Graphite and carbon with
silver; accents are small and real: yellow T-camera and tyre compound band, a teal pinstripe,
a red rain light. Colour comes from light: neutral cool key, **teal rim**, restrained **red
kicker**, soft floor bounce. Carbon has weave and roughness variation; tyres have sidewall
detail and contact patches; cockpit has an opening, headrest, steering wheel, helmet with visor.
Floor reflection is soft, never mirror-like. Camera: three-quarter, slight idle drift, small
perspective shift on scroll, never an orbit. The studio fades (`--hero-fade`) as the hero
leaves so the race environment takes over; `data-past` hides it afterwards.

## 10. Responsive and reduced motion

- **Mobile**: canvas at DPR 1; one line on the right edge; fewer grid slots; no far track
  edges; sector bar stays; programme morphs shorter; hero car as today.
- **Reduced motion**: atmosphere colours still change with position; canvas draws a static
  line and markers with no travelling light, velocity response or parallax; no morph scrubbing
  (static mid-state); hero stays the drawing.

## 11. Performance rules

One `requestAnimationFrame` loop in the controller, running only while something is changing.
No layout reads inside it except `window.scrollY`; zones are measured on resize/ResizeObserver.
Canvas work scales with the viewport, not the page. CSS custom properties are written on the
`.race-env` element, never on `:root`. No DOM nodes per grid slot. Heavy modules are imported
after idle. three.js stays in its own lazy chunk.

## 12. Honesty

Every number on screen is counted from content or fetched. No lap times, speeds, telemetry,
uptime or accuracy. Sector labels number real sections. The qEEG work is a research prototype
and says so wherever it appears.
