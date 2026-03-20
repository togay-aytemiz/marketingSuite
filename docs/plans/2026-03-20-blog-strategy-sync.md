# Blog Strategy Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make blog topic ideation and blog generation use live Sanity history plus Leadqualifier PRD/ROADMAP context, then publish/link content to Sanity in a Qualy-compatible way.

**Architecture:** Add a server-side strategy-context loader that reads neighboring `leadqualifier` / `Qualy-lp` docs and produces a compact feature brief for prompts. Extend blog AI flows to use (1) recent Sanity topics for novelty and (2) relevance-ranked internal link candidates for natural linking. Keep frontend changes minimal by extending existing payloads.

**Tech Stack:** React 19, TypeScript, Express, Gemini SDK, Sanity HTTP API, Node test runner (`node --test` via `tsx`)

---

### Task 1: Lock behavior with tests first (TDD)

**Files:**
- Create: `tests/server/strategy-context.test.ts`
- Modify: `tests/server/sanity.test.ts`

**Step 1: Write failing parser tests**

Add tests for:
- extracting update notes from PRD/ROADMAP markdown
- extracting in-scope feature names from the PRD scope table
- extracting completed roadmap checklist entries

**Step 2: Write failing Sanity normalization tests**

Add tests for:
- preserving `publishedAt` on normalized posts
- preserving category title/slug fallback when available

**Step 3: Run tests to verify RED**

Run: `npm test`  
Expected: new tests fail because helper(s) and field mappings are not implemented yet.

### Task 2: Build Leadqualifier strategy context loader

**Files:**
- Create: `src/server/strategy-context.ts`
- Modify: `server.ts`

**Step 1: Implement doc discovery**

Support candidate roots in this order:
- `../leadqualifier/docs`
- `../desktop/leadqualifier/docs`
- `../Qualy-lp/docs`

Load `PRD.md` and `ROADMAP.md` when present.

**Step 2: Implement summary extraction**

Extract:
- product title
- latest update notes
- in-scope feature names
- completed roadmap checklist highlights
- deduplicated focus keywords

Expose a compact prompt-ready text block for AI actions.

**Step 3: Add a lightweight debug endpoint**

Add `GET /api/strategy/context` returning availability + source path + extracted highlights.

### Task 3: Improve Sanity post normalization for recency-aware strategy

**Files:**
- Modify: `src/server/sanity.ts`
- Modify: `src/services/sanity.ts`

**Step 1: Extend normalized post shape**

Include:
- `publishedAt`
- `_updatedAt`

**Step 2: Keep query ordering and map fields**

Ensure post query returns these fields so recent-topic logic can rely on explicit timestamps.

### Task 4: Inject strategy context + recent history into topic ideation

**Files:**
- Modify: `src/server/gemini.ts`
- Modify: `server.ts`
- Modify: `src/services/gemini.ts`
- Modify: `src/components/Sidebar.tsx`

**Step 1: Extend generate-topic input**

Send recent post summaries (title, excerpt, category, publishedAt) instead of only titles.

**Step 2: Enrich topic prompt**

Use:
- recent post list for “avoid repetition / suggest next logical angle”
- strategy context text from PRD/ROADMAP
- existing generated ideas

**Step 3: Keep response contract stable**

Return same `{ topic, keywords }[]` shape to avoid UI breakage.

### Task 5: Relevance-rank internal links for blog generation/edit/linking

**Files:**
- Modify: `src/server/gemini.ts`
- Modify: `src/components/BlogPreview.tsx`

**Step 1: Add relevance helper**

Rank Sanity posts by lexical overlap + recency and dedupe by slug.

**Step 2: Apply helper to all link-aware AI actions**

Use top candidates in:
- `generateBlogPost`
- `editBlogPost`
- `addInternalLinks`

This ensures links are pulled from the most suitable Qualy-lp Sanity posts.

### Task 6: Verification and documentation

**Files:**
- Modify: `README.md`

**Step 1: Document new behavior**

Add notes for:
- PRD/ROADMAP auto-context discovery paths
- optional strategy context endpoint
- recent-topic/internal-link behavior

**Step 2: Run full verification**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: all pass.
