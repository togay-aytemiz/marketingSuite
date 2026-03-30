# Visual Creator Pipeline And Style System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Visual Creator to an explicit OpenAI prompt-planning plus Gemini image-generation pipeline, and enforce a single distinctive house style for Instagram and general marketing visuals.

**Architecture:** OpenAI remains the text/copy planner and becomes the visual-prompt strategist. Gemini remains the image renderer. The frontend keeps using the same `generate-final-visual` action, but the backend inserts a prompt-planning step before Gemini image generation and the shared house style is centralized in the prompt builder/state defaults.

**Tech Stack:** React, TypeScript, Express, OpenAI Chat Completions, Google GenAI

---

### Task 1: Lock The Desired Behavior With Tests

**Files:**
- Modify: `tests/lib/visual-prompt.test.ts`
- Modify: `tests/server/visual-strategy-context.test.ts`
- Modify: `tests/lib/app-state.test.ts`
- Modify: `tests/server/openai.test.ts`

**Step 1: Write the failing tests**

- Add a prompt-builder test that asserts the new house style language is present by default and that clutter-prone directions are suppressed.
- Add an OpenAI server test that asserts a dedicated visual prompt planning function sends product strategy context plus house-style requirements.
- Add an app-state test that verifies the new default visual style survives hydration/persistence.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/server/visual-strategy-context.test.ts tests/lib/app-state.test.ts tests/server/openai.test.ts`

Expected: FAIL because the house style fields and visual prompt planning behavior do not exist yet.

### Task 2: Add OpenAI Visual Prompt Planning

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `server.ts`
- Modify: `src/services/gemini.ts`

**Step 1: Write the minimal implementation**

- Add a new OpenAI-backed server function that receives the visual generation inputs and returns a short Gemini-ready prompt seed plus optional rationale metadata.
- Route a new internal AI action or direct server call through `server.ts` so Gemini image generation can request that planned prompt.
- Keep existing copy-generation endpoints untouched.

**Step 2: Run targeted tests**

Run: `npm test -- tests/server/visual-strategy-context.test.ts tests/server/openai.test.ts`

Expected: PASS

### Task 3: Wire Gemini Image Generation To The Planned Prompt

**Files:**
- Modify: `src/server/gemini.ts`
- Modify: `src/lib/visual-prompt.ts`

**Step 1: Write the minimal implementation**

- Remove duplicated visual-prompt construction from the Gemini server module and consume the shared prompt builder from `src/lib/visual-prompt.ts`.
- Make `generateFinalVisual` request the OpenAI-planned prompt and then compose the final Gemini image instruction from that seed plus the house-style policy.
- Preserve magic-edit and screenshot/reference-image behavior.

**Step 2: Run targeted tests**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/server/visual-strategy-context.test.ts tests/server/openai.test.ts`

Expected: PASS

### Task 4: Introduce The House Style System In State And UI

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/app-state.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the minimal implementation**

- Set a new default visual style direction aligned with the chosen house style.
- Update presets and design options so Instagram and general marketing visuals stay inside the same brand language.
- Clarify UI copy so OpenAI is framed as prompt/copy intelligence and Gemini as image generation.

**Step 2: Run targeted tests**

Run: `npm test -- tests/lib/app-state.test.ts tests/lib/visual-prompt.test.ts`

Expected: PASS

### Task 5: Verify End-To-End Behavior

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `.env.local.example`

**Step 1: Update docs if needed**

- Document that `OPENAI_API_KEY` powers copy and prompt planning while `GEMINI_API_KEY` powers image rendering.

**Step 2: Run verification**

Run: `npm test`
Run: `npm run build`

Expected: PASS
