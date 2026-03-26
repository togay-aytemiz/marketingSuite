# Internal Link Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** Make internal linking deterministic enough that reviewed posts produce at least one real internal link even when the LLM fails twice.

**Architecture:** Keep the LLM path for natural link placement, but treat it as best-effort rather than the only mechanism. Validate every generated link against the real post pool, then fall back to a deterministic insertion using the highest-ranked reviewed post when both AI passes fail.

**Tech Stack:** Express, TypeScript, OpenAI route handlers, React blog preview UI, Node test runner

---

### Task 1: Reproduce The Failure

**Files:**
- Modify: `/Users/togay/Desktop/marketing-suit/tests/server/openai.test.ts`
- Test: `/Users/togay/Desktop/marketing-suit/tests/server/openai.test.ts`

**Step 1: Write the failing test**

Add a test where `addInternalLinks()` receives a real reviewed post, both AI responses return unchanged content, and the result is still expected to contain one valid internal link.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/server/openai.test.ts`
Expected: FAIL because the current code returns the original linkless draft.

**Step 3: Write minimal implementation**

Add a deterministic fallback insertion path in `/Users/togay/Desktop/marketing-suit/src/server/openai.ts` that:
- picks the top-ranked reviewed post
- injects one short, locale-aware sentence with the real markdown link
- preserves CTA handling and marker preservation via existing post-processing

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/server/openai.test.ts`
Expected: PASS with the fallback link present.

### Task 2: Keep Validation Single-Source

**Files:**
- Modify: `/Users/togay/Desktop/marketing-suit/src/lib/editorial-context.ts`
- Modify: `/Users/togay/Desktop/marketing-suit/src/components/BlogPreview.tsx`
- Modify: `/Users/togay/Desktop/marketing-suit/src/components/Sidebar.tsx`
- Test: `/Users/togay/Desktop/marketing-suit/tests/lib/editorial-context.test.ts`

**Step 1: Write the failing test**

Add a test proving bogus `/blog/...` URLs are excluded from the “used internal links” view when they are not in the reviewed post pool.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/lib/editorial-context.test.ts`
Expected: FAIL if audit still counts raw markdown links.

**Step 3: Write minimal implementation**

Expose a validated-link extraction helper and use it in:
- blog preview badge/audit state
- sidebar internal-link summary
- manual add-link success detection

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/lib/editorial-context.test.ts`
Expected: PASS with bogus links filtered out.

### Task 3: Harden Route Fallbacks

**Files:**
- Modify: `/Users/togay/Desktop/marketing-suit/src/lib/editorial-request-fallback.ts`
- Modify: `/Users/togay/Desktop/marketing-suit/server.ts`
- Modify: `/Users/togay/Desktop/marketing-suit/src/services/gemini.ts`
- Test: `/Users/togay/Desktop/marketing-suit/tests/lib/editorial-request-fallback.test.ts`

**Step 1: Write the failing test**

Add tests proving:
- empty client arrays fall back to snapshot arrays
- snapshot loading includes `add-internal-links` and `edit-blog-post`
- category guards remain limited to generation actions

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/lib/editorial-request-fallback.test.ts`
Expected: FAIL while helper coverage is incomplete.

**Step 3: Write minimal implementation**

Use small routing helpers for:
- which actions load editorial snapshot
- which actions require editorial categories
- which array source wins when the client sends `[]`

Normalize fallback post arrays before they reach OpenAI handlers so only slug-bearing targets are passed downstream.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/lib/editorial-request-fallback.test.ts`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- Test: `/Users/togay/Desktop/marketing-suit/tests/server/openai.test.ts`
- Test: `/Users/togay/Desktop/marketing-suit/tests/lib/editorial-context.test.ts`
- Test: `/Users/togay/Desktop/marketing-suit/tests/lib/editorial-request-fallback.test.ts`

**Step 1: Run targeted regression suite**

Run: `node --import tsx --test tests/server/openai.test.ts tests/lib/editorial-context.test.ts tests/lib/editorial-request-fallback.test.ts`
Expected: PASS.

**Step 2: Run full project tests**

Run: `npm test`
Expected: PASS.

**Step 3: Run typecheck**

Run: `npm run lint`
Expected: PASS.

**Step 4: Run production build**

Run: `npm run build`
Expected: PASS, with only the existing Vite chunk-size warning remaining.
