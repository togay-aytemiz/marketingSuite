# Visual Creator OpenAI Prompt Planning And House Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route Visual Creator prompt planning through OpenAI while keeping Gemini as the image renderer, and standardize Instagram/general marketing visuals under one conversion-first house style.

**Architecture:** Add a server-side OpenAI prompt-planning step that converts UI state into a single Gemini-ready visual prompt seed plus style metadata. Keep Gemini responsible only for image generation. Centralize house-style defaults and option labels in shared constants so App state, Sidebar presets, prompt preview, and tests all reference the same visual system.

**Tech Stack:** React 19, TypeScript, Express, OpenAI chat completions, Google Gemini image generation, Node test runner

---

### Task 1: Define the failing contract for OpenAI visual prompt planning

**Files:**
- Modify: `tests/server/openai.test.ts`
- Modify: `tests/lib/visual-prompt.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- a new OpenAI planner function returns a structured result for Visual Creator prompt planning
- the planner prompt contains the new house-style rules and strategy-context block
- the local prompt builder can render a Gemini-ready prompt from the structured planner result

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="visual prompt planning|house style"`
Expected: FAIL because the planner function and/or prompt builder contract do not exist yet.

**Step 3: Write minimal implementation**

Create the smallest shared types/helpers needed for the planner output shape and prompt rendering.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="visual prompt planning|house style"`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/server/openai.test.ts tests/lib/visual-prompt.test.ts
git commit -m "test: cover visual prompt planning contract"
```

### Task 2: Move Visual Creator prompt planning to OpenAI

**Files:**
- Modify: `src/server/openai.ts`
- Modify: `server.ts`
- Modify: `src/services/gemini.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Add tests that assert:
- `/api/ai/generate-final-visual` now depends on both OpenAI and Gemini
- the app requests an OpenAI-generated visual plan before Gemini image generation
- prompt preview uses the planned prompt contract instead of the old locally assembled prompt alone

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="generate final visual|visual creator"`
Expected: FAIL because the current path goes directly from UI state to the local Gemini prompt builder.

**Step 3: Write minimal implementation**

Implement:
- an OpenAI planner function for Visual Creator
- a front-end service call for the planner
- App orchestration that gets copy from OpenAI, prompt plan from OpenAI, and image from Gemini
- server routing so `generate-final-visual` requires both providers

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="generate final visual|visual creator"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/openai.ts server.ts src/services/gemini.ts src/App.tsx
git commit -m "feat: route visual prompt planning through openai"
```

### Task 3: Unify house style defaults and Sidebar controls

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/lib/visual-prompt.ts`
- Test: `tests/lib/app-state.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- default Visual Creator state uses the new house-style defaults
- Sidebar presets no longer push conflicting visual languages
- house-style constants inject the minimal conversion-first Instagram/editorial rules

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="house style|default state|preset"`
Expected: FAIL because defaults and preset labels still mix multiple competing styles.

**Step 3: Write minimal implementation**

Centralize:
- default platform/tone/design-style/mode/campaign defaults
- a short named house-style identity
- prompt-builder rendering rules for that identity

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="house style|default state|preset"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts src/components/Sidebar.tsx src/lib/visual-prompt.ts tests/lib/app-state.test.ts
git commit -m "feat: unify visual creator house style"
```

### Task 4: Verify end-to-end behavior and messaging

**Files:**
- Modify: `src/services/integrations.ts` if needed for status text
- Modify: `src/components/Sidebar.tsx` if needed for prompt-preview or provider wording

**Step 1: Write the failing test**

Add or extend tests that assert provider messaging makes the pipeline explicit:
- OpenAI generates copy and prompt plan
- Gemini renders the final image

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="provider|integration|prompt preview"`
Expected: FAIL if UI text still implies the old flow.

**Step 3: Write minimal implementation**

Update wording only where needed to reflect the new pipeline and avoid misleading names.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="provider|integration|prompt preview"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/integrations.ts src/components/Sidebar.tsx
git commit -m "chore: clarify visual creator ai pipeline"
```

### Task 5: Full verification

**Files:**
- No code changes required unless verification exposes regressions

**Step 1: Run targeted server and lib tests**

Run: `npm test -- tests/lib/visual-prompt.test.ts tests/lib/app-state.test.ts tests/server/openai.test.ts tests/server/visual-strategy-context.test.ts`
Expected: PASS

**Step 2: Run full suite**

Run: `npm test`
Expected: PASS

**Step 3: Run typecheck**

Run: `npm run lint`
Expected: PASS

**Step 4: Review diff**

Run: `git diff -- src/App.tsx src/components/Sidebar.tsx src/lib/visual-prompt.ts src/server/openai.ts src/services/gemini.ts src/types.ts tests/lib/app-state.test.ts tests/lib/visual-prompt.test.ts tests/server/openai.test.ts`
Expected: only intended Visual Creator pipeline and house-style changes

**Step 5: Commit**

```bash
git add .
git commit -m "feat: align visual creator pipeline and house style"
```
