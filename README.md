# PolLens

A research console for identifying airborne pollen allergens from microscope
imagery. Upload slide photographs, count and classify the grains on them, and
build a searchable history and a map of where each pollen type is turning up.

Thesis project. Next.js 16 · React 19 · TypeScript · Tailwind CSS v4.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build   # production build
npm start       # serve it
npm run lint    # eslint
npx tsc --noEmit  # typecheck
```

## Documentation

- **[docs/overview.md](docs/overview.md)** — what the app does today, the data
  model, where the seams to a real backend are, and what is still unbuilt.
  Start here.
- [docs/pollen-map.md](docs/pollen-map.md) — the shipped boundary data: where it
  came from, what was missing, and how zoom and search work.
- [docs/allergen-reference-plan.md](docs/allergen-reference-plan.md) — the plan
  for the unbuilt `/dataset` page.
- [AGENTS.md](AGENTS.md) — conventions for anyone writing code here.

## Status

The front end is complete and usable end to end. Not real yet: the detection
model (`lib/analysis.ts` returns deterministic mock readings), sign-in
(`components/SignInForm.tsx` is a stand-in), and the server — reports live in
the browser's IndexedDB, so they do not travel between machines. Each of those
is isolated behind a single module; see the overview for the migration path.
