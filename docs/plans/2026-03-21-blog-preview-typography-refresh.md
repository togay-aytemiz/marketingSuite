# Blog Preview Typography Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the blog article workspace feel calmer and more readable, closer to a high-quality editorial layout, while keeping article text and media management fully separated.

**Architecture:** Add a dedicated article typography layer in global CSS, move the preview off brittle inline `prose-*` utilities, and harden preview sanitization so legacy markdown images and bracket artifacts cannot leak into the text workspace. Tighten category resolution to tolerate slug-like model outputs and refresh default image-direction copy so generated prompts stay aligned with the new editorial style.

**Tech Stack:** React 19, Tailwind CSS v4, TypeScript, node:test

---

### Task 1: Lock failing tests for preview sanitization and category tolerance

**Files:**
- Modify: `tests/lib/blog-draft-media.test.ts`
- Modify: `tests/server/openai.test.ts`

**Step 1:** Add a failing test that proves article preview strips markdown image syntax and HTML `<img>` tags.

**Step 2:** Add a failing test that proves category resolution accepts slug-like values such as `sales-automation`.

**Step 3:** Run the focused tests and confirm they fail for the expected reasons.

### Task 2: Harden preview sanitization and category matching

**Files:**
- Modify: `src/lib/blog-draft-media.ts`
- Modify: `src/server/openai.ts`

**Step 1:** Extend article-preview sanitization to remove markdown image blocks and HTML image tags before rendering markdown.

**Step 2:** Extend category resolution to match slug-shaped model output against Sanity ids and names.

**Step 3:** Re-run focused tests and confirm they pass.

### Task 3: Replace ad-hoc article prose utilities with a stable editorial typography system

**Files:**
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/index.css`
- Modify: `src/types.ts`

**Step 1:** Add a dedicated article preview shell/class instead of the current inline `prose-*` utility chain.

**Step 2:** Create a reusable editorial typography block with controlled width, spacing, heading rhythm, list styling, and image suppression for text-only preview.

**Step 3:** Update the default blog image style copy to better reflect the new professional editorial direction.

### Task 4: Verify end-to-end behavior

**Files:**
- No additional code changes expected

**Step 1:** Run focused tests.

**Step 2:** Run `npm run lint`.

**Step 3:** Run `npm run build`.

**Step 4:** Review final UI-related risks and note any remaining manual smoke checks.
