# Marketing Suite

Local-first content and visual generation tool. This app now runs with its own local Express backend, so OpenAI, Gemini, and Sanity credentials stay on your machine and are never exposed to the browser bundle.

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
- Visual Creator generation stays disabled until both `OPENAI_API_KEY` and `GEMINI_API_KEY` exist
- Blog Writer generation stays disabled until `OPENAI_API_KEY` exists
- Sanity fetch/publish stays disabled until Sanity env vars exist

## Required Env Vars

### OpenAI

- `OPENAI_API_KEY`

Without this key, text and planning actions are disabled:

- Visual Creator copy generation
- Visual Creator prompt planning
- topic brainstorming
- blog writing
- SEO analysis
- internal-link editing
- social post generation

### Gemini

- `GEMINI_API_KEY`

Without this key, image and palette actions are disabled:

- Visual Creator final image rendering
- Visual Creator magic edit image rendering
- color palette extraction
- blog image generation

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

Visual and social-post prompt planning also reads nearby product reality files, including `docs/marketing_product_context.md` and `.agents/product-marketing-context.md`. Keep durable brand, channel, logo, and AI-agent visual rules there so generated social visuals do not drift into unsupported channels, generic assistant labels, or invented product states.

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
