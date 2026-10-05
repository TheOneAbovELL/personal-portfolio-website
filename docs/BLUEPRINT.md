# Portfolio Product Blueprint

**Omjee R Giri — personal engineering portfolio**
Status: living document · Last revised 2026-10-05

This is the product spec the codebase is built against. It records what the site is for, the
decisions that shape it, and — where they differ from the original brief — why.

---

## 0. Audit findings (what exists today)

| Area | Finding |
|---|---|
| Repository | Empty folder, not a git repo. Greenfield — nothing to preserve. |
| Assets | One résumé PDF. No images, no 3D models, no brand assets. |
| Public GitHub (`TheOneAbovELL`) | 19 repos. `legal-lens-backend` and `ARGUS` have real code, tests and docs. `Agentic-Precision-Psychiatry-System` is an **empty repository**. |
| Codeforces (`The0NEAboveALL`) | **Specialist, rating 1411** (13 rated contests, May 2025 → Sep 2026). The brief says "Pupil" — the live API and the résumé both say Specialist. Site uses the live value. |
| GSSoC 2026 | **7 merged PRs** verified on `viru0909-dev/nyay-setu-working` (#222, #406, #484, #507, #561, #582, #778). |
| Legal Lens stack | Brief and repo agree (FastAPI, LangGraph, Qdrant, BGE-M3, Groq). The résumé describes an older Neo4j-centred iteration. Site follows the repo. |

**Content rules derived from the audit**

1. The repo is the source of truth; the résumé is second; the brief is third.
2. Countable, checkable facts are shown (7 merged PRs, 19 channels, 13 rated contests).
   Estimated percentages from the résumé ("~40% less irrelevant retrieval", "~99.5% uptime")
   are **not** shown: the Legal Lens README itself says its quality numbers are fixture-only.
3. The qEEG project has no public code. It is presented as a research prototype, described
   from the résumé, with no repository link and an explicit not-clinically-validated note.
4. Phone number is never rendered on the site (it remains inside the résumé PDF — see Risks).

---

## 1. Product vision

A long-lived personal platform that makes one argument: **Omjee builds intelligent systems and
understands the engineering underneath them.** Everything on the site is either that claim, or
evidence for it. The site should still make complete sense with every motorsport reference
removed.

## 2. Target audience

| Visitor | Time budget | Needs |
|---|---|---|
| Recruiter / hiring coordinator | 10–30 s | Who, what role, résumé, contact. |
| Engineering manager / senior engineer | 1–3 min | Evidence of depth: architecture, decisions, trade-offs. |
| Research supervisor / collaborator | 2–5 min | Research direction, rigor, honesty about status. |
| Future Omjee | 5 min, every few months | Add a project, swap a résumé, change "currently". |

## 3. Personal positioning

> An engineer working where machine learning meets systems — interested in the whole path from
> data to deployed application, not only the model in the middle.

Deliberately not a job title. The same positioning survives a move toward ML engineering,
backend, research engineering or quantitative work.

## 4. Core narrative

Identity → how he thinks → what he can do → proof → where he is going → how to reach him.
Projects are evidence for the identity, never the opening statement.

## 5. Information architecture

```
/                     Home (single scroll)
  00 Hero             identity, role, statement, CTAs
  01 About            the engineer + the data→application philosophy
  02 Capabilities     six domains, each tied to project evidence
  03 Selected work    three featured projects, each with a bespoke figure
  04 Now              building / researching / exploring
  05 Experience       roles, open source, education
  06 Recognition      Codeforces (live), GSSoC
  07 Contact
/work                 Full archive (featured + everything else, grouped)
/work/[slug]          Engineering case study per project
/resume.pdf           Replaceable static file
```

Labels are conventional (About, Work, Experience, Contact). The theme lives in the visuals,
not in the navigation.

## 6. Section-by-section purpose

| Section | The one thing it must do |
|---|---|
| Hero | Name + what he is, readable before any JS or 3D loads. |
| About | Sound like a real engineer; state the systems-over-models philosophy once. |
| Capabilities | Show range without a keyword wall; every domain points at proof. |
| Selected work | Three projects, each answering what / why / how / status at a glance. |
| Now | Give the portfolio a direction and a date stamp. |
| Experience | Roles and contributions with verifiable links (merged PRs). |
| Recognition | Two or three facts, no trophy wall. |
| Contact | One obvious action. |

## 7. Content strategy

- All copy lives in `src/content/*.ts` as typed data. Components never contain facts.
- Specificity over adjectives. No "passionate", "world-class", "revolutionary".
- Every project carries an explicit `status` (Active, Research prototype, Prototype, …).
- Optional fields are genuinely optional: no demo → no button; no metrics → no metrics block.
- Illustrative graphics are labelled as illustrative. No fake live data anywhere.

## 8. Engineering DNA (capabilities)

Six domains, taken from the brief's skill tree: **AI / ML · AI systems · Software engineering ·
Data · Research · Quantitative.** Each renders as: a one-line summary, the tools/concepts, and
*evidence* — the project where it was used and what was built with it. No percentages, no
proficiency bars. Adding "Rust" later is a one-line edit to `skills.ts`.

## 9. Project hierarchy

| Tier | Projects | Treatment |
|---|---|---|
| Featured | Legal Lens · ARGUS · qEEG subtyping | Home section + bespoke figure + case study |
| Archive | Recommendation engine and other verified repos | Compact rows on `/work` |
| Hidden | Anything with `visible: false` | Kept in data, not rendered |

`featured`, `order` and `visible` are data flags — moving ARGUS off the homepage is one boolean.

## 10. The motorsport metaphor — "one line"

Rather than garages, pit walls and timing towers, the site borrows a single idea from racing:
**the line.** The racing line is the best path through a system. A telemetry trace is a line.
A retrieval pipeline, an EEG channel, a rating history — all lines.

- The hero car begins as a **drawing made of flow lines**, becomes a lit object, and relaxes
  back into lines on scroll: drawing → object → signal.
- One accent colour is reserved for "the signal" — the single line that matters in each view.
- Every graphic is a numbered figure (FIG. 01, FIG. 02 …) with an honest caption.
- Section names stay plain. Nothing needs decoding.

Rejected: literal pit-wall dashboards (invites fake data), team-style liveries (IP + fan-site
feel), "Driver Profile / Race History" naming (cute, slower to parse).

## 11. 3D strategy

- **One** 3D moment: the hero. Everywhere else is SVG.
- The car is original and procedural: lofted cross-sections, lathed tyres and swept tubes
  defined in TypeScript. **Zero asset downloads**, no GLB, no textures, no licensing.
- The same geometry code renders a static SVG elevation on the server, so the drawing is in the
  HTML before any JavaScript runs. WebGL then takes over and turns the drawing into an object.
- In WebGL the car is physically shaded — clear-coated graphite paint, rubber, carbon — under a
  procedural studio environment with a key light, a rim light and a floor contact shadow.
  (Revised after owner feedback: the first version was line-art only and read as too abstract.)
- Scroll returns the car to its side elevation and relaxes its lines into flat traces as About
  arrives.
- three.js only (no React Three Fiber / Drei): the scene is one imperative object with a
  scroll-driven camera; R3F would add weight and a reconciler without removing any code.
- Loaded with a dynamic import after first paint; rendering pauses off-screen and in
  background tabs. Skipped entirely for `prefers-reduced-motion`, Save-Data and no-WebGL.

## 12. Motion strategy

One motion system, defined as tokens (`src/lib/motion.ts` + CSS variables):

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 180 ms | hover, focus, small state changes |
| `--dur-base` | 480 ms | reveals, panel changes |
| `--dur-slow` | 900 ms | hero entrance, line draw-on |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | everything entering |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | things that move and stay |
| stagger | 60 ms | sibling reveals |
| reveal distance | 16 px | never more |

Rules: content is visible without JS; reveals only *add* polish. No scroll-jacking, no pinned
intro, no custom cursor, no loading screen, no parallax beyond the hero camera.
Implementation is CSS + IntersectionObserver + one small scroll-progress utility. Lenis adds
inertial scrolling for fine pointers only (touch keeps native scrolling); **no GSAP** (see §24).

## 13. Typography

- **Archivo** (variable, weight + width axes) for display *and* body. Expanded width for
  display gives the automotive voice; normal width keeps body text highly readable.
- **IBM Plex Mono** for labels, figure captions and technical readouts.
- Two families, self-hosted through `next/font` (no layout shift, no third-party request).

## 14. Colour system

| Token | Value | Role |
|---|---|---|
| `carbon` | `#0A0B0D` | page background |
| `graphite` | `#111316` / `#171A1E` | surfaces |
| `rule` | `#23272D` / `#353B44` | hairlines |
| `bone` | `#ECE9E2` | primary text |
| `steel` | `#9BA1AB` | secondary text (7.5:1) |
| `signal` | `#FFAE1A` | the one accent — amber |

Accents considered: signal red (reads Ferrari / fan site), electric blue (generic SaaS),
lime (the current default "AI portfolio" accent), **amber** — instrument illumination and
pit-board yellow, warm against cool carbon, rare in developer portfolios. Amber is used for the
signal line, focus rings, active states and nothing else.

## 15. Component architecture

```
src/
  app/            routes, metadata, sitemap, robots, OG image
  content/        typed data: profile, projects, skills, experience, education,
                  achievements, now, site  (+ types.ts, selectors in index.ts)
  components/
    layout/       Header, Footer, SectionHeading, TraceRail
    sections/     Hero, About, Capabilities, SelectedWork, Now, Experience,
                  Recognition, Contact
    work/         ProjectFeature, ProjectRow, CaseStudy blocks
    figures/      PipelineFigure, RiskFigure, MontageFigure, RatingTrace, CarElevation
    three/        HeroCanvas (client boundary) + scene modules
    ui/           Button, Tag, StatusBadge, Icon, ExternalLink
    motion/       Reveal
  lib/            car geometry (pure), motion tokens, utilities
```

Server Components by default. Client boundaries only where there is real interactivity:
navigation state, the hero canvas, the pipeline figure, reveal observer.

## 16. Technical architecture

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · three.js · Lenis.
- Fully static output except one ISR fetch (Codeforces rating, daily, with a committed
  snapshot as fallback). No database, no CMS, no auth, no API routes, no environment secrets.
- Local TypeScript content was chosen over MDX/CMS: typed, refactor-safe, zero runtime cost,
  and the content volume is small. MDX can be added per case study later without restructuring.

## 17. Performance strategy

- Budget: LCP < 1.8 s on 4G mid-range mobile, CLS ≈ 0, first-load JS for `/` < 130 kB gz
  excluding the lazy three.js chunk.
- LCP element is hero text — server-rendered, font preloaded.
- three.js is the only heavy dependency and is off the critical path.
- No raster images in the UI at all; every graphic is SVG or WebGL lines.
- Measure with `next build` output + Lighthouse before calling anything done.

## 18. Accessibility strategy

Semantic landmarks and one `h1` per page; skip link; visible amber focus ring; all figures have
text equivalents (the pipeline is a real ordered list); canvas is `aria-hidden`; contrast ≥ 4.5:1
for all text; full keyboard operation; `prefers-reduced-motion` removes camera motion, draw-on
and reveals while keeping layout identical.

## 19. Mobile strategy

Designed, not shrunk: text-first hero with the car as a lower-half backdrop; capped pixel ratio;
single-column sections; the pipeline figure becomes a vertical list; nav becomes a full-screen
sheet with large targets; résumé and contact are always one tap away.

## 20. SEO strategy

Metadata API (title template, description, canonical), Open Graph + Twitter image generated
with `next/og`, `sitemap.ts`, `robots.ts`, JSON-LD `Person`, real heading hierarchy, descriptive
link text. Target queries: the name, plus honest descriptors. No keyword stuffing.

## 21. Development roadmap

| Phase | Deliverable | State |
|---|---|---|
| 0 | Audit | done |
| 1–4 | Blueprint, direction, design system, IA | this document |
| 5 | Hero prototype (type, poster, WebGL, scroll) | done |
| 6 | Content layer + all home sections + `/work` + case studies | done |
| 7 | Motion pass | done |
| 8 | Polish: visual, UX, content, performance, a11y, mobile | first pass done |
| 9 | `lint` + `build` clean, README for future edits | done |
| 10 | Push to GitHub, Vercel preview, Lighthouse on the deployed URL | owner |

## 22. Risks

| Risk | Mitigation |
|---|---|
| Procedural car looks amateur | Lines only, hidden-line removal, low contrast; judged in-browser, replaced by the static elevation if it does not clear the bar. |
| Theme overwhelms identity | Name is the LCP; car is ≤ 40% line opacity; one accent. |
| Claims that cannot be defended in an interview | Repo-verified facts only; estimates left out. |
| qEEG read as a medical product | "Research prototype — not clinically validated" on every surface it appears. |
| Résumé PDF exposes a phone number publicly | Flagged for the owner; swap `public/resume.pdf` for a web version. |
| Project folder lives inside OneDrive | `node_modules` / `.next` sync churn and file locks; recommend moving the repo outside OneDrive. |
| Codeforces API unavailable at build | Snapshot fallback in content. |

## 23. Opportunities

- Real, self-updating data as "telemetry": the Codeforces rating trace.
- Verifiable open-source work: each merged PR is a link.
- Case studies can grow into long-form writing (MDX) without a redesign.
- A `/notes` or publications section slots into the same content model later.

## 24. Where this departs from the brief (and why)

1. **"One line" instead of a garage-to-grid journey.** A single motif is more original, cheaper
   to render, and cannot turn into a fan site.
2. **A car drawn from flow lines instead of a glossy model.** No asset to license or download,
   instant load, and it reads as engineering rather than merchandise.
3. **Server-rendered drawing → WebGL object.** The hero is complete before JavaScript; 3D is
   an upgrade, never a dependency.
4. **No GSAP, no R3F, no Lucide.** CSS transitions, IntersectionObserver and ~100 lines of
   TypeScript cover every motion requirement here. Lenis is the one motion dependency, kept
   because inertial wheel scrolling was explicitly requested and it is small.
5. **Live Codeforces data** rather than a hard-coded badge, so the site does not go stale.
6. **Estimated metrics removed.** The portfolio is stronger when every number survives a
   follow-up question.
7. **Conventional section names.** "Experience", not "Race History".

---

## 25. Version 2 — art direction pass (2026-10)

The first version read as "premium dark portfolio + a car". Version 2 moves the motorsport
engineering language out of the hero and into the whole system, without renaming anything a
recruiter needs to find. Sections 5, 12, 14 and 21 above describe v1; this section supersedes
them where they differ.

### 25.1 Information architecture

```
00 Hero            identity; system readout; instrument row (real counts, each a link)
01 About           engineering philosophy; the working loop; the data → application path
02 Capabilities    setup-sheet console: select a domain, its evidence lights up
03 Work            featured engineering — three programmes, each with its own figure
04 Research        signal chain for the qEEG study; building / researching / exploring
05 Ask             Ask Omjee — grounded query console over this site's content
06 Experience      timeline; education; recognition; live Codeforces trace
07 Garage          every other public repository, synced from GitHub, lightly curated
08 Contact         the system resolves into one warm light and one action
```

Sector numbers are derived from `site.sections`; reordering that array renumbers everything.

### 25.2 Colour is semantic

| Token | Value | Means |
|---|---|---|
| carbon / graphite / metal | `#07090B` → `#394146` | the environment |
| bone | `#E9E6DE` | identity and content |
| steel / faint | `#8D959A` / `#747D83` | supporting information |
| **signal** (amber) | `#F5A623`, bright `#FFC247` | performance, action, the active state, the racing line |
| **data** (cyan) | `#38D6C5` | data, intelligence, research, links between systems |
| **warn** (red) | `#FF4D4D` | limits and exceptional states only (archived, errors, the research disclaimer) |

Each section carries a `tone` that sets its ambient light (amber, cyan, steel, dual, heat).
Depth comes from gradients, a film-grain layer, top-lit "machined" panels and a carbon weave
used on thin strips only. No textures are loaded.

### 25.3 Motion grammar

| Behaviour | Used for | Curve |
|---|---|---|
| `mask` | large type, clipped from below | ramp then settle |
| `snap` | instrumentation, markers, hover states | short, mechanical |
| `trace` | sector lines, connectors | drawn left to right |
| `rise` | body copy | soft deceleration |
| `settle` | figures and panels | slight overscale, long inertia |
| `flow` | a light travelling along lines that carry data | continuous |

Sections never share one entrance: the sector line traces, the label snaps, the title unmasks,
the copy rises, the figure settles. Hover states use the snap curve and move a marker or an
arrow — nothing scales.

### 25.4 Recurring devices

- **Sector line** — an engineering scale with the racing line drawn over it; opens every section.
- **Sector rail** (very wide screens) and numbered navigation — where you are in the lap.
- **Readouts** — every number shown is counted from content or fetched (domains, programmes,
  repositories, rating). There is no decorative telemetry.
- **Figures** — numbered, captioned, and honest about what is illustrative.

### 25.5 The car

Cool key and sky fill against a warm amber rim; clear-coated graphite paint; a mirrored
reflection under a dark veil; a warm pool of light with a contact shadow. Its role shrinks as
the page proceeds: it returns to a drawing, relaxes into traces, and is not used again.

### 25.6 Garage

`GitHub API → server fetch (ISR, 6 h) → curation → board`. New public repositories appear
without a code change. `src/content/garage.ts` holds what to hide, category, priority and
better descriptions; a committed snapshot is the fallback. `GITHUB_TOKEN` is optional and
server-only.

### 25.7 Ask Omjee

`content → knowledge index → lexical retrieval → direct answer | Claude synthesis | extract`.
One source of truth: the index is built from the same content modules the pages render.
Simple questions are answered from structured data with no model call. The model, when used,
sees only retrieved portfolio text and must say when something is not documented. Server-side
only; best-effort rate limiting; works with no API key at all.

### 25.8 Self-review against the brief

| Question | Answer |
|---|---|
| Understandable in 5–10 s? | Yes — name, discipline and statement are server-rendered text. |
| Does the F1 language continue after the hero? | Yes — sector lines, readouts, timing-sheet tables, signal chains, the loop. |
| Is it an F1 fan site? | No — no flags, liveries, numbers or racing vocabulary in navigation. |
| Does it work without 3D / JS / the assistant? | Yes — SVG drawing, visible content, direct links. |
| Known weak spots | Hero animation and Lighthouse still need a real-browser pass; the car is procedural, so its surfacing is simpler than a modelled asset. |

---

## 26. Rendered review (2026-10) — what was checked, what changed, what is left

Reviewed from screenshots of the production build at 1440 and 1920 px, and at 375 px in a
mobile viewport, not from source. Changes made as a result are listed under FIX and REMOVE.

### Decisions added in this pass

- **One printed section.** Experience is set on paper (`surface="paper"`): the record of roles,
  education and rating reads as a technical document and breaks the run of dark sections. It is
  done by re-scoping the colour variables, so no component knows about it. Amber and cyan
  become inks, deepened to hold 4.5:1.
- **Tempo.** The motion grammar is shared, but each section scales it (`--tempo`): About is
  unhurried, Capabilities and Work are quick and mechanical, Research is measured, the Garage
  is fast, Contact is the slowest thing on the page.
- **No gradient text, no glow on print, no card grid.** The contact headline is solid with an
  amber full stop; principles are open columns; glows exist only where something is "lit".
- **Verified links.** Garage demo links are requested at build/revalidation time and dropped if
  they do not resolve, and a curated `demo: false` hides a homepage that is not Omjee's own.

### KEEP

- The hero: name as the dominant element, the car as a dark studio object beneath it, the
  drawing-to-object hand-off, real instrument counts that link into the page.
- The engineering statement as the About headline.
- Capability → evidence console; the shared evidence board makes the relationship visible.
- Programmes with their own figures (pipeline, risk, montage) and honest captions.
- The Garage as a timing sheet, synced from GitHub, visibly secondary to the programmes.
- Ask Omjee as a query console with sources and cards rather than chat bubbles.
- Sector lines, numbered navigation, readouts counted from content.

### FIX (done in this pass)

- Section headings never appeared: the masked reveal clipped the observed element itself.
- Hero name wrapped to two lines beside the system readout; readout now sits clear of it.
- Flat carbon parts and the helmet flared under the amber rim light; materials and light retuned.
- A visible band at every section seam; ambient light now fades in below the sector line.
- Garage rows uneven (separate "Live demo" line, wrapping star count); dead demo links.
- Mobile: instrument row collided with the car; Garage filters wrapped to three rows.
- Content skipped by an anchor jump could stay hidden; anything above the viewport now reveals.
- Rating chart label collided with the latest point; lowest-contrast text raised.

### REMOVE (done in this pass)

- Gradient headline in Contact. The separate "loop" diagram in About (now one line, echoed in
  the footer). Boxed principle cards. Star counts. The third line of the hero readout.

### ELEVATE (worth doing next, in this order)

1. Watch the hero intro and the scroll hand-off in a real browser and tune the timings by eye.
2. The car's surfacing: it is procedural, so the cockpit, wings and suspension are simpler than
   a modelled asset. A commissioned or self-modelled GLB would raise realism further.
3. A single racing line that runs the full length of the page and bends at each sector.
4. Lighthouse and Web Vitals on the Vercel preview; the homepage HTML is ~64 kB gzipped.
5. Mobile length (~24 screens): consider collapsing Garage rows beyond the first six.

### FUTURE (intentionally not built)

- A search overlay — Ask Omjee already answers keyword lookups with cards.
- Sound, a second 3D object, per-project colour themes, a CMS, conversation storage.
- A durable rate-limit store (Upstash / Vercel KV) — add when the assistant sees real traffic.
- An "ORG" team mark — the personal name is the brand; the amber tick + ring is enough.

---

## 27. Version 3 — the race system (2026-10)

Owner feedback on v2: the car was motorsport, the rest was still a premium dark portfolio, and
the palette had collapsed into black, white and one amber accent. Version 3 is specified in
[RACE-SYSTEM.md](RACE-SYSTEM.md) and supersedes §14, §25.1, §25.2 and the per-section
backgrounds described in §25.

What changed in principle:

- **Palette** — an original synthesis of team colour principles: graphite and silver structure,
  technical teal (intelligence), racing yellow (the active state), performance red (intensity),
  deep navy (environment), papaya (experimental, rare). Colour arrives as light.
- **One environment** — a fixed race environment behind transparent sections replaces opaque
  per-section backgrounds: atmosphere, track, starting grid, racing line, sector markers. It
  responds to scroll velocity with inertia and forms a grid as each sector boundary passes.
- **Order** — 01 About · 02 Capabilities · 03 Ask · 04 Work (Legal Lens → qEEG → ARGUS, then
  research and direction) · 05 Experience · 06 Garage · 07 Contact.
- **Programmes** — each has a restrained identity and the transitions between them morph one
  programme's visual language into the next (documents → signal → chart → grid).
- **Ask Omjee** — moved above Work; answers are structured briefs with related systems,
  evidence and actions that navigate the site.
- **Car** — studio photography of an original prototype: carbon weave, real tyres, cockpit,
  small real accents (yellow T-camera, teal pinstripe, red rain light), colour from light.
