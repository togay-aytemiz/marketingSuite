# Marketing Suite

Local-first content and visual generation tool. This app now runs with its own local Express backend, so Gemini and Sanity credentials stay on your machine and are never exposed to the browser bundle.

## Prerequisites

- Node.js 20.19+ recommended
- `npm install`

## Local Setup

1. Copy [.env.local.example](./.env.local.example) to `.env.local`
2. Fill only the keys you have right now
3. Start the app with:

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000) by default.

## What Works Without Keys

- The UI opens normally
- Product context, manual editing, prompt preview, and local state persistence work
- AI buttons stay visible but are disabled until `GEMINI_API_KEY` exists
- Sanity fetch/publish stays disabled until Sanity env vars exist

## Required Env Vars

### Gemini

- `GEMINI_API_KEY`

Without this key, all AI actions are disabled:

- visual generation
- copy ideas
- topic brainstorming
- blog writing
- SEO analysis
- image generation
- AI editing

### Sanity

- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_TOKEN`

Supported aliases:

- `SANITY_API_TOKEN`
- `SANITY_API_KEY`

With Sanity configured, the app can:

- fetch categories
- fetch existing posts for internal links and topic avoidance
- publish TR and EN blog entries

### Strategy Context Auto-Discovery (Leadqualifier / Qualy)

Blog topic and blog writing prompts automatically try to load product strategy context from nearby docs:

- `../leadqualifier/docs/PRD.md` + `../leadqualifier/docs/ROADMAP.md`
- `~/Desktop/leadqualifier/docs/PRD.md` + `~/Desktop/leadqualifier/docs/ROADMAP.md`
- fallback: `../Qualy-lp/docs/PRD.md` + `../Qualy-lp/docs/ROADMAP.md`

When found, the app injects extracted update notes, in-scope features, and roadmap highlights into AI prompts. This keeps topic suggestions and generated posts aligned with real product capabilities.

You can inspect what was detected via:

```bash
curl http://localhost:3000/api/strategy/context
```

Blog internal-link prompts now also rank Sanity posts by relevance + recency, so links are biased toward the most suitable Qualy blog articles instead of random matches.

### Optional Qualy Auto-Refresh

- `QUALY_LP_PATH`

If this points to your local `Qualy-lp` project, every successful Sanity publish also runs:

```bash
npm --prefix "$QUALY_LP_PATH" run blog:generate
```

That refreshes the local Qualy blog artifacts immediately after publish. If `QUALY_LP_PATH` is missing, publish still goes to Sanity; only the local static refresh is skipped.

## Verification

```bash
npm test
npm run lint
npm run build
```
