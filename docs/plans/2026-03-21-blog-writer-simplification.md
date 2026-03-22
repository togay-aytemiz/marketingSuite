# Blog Writer Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the internal blog writer so it generates a publication-grade draft with resolved category, guaranteed CTA, separated media management, and a cleaner reading experience.

**Architecture:** Keep the existing generate -> media -> publish workflow, but remove sales-demo style briefing UI, move category resolution and CTA rules into shared helpers, and tighten image prompt policy. The preview should default to a formatted editorial reading view while media remains in a separate workspace.

**Tech Stack:** React 19, TypeScript, Vite, Express, OpenAI text generation, Gemini image generation, node:test

---

### Task 1: Add shared category resolution and CTA test coverage

**Files:**
- Create: `tests/lib/blog-category-resolution.test.ts`
- Create: `tests/lib/blog-call-to-action.test.ts`
- Modify: `tests/lib/blog-publish-readiness.test.ts`

**Step 1: Write failing tests**

Cover:
- category resolution from slug-like values
- category fallback when model/category payload is missing
- CTA restoration at the end of content
- CTA detection used by publish readiness

**Step 2: Run the focused tests to verify failures**

Run: `npm test -- tests/lib/blog-category-resolution.test.ts tests/lib/blog-call-to-action.test.ts tests/lib/blog-publish-readiness.test.ts`

Expected: FAIL because shared helpers do not exist yet.

### Task 2: Implement shared editorial helpers

**Files:**
- Create: `src/lib/blog-category-resolution.ts`
- Create: `src/lib/blog-call-to-action.ts`
- Modify: `src/server/openai.ts`
- Modify: `src/lib/blog-publish-readiness.ts`
- Modify: `src/components/BlogPreview.tsx`

**Step 1: Implement category helper**

Add shared logic for:
- lookup-key normalization
- exact id/name/slug match
- least-covered fallback resolution
- public `resolveDraftCategory(...)`

**Step 2: Implement CTA helper**

Add shared logic for:
- `DEFAULT_CTA_HEADING`
- `ensureFinalCallToAction(...)`
- `hasFinalCallToAction(...)`

**Step 3: Wire helpers into generation + UI**

Use the shared helpers so:
- server generation always returns normalized category metadata
- client generation/edit/link flows re-ensure final CTA
- client can resolve category defensively if backend metadata is empty

### Task 3: Simplify the blog sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Remove unnecessary briefing UI**

Remove:
- `Publication Brief`
- `Product Context`
- `Preflight`

Keep:
- topic / instruction
- optional keywords
- writing preferences
- single generate CTA

**Step 2: Relax generation gating**

Allow internal use flow without product-context fields blocking generation.

### Task 4: Turn draft preview into a clean editorial reading view

**Files:**
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/index.css`

**Step 1: Remove raw markdown from default workflow**

Hide or remove markdown-edit affordances from the primary draft flow.

**Step 2: Improve layout resilience**

Reduce overflow by:
- using a more responsive main/right-rail layout
- constraining typography width
- enabling wrap behavior for long tokens

**Step 3: Clean empty/gating copy**

Remove `Product Context` language from empty states and guidance.

### Task 5: Tighten image prompt style

**Files:**
- Modify: `src/lib/editorial-cover-style.ts`
- Modify: `src/server/openai.ts`
- Modify: `src/server/gemini.ts`
- Modify: `tests/lib/blog-draft-media.test.ts`
- Modify: `tests/server/gemini.test.ts`
- Modify: `tests/server/openai.test.ts`

**Step 1: Cover style**

Enforce:
- no people
- one hero object
- 1-2 supporting glass accents max
- calmer house style

**Step 2: Inline style**

Enforce:
- realistic editorial photography by default
- clean explainer card only for framework sections
- avoid abstract neon/3D fantasy visuals

### Task 6: Verify and self-review

**Files:**
- Modify as needed based on verification

**Step 1: Run focused tests**

Run: `npm test -- tests/lib/blog-category-resolution.test.ts tests/lib/blog-call-to-action.test.ts tests/lib/blog-draft-media.test.ts tests/lib/blog-publish-readiness.test.ts tests/server/openai.test.ts tests/server/gemini.test.ts`

**Step 2: Run typecheck and build**

Run:
- `npm run lint`
- `npm run build`

**Step 3: Challenge-style review**

Check:
- category cannot stay unresolved when categories exist
- CTA survives generate/edit/internal-link flows
- article preview never renders inline media
- sidebar no longer contains internal-tool-irrelevant briefing blocks
