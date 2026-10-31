# Omjee R Giri — portfolio

Personal engineering portfolio. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · three.js.

The product spec and the reasoning behind the design live in [docs/BLUEPRINT.md](docs/BLUEPRINT.md).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # production build; must pass before deploying
```

## Updating content

Everything the site says lives in `src/content/`. Components never contain facts, so none of
these changes touch layout code.

| I want to… | Edit |
|---|---|
| Replace my résumé | Replace the PDF in the shared Drive folder (see `src/lib/resume.ts`); `public/resume-fallback.pdf` is the offline copy |
| Add a project | Append an object to `src/content/projects.ts` |
| Feature / un-feature a project on the homepage | `featured: true \| false` on that project |
| Hide a project without deleting it | `visible: false` |
| Reorder projects | `order` (lower comes first) |
| Give a project a case-study page | Add a `caseStudy` block — the page appears at `/work/<slug>` |
| Add an internship, role or open-source stint | Append to `experience` in `src/content/experience.ts` |
| Add a skill or a whole domain | `src/content/skills.ts` |
| Change "Now" | `src/content/now.ts` (bump `updated`) |
| Add an achievement | `src/content/achievements.ts` |
| Change name, statement, links, availability | `src/content/profile.ts` |
| Change SEO title / description / nav | `src/content/site.ts` |

| Hide a GitHub repo from the Garage, or recategorise it | `src/content/garage.ts` |
| Change the research signal chain | `src/content/research.ts` |
| Reorder or rename homepage sections | `sections` in `src/content/site.ts` (sector numbers follow) |

### The Garage

The Garage lists public GitHub repositories automatically. A new public repo shows up on the
next revalidation (at most six hours) with no code change. `src/content/garage.ts` is the
curation layer: `GARAGE_HIDDEN` removes a repo, `GARAGE_OVERRIDES` sets a title, description,
category or priority, and forks stay hidden unless an override sets `include: true`.
If the GitHub API cannot be reached, the committed snapshot in that file is used.

### Ask Omjee

The assistant answers only from `src/content/` (plus the Garage and Codeforces data), so
updating content updates its answers — there is no second knowledge base to maintain.
Common questions are answered directly from structured data. With `ANTHROPIC_API_KEY` set,
open-ended questions are synthesised by Claude from retrieved portfolio text; without a key
the assistant still works and returns extracts. See `src/lib/ask/` and `.env.example`.

Rules the content follows (please keep them):

- Every statement should be checkable against a repository or a document. Leave a field out
  rather than estimating it.
- Every project carries an honest `status`. Optional fields really are optional — a project
  with no demo shows no demo button.
- No proficiency percentages.

## Structure

```
src/
  app/            routes, metadata, sitemap, robots, OG image, /api/ask
  content/        typed data (the only place facts live)
  components/
    layout/       Header (sector navigation), Footer, Section frame
    sections/     homepage sectors, in order: Hero, About, Capabilities, Ask, Work,
                  Experience, Garage, Contact
    race/         the race environment: fixed background layer, controller, state store
    work/         programme layouts, figure frame, transitions between programmes
    figures/      SVG figures (pipeline, risk, montage, rating trace, car elevation)
    three/        hero WebGL scene (lazy-loaded)
    motion/       reveal observer, smooth scroll
    ui/           Button, Tag, Icon
  lib/            car geometry, Ask Omjee (retrieval + answers), GitHub, Codeforces, quant maths
  styles/         feature CSS imported by app/globals.css (race, hero, ask, work)
docs/
  BLUEPRINT.md    product blueprint and review history
  RACE-SYSTEM.md  the visual system: palette, environment, transitions, car
```

### The race environment

A fixed layer behind the whole page (`components/race`) draws the atmosphere, track, starting
grid, racing line and sector markers on one canvas. It reacts to scroll position and velocity
through a single state store (`race/store.ts`); sections are transparent windows onto it.
A section joins the system by carrying `data-race-zone="<id>"` — the `<Section>` frame does
this automatically — so adding a sector to `site.sections` and rendering it is enough.

### The hero

The car is original and procedural — defined as lofted cross-sections in `src/lib/car/` — so
there is no 3D asset to download or license. The same geometry renders twice:

1. on the server as a flat SVG side elevation (visible before any JavaScript), and
2. in WebGL as a studio-lit model, loaded when the browser is idle.

Reduced-motion, Save-Data and no-WebGL visitors keep the SVG. In development,
`/?hero=0.5` renders one still frame at that scroll progress, which is handy for screenshots.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it in Vercel. No environment variables are required; `ANTHROPIC_API_KEY` (enables
   synthesised Ask Omjee answers) and `GITHUB_TOKEN` (raises the GitHub rate limit) are
   optional and server-only — add them in Vercel's project settings, never in the repository.
3. After attaching a custom domain, set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) so
   canonical URLs, the sitemap and Open Graph tags use it.

The homepage re-generates at most once a day to refresh the Codeforces rating; if that API is
unreachable, the snapshot in `src/content/achievements.ts` is used instead.
