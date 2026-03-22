# Blog Writer Separation Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate article content and media management end-to-end, fix category resolution so Sanity categories are authoritative, and move image generation toward professional editorial visuals.

**Architecture:** The draft contract stays slot-based for publish (`<!-- BLOG_IMAGE:... -->`), but the UI stops rendering inline media inside the article pane. The backend becomes the source of truth for editorial planning metadata, including the resolved category. Image prompting is split into a cover house style and an inline editorial/photo/diagram style to prevent childish or fantastical visuals.

**Tech Stack:** React, TypeScript, Express, OpenAI, Gemini, Sanity

---

### Task 1: Lock down the failing behaviors with tests

**Files:**
- Modify: `tests/server/openai.test.ts`
- Modify: `tests/server/gemini.test.ts`
- Create: `tests/lib/blog-preview-media.test.ts`

**Step 1: Write failing tests**
- Add assertions that generation returns authoritative category metadata.
- Add assertions that inline image prompt policy prefers professional editorial/realistic outputs and rejects childish/3D toy aesthetics.
- Add tests for text-only article rendering helpers and slot parsing edge cases.

**Step 2: Run targeted tests to verify failure**
- Run: `node --import tsx --test tests/server/openai.test.ts tests/server/gemini.test.ts tests/lib/blog-preview-media.test.ts`

**Step 3: Implement only enough helpers/contracts to pass later tasks**

### Task 2: Make backend editorial planning authoritative

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `src/server/editorial-planner.ts`
- Modify: `src/services/gemini.ts`
- Modify: `src/types.ts`

**Step 1: Return resolved category metadata with generated drafts**
- Add `category` object to blog generation response.
- Use editorial snapshot categories as the single source of truth.

**Step 2: Remove silent category ambiguity**
- If Sanity is configured but category snapshot is missing/empty, propagate an actionable error or warning state instead of silently showing `Uncategorized`.

### Task 3: Make draft/media contract slot-only and normalize edits

**Files:**
- Modify: `src/lib/blog-draft-media.ts`
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/server/openai.ts`
- Modify: `src/server/sanity.ts`

**Step 1: Treat legacy `[IMAGE_PROMPT: ...]` as migration input only**
- Normalize to slot markers on generate, edit, and publish.

**Step 2: Normalize manual edits**
- Re-run draft normalization when raw markdown changes.

**Step 3: Strip media from the article pane**
- Render article preview as text-only content with markers removed.
- Keep media placement and generation controls exclusively in a separate media section.

### Task 4: Redesign the blog writer UI around separate workspaces

**Files:**
- Modify: `src/components/BlogPreview.tsx`
- Optional: `src/components/*` if small helper components are extracted

**Step 1: Replace mixed article/media flow with clear sections**
- Article section: metadata + text preview/editor only.
- Media section: cover + inline assets + slot placement context.

**Step 2: Make placement legible without embedding images into the article**
- Show each inline slot with heading/nearby excerpt context.

### Task 5: Tighten image prompts toward professional editorial visuals

**Files:**
- Modify: `src/server/gemini.ts`
- Modify: `src/server/openai.ts`
- Modify: `src/lib/editorial-cover-style.ts`

**Step 1: Keep cover house style consistent**
- Preserve the dark premium glassmorphism family.

**Step 2: Change inline image direction**
- Prefer professional editorial photography, realistic business scenes, or clean simplified info-visuals depending on section context.
- Explicitly avoid childish 3D scenes, fantasy gradients, sticker-like icons, and toy-like people.

### Task 6: Verify and regression-check

**Files:**
- No new files unless fixes are needed

**Step 1: Run targeted tests**
- `node --import tsx --test tests/server/openai.test.ts tests/server/gemini.test.ts tests/lib/blog-draft-media.test.ts tests/server/sanity.test.ts`

**Step 2: Run full test suite**
- `npm test -- --runInBand`

**Step 3: Run typecheck/build**
- `npm run lint`
- `npm run build`

**Step 4: Review remaining risks**
- Confirm publish still resolves slots into inline markdown.
- Confirm category badge never falls back to `Uncategorized` when Sanity snapshot exists.
