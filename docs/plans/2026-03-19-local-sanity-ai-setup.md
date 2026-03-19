# Local Sanity and AI Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the desktop marketing tool run fully on localhost, use a local backend for Gemini and Sanity operations, and stay usable even when AI keys are not configured yet.

**Architecture:** Keep the existing Express server as the single local integration layer. Move Gemini calls behind backend endpoints, normalize Sanity fetch and publish logic against the Qualy schema, and expose integration status so the UI can explain missing configuration instead of silently failing.

**Tech Stack:** React 19, TypeScript, Vite, Express, Gemini SDK, Sanity HTTP API, Node test runner with `tsx`

---

### Task 1: Lock the required local behavior with tests

**Files:**
- Modify: `package.json`
- Create: `tests/server/env.test.ts`
- Create: `tests/server/sanity.test.ts`

**Step 1: Write the failing env/status tests**

Create tests that assert:
- missing `GEMINI_API_KEY` reports AI as unconfigured
- `SANITY_API_TOKEN` works as a fallback token source
- Sanity is only configured when project id and token are both present

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the server helper modules do not exist yet.

**Step 3: Write the failing Sanity normalization tests**

Create tests that assert:
- Qualy category docs resolve to localized titles and descriptions
- legacy category fields still work as fallback
- post records normalize string slugs into `{ current }`

**Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the normalization helpers do not exist yet.

### Task 2: Build backend config and integration status helpers

**Files:**
- Create: `src/server/env.ts`
- Modify: `server.ts`
- Test: `tests/server/env.test.ts`

**Step 1: Implement environment loading**

Load `.env.local` first, then `.env`, without overriding already loaded values.

**Step 2: Implement runtime status helpers**

Export helpers that:
- resolve the Gemini API key
- resolve the Sanity token from `SANITY_TOKEN` or `SANITY_API_TOKEN`
- return integration status flags and missing variable names

**Step 3: Add a status endpoint**

Add `GET /api/integrations/status` returning the current Gemini and Sanity configuration state.

**Step 4: Run tests**

Run: `npm test`
Expected: env tests PASS.

### Task 3: Refactor Sanity fetch and publish into backend helpers

**Files:**
- Create: `src/server/sanity.ts`
- Modify: `server.ts`
- Test: `tests/server/sanity.test.ts`

**Step 1: Normalize category and post documents**

Implement helpers that:
- prefer localized category fields
- preserve slug access as `{ current: string }`
- support the current Qualy post and category schema

**Step 2: Update backend routes**

Refactor:
- `GET /api/sanity/categories`
- `GET /api/sanity/posts`
- `POST /api/sanity/publish`

Requirements:
- return normalized arrays directly
- keep behavior safe when Sanity env vars are missing
- publish TR and optional EN variants with required fields

**Step 3: Run tests**

Run: `npm test`
Expected: Sanity tests PASS.

### Task 4: Move Gemini usage behind backend API endpoints

**Files:**
- Create: `src/lib/visual-prompt.ts`
- Create: `src/server/gemini.ts`
- Modify: `server.ts`
- Modify: `src/services/gemini.ts`
- Modify: `vite.config.ts`

**Step 1: Extract the pure visual prompt builder**

Move the prompt construction logic into a shared pure module so frontend preview code can still read the generated prompt locally.

**Step 2: Implement backend AI actions**

Add backend handlers for:
- product description enhancement
- copy generation and ideas
- color palette extraction
- visual generation
- topic brainstorming
- blog generation
- SEO analysis
- blog image generation
- blog editing
- internal linking
- social posts

**Step 3: Convert frontend services to API clients**

Keep the current frontend function names, but make them call backend endpoints instead of the Gemini SDK directly.

**Step 4: Remove client-side key injection**

Delete Vite `define` entries that expose API keys to the browser bundle.

**Step 5: Run tests and type checks**

Run:
- `npm test`
- `npm run lint`

Expected: PASS.

### Task 5: Wire UI to local integration status

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/BlogPreview.tsx`
- Modify: `src/components/SanitySettingsModal.tsx`
- Modify: `src/services/sanity.ts`
- Create: `src/services/integrations.ts`

**Step 1: Fetch backend integration status on app load**

Store whether Gemini and Sanity are configured.

**Step 2: Improve local UX**

Requirements:
- app must open without AI keys
- show informative local status instead of AI Studio key gating
- disable or explain actions that need missing integrations
- show Sanity config guidance from actual backend state

**Step 3: Run type checks**

Run: `npm run lint`
Expected: PASS.

### Task 6: Add local environment templates and docs

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `.env.local.example`

**Step 1: Document local-only startup**

Explain:
- copy example env file
- run the app locally
- which features work without Gemini
- which vars are needed for Sanity publish/fetch

**Step 2: Provide env templates**

Include placeholders for:
- `PORT`
- `GEMINI_API_KEY`
- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_TOKEN`
- `SANITY_API_TOKEN`
- `SANITY_API_VERSION`

**Step 3: Verify production build still works**

Run: `npm run build`
Expected: PASS.
