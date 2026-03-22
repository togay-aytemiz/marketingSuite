# Publication-First Blog UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current blog writer into a publication-first editorial workflow where clicking Generate produces a professional draft experience with clear review stages and publish readiness.

**Architecture:** Keep the existing left sidebar + main workspace shell, but redesign the blog flow into three visible stages: `Draft`, `Media`, and `Publish`. Surface product context directly inside the blog brief, add a derived publish-readiness model, and move the primary CTA hierarchy to reflect the current stage.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, node:test

---

### Task 1: Define and test publish-readiness rules

**Files:**
- Create: `src/lib/blog-publish-readiness.ts`
- Create: `tests/lib/blog-publish-readiness.test.ts`

**Step 1:** Write failing tests for readiness rules: title length, description length, category resolved, cover ready, inline media ready, CTA present, bilingual completeness.

**Step 2:** Implement the minimal helper that computes checklist items and overall blocking state.

**Step 3:** Run focused tests and confirm they pass.

### Task 2: Enrich category metadata and backend typing

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `src/services/gemini.ts`
- Modify: `src/types.ts`
- Modify: `tests/server/openai.test.ts`

**Step 1:** Add category resolution metadata (`resolvedBy`, `confidence`, `fallbackReason`) to backend/category types.

**Step 2:** Add/adjust tests for exact, slug, and fallback category resolution metadata.

**Step 3:** Run focused tests and confirm they pass.

### Task 3: Redesign the blog brief rail

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1:** Surface Product Context directly in blog mode.

**Step 2:** Merge content strategy + preferences into a cleaner “Brief” flow.

**Step 3:** Add a preflight/status summary near the primary generate button.

### Task 4: Redesign the draft workspace into stages

**Files:**
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/index.css`

**Step 1:** Replace article/media toggle with a three-stage flow: `Draft`, `Media`, `Publish`.

**Step 2:** Add a sticky right-side readiness rail with stage-aware CTA.

**Step 3:** Move metadata editing and publish action into the publish stage.

**Step 4:** Keep article preview text-only and hide secondary panels unless they support the current stage.

### Task 5: Verify the redesign

**Files:**
- No additional code changes expected

**Step 1:** Run focused tests.

**Step 2:** Run `npm test -- --runInBand`.

**Step 3:** Run `npm run lint`.

**Step 4:** Run `npm run build`.
