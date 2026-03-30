# Visual Creator OpenAI Prompt Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route Visual Creator through an explicit OpenAI prompt-planning step before Gemini image rendering, while enforcing one consistent house style for Instagram and general marketing visuals.

**Architecture:** Keep the browser flow simple: the client requests copy from OpenAI when needed, requests a render prompt plan from OpenAI for each variation, then sends the planned prompt plus assets to Gemini for image generation. Move the shared visual style rules into a dedicated library so the OpenAI planner brief, Gemini fallback path, UI copy, and tests all reference the same system.

**Tech Stack:** React 19, TypeScript, Express, OpenAI Chat Completions API, Google Gemini image generation API, Node test runner

---

### Task 1: Define shared house style and planner brief surface

**Files:**
- Create: `src/lib/visual-house-style.ts`
- Modify: `src/lib/visual-prompt.ts`
- Test: `tests/lib/visual-prompt.test.ts`

**Step 1: Write the failing test**

Add assertions that the visual prompt brief includes the new house style name and the minimal scroll-stopper rules.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/visual-prompt.test.ts`
Expected: FAIL because the prompt brief does not yet mention the house style system.

**Step 3: Write minimal implementation**

Create a single house-style module and inject its brief into `buildPrompt`. Replace the existing “break the rules” variation with controlled variations inside the same style family.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/visual-prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/visual-house-style.ts src/lib/visual-prompt.ts tests/lib/visual-prompt.test.ts
git commit -m "feat: add visual house style brief"
```

### Task 2: Add OpenAI visual prompt planner

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `server.ts`
- Test: `tests/server/openai.test.ts`
- Test: `tests/server/visual-strategy-context.test.ts`

**Step 1: Write the failing test**

Add a server test for a new OpenAI function that returns a planned render prompt and verify that it includes strategy context and house-style constraints in the upstream OpenAI prompt.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/openai.test.ts tests/server/visual-strategy-context.test.ts`
Expected: FAIL because the planner function and route are missing.

**Step 3: Write minimal implementation**

Implement `generateVisualPromptPlan(...)` in `src/server/openai.ts` and expose it in `server.ts` under a new `plan-visual-prompt` action.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/openai.test.ts tests/server/visual-strategy-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/openai.ts server.ts tests/server/openai.test.ts tests/server/visual-strategy-context.test.ts
git commit -m "feat: add openai visual prompt planner"
```

### Task 3: Switch Visual Creator generation to planner -> renderer

**Files:**
- Modify: `src/services/gemini.ts`
- Modify: `src/server/gemini.ts`
- Modify: `src/App.tsx`
- Test: `tests/services/gemini.test.ts`

**Step 1: Write the failing test**

Add a service-layer test that verifies the client can request a planned prompt from the backend, and adjust generation payload expectations if needed.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/gemini.test.ts`
Expected: FAIL because the new planner client call does not exist yet.

**Step 3: Write minimal implementation**

Add `planVisualPrompt(...)` to the frontend service layer, pass the planned prompt into Gemini generation, and make the server renderer consume the planned prompt instead of locally owning the prompt by default. Remove duplicate prompt-builder logic from `src/server/gemini.ts` by importing the shared builder.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/gemini.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/gemini.ts src/server/gemini.ts src/App.tsx tests/services/gemini.test.ts
git commit -m "feat: route visual creator through planner and renderer"
```

### Task 4: Clarify UI and docs for provider ownership

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/SanitySettingsModal.tsx`
- Modify: `README.md`

**Step 1: Write the failing test**

No dedicated test required if behavior is copy-only, but verify existing tests still cover prompt brief semantics.

**Step 2: Run test to verify no regressions**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/services/gemini.test.ts`
Expected: PASS

**Step 3: Write minimal implementation**

Update UI copy to state that OpenAI plans visual prompts/copy while Gemini renders images and extracts palettes. Add a visible house-style explanation in the Visual Creator settings. Change the prompt preview label so it accurately describes the OpenAI planner brief.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/services/gemini.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/SanitySettingsModal.tsx README.md
git commit -m "docs: clarify visual creator provider roles"
```

### Task 5: Full verification

**Files:**
- Modify: none expected

**Step 1: Run focused test suite**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/server/openai.test.ts tests/server/visual-strategy-context.test.ts tests/server/gemini.test.ts tests/services/gemini.test.ts`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run lint`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: PASS

**Step 4: Summarize verification evidence**

Record which commands passed and any residual risks, especially around OpenAI planner cost/latency and image-model text fidelity.
