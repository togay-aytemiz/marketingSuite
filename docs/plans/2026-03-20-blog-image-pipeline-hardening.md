# Blog Image Pipeline Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make blog generation produce cleaner content and higher-quality visuals by separating image planning from markdown body, enforcing a final CTA, and hardening prompt rules so generated images are text-free, minimal, and professional.

**Architecture:** Keep OpenAI as the text and reasoning layer and Gemini as the image renderer. Replace inline `[IMAGE_PROMPT: ...]` tokens with invisible slot markers in markdown plus a separate structured image plan array. Use the structured plan for preview generation and for Sanity publish-time mapping so raw prompts never leak into article body.

**Tech Stack:** React 19, TypeScript, Express, OpenAI `gpt-4o`, Gemini `gemini-3.1-flash-image-preview`, Node test runner with `tsx`

---

### Task 1: Lock the new markdown and image-slot behavior with tests

**Files:**
- Modify: `tests/server/openai.test.ts`
- Modify: `tests/server/sanity.test.ts`
- Modify: `src/server/openai.ts`
- Modify: `src/server/sanity.ts`

**Step 1: Write failing markdown cleanup tests**

Add tests for:
- slot comments are preserved or cleaned intentionally
- stray `[` / `]` edge lines are removed
- final CTA section is appended once and stays at the end

**Step 2: Run the targeted tests to verify failure**

Run: `npm test -- tests/server/openai.test.ts tests/server/sanity.test.ts`
Expected: FAIL because slot-based helpers and CTA enforcement do not exist yet.

**Step 3: Write failing publish-mapping tests**

Add tests for:
- slot markers map to markdown images using `slotId`
- unresolved slot markers are rejected before publish
- prompt text is not required inside content body anymore

**Step 4: Run the targeted tests to verify failure**

Run: `npm test -- tests/server/openai.test.ts tests/server/sanity.test.ts`
Expected: FAIL with missing helper or mismatched output assertions.

### Task 2: Introduce a structured blog image model

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/gemini.ts`
- Modify: `src/server/openai.ts`

**Step 1: Add explicit blog image plan types**

Define a shared slot-based image plan model, for example:
- `slotId`
- `prompt`
- `altText`
- optional `placementLabel`

**Step 2: Update OpenAI blog response schema**

Change the blog response contract so it returns:
- markdown body with invisible markers like `<!-- BLOG_IMAGE:slot-1 -->`
- separate cover prompt/alt text
- separate `inlineImages` array keyed by `slotId`

**Step 3: Add content hardening helpers**

Implement helpers that:
- normalize Turkish terminology
- append a final CTA section once
- strip orphan bracket lines
- normalize or validate slot markers

**Step 4: Run the focused tests**

Run: `npm test -- tests/server/openai.test.ts`
Expected: PASS

### Task 3: Refactor preview generation and local state to use the structured image plan

**Files:**
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/types.ts`

**Step 1: Replace prompt extraction from content**

Stop scraping prompts from markdown. Use `state.blogInlineImages` instead.

**Step 2: Update preview rendering**

Render markdown by splitting on slot comments instead of raw prompt tokens.

**Step 3: Update image generation flow**

Generate cover and inline visuals from the structured image plan:
- one slot at a time
- no duplicated regeneration if URL already exists
- no prompt text injected into article body

**Step 4: Preserve slot markers during edits and internal link insertion**

Ensure the preview/editor workflow keeps slot comments stable.

### Task 4: Harden publish-time Sanity mapping

**Files:**
- Modify: `src/services/sanity.ts`
- Modify: `src/server/sanity.ts`
- Modify: `src/components/BlogPreview.tsx`

**Step 1: Switch publish payload to slot-aware inline images**

Send structured inline image data:
- `slotId`
- `prompt`
- `altText`
- `dataUrl`

**Step 2: Map slot markers to final markdown images**

At publish time:
- find `<!-- BLOG_IMAGE:slot-x -->`
- replace with `![alt](url)`
- reject missing uploads
- strip any unresolved slot markers

**Step 3: Keep publish deterministic**

Do not regenerate prompts or images during publish. Publish only what the editor already generated or uploaded.

**Step 4: Run focused tests**

Run: `npm test -- tests/server/sanity.test.ts`
Expected: PASS

### Task 5: Improve visual prompt quality and guardrails

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `src/server/gemini.ts`

**Step 1: Strengthen OpenAI image-prompt instructions**

Require prompts to prefer:
- minimal editorial concept visuals
- elegant still-life or abstract metaphor
- restrained palette
- no text, no letters, no numbers, no labels, no logos
- no cartoon or toy-like illustration language

**Step 2: Add Gemini-side prompt enforcement**

Wrap prompts with non-optional rules so image generation consistently avoids:
- visible text
- infographic-like compositions
- UI screenshots
- noisy character scenes

**Step 3: Keep prompts useful for B2B blog layouts**

Bias toward:
- sophisticated compositions
- negative space
- premium editorial feel
- business-relevant conceptual metaphors

### Task 6: Final review, troubleshooting pass, and verification

**Files:**
- Review: `src/server/openai.ts`
- Review: `src/server/gemini.ts`
- Review: `src/server/sanity.ts`
- Review: `src/components/BlogPreview.tsx`

**Step 1: Run challenge review**

Check for:
- scope drift
- overly complex data model
- regression risk in edit/publish flow

**Step 2: Run troubleshooting review**

Check for:
- slot mismatch errors
- partial image generation states
- publish-time missing asset paths
- content fallback behavior when image generation fails

**Step 3: Patch findings**

Apply only concrete fixes raised by the reviews.

**Step 4: Run full verification**

Run:
- `npm test -- --runInBand`
- `npm run lint`
- `npm run build`

Expected: PASS
