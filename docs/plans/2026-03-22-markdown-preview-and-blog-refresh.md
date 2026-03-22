# Markdown Preview And Blog Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove visible raw Markdown from the draft/article experience and ensure newly published Sanity posts reliably surface on the Qualy `/blog` feed after refresh.

**Architecture:** Harden markdown normalization at the source by dedenting publishable/editorial markdown before preview and publish. Then make the Qualy blog client self-heal against stale prerender bootstrap by re-fetching the latest manifest/post payloads on mount instead of trusting embedded HTML forever.

**Tech Stack:** React, TypeScript, react-markdown, Express, Sanity, Vite

---

### Task 1: Reproduce and lock the markdown indentation regression

**Files:**
- Modify: `tests/lib/blog-draft-media.test.ts`
- Modify: `tests/server/sanity.test.ts`

**Step 1: Write the failing tests**

- Add a preview test where only heading/list markdown lines are indented and assert they still render as markdown source, not code-style text.
- Add a publish sanitization test where the whole markdown body is uniformly indented and assert the sanitized output is dedented before sending to Sanity.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/lib/blog-draft-media.test.ts tests/server/sanity.test.ts`

**Step 3: Implement minimal normalization fix**

- Update markdown normalization helpers in `src/lib/blog-draft-media.ts`
- Reuse the same normalization in `src/server/sanity.ts`

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/lib/blog-draft-media.test.ts tests/server/sanity.test.ts`

### Task 2: Fix stale Qualy blog feed after publish

**Files:**
- Modify: `../Qualy-lp/pages/BlogIndexPage.tsx`
- Modify: `../Qualy-lp/pages/BlogPostPage.tsx`

**Step 1: Write the failing tests**

- Add a regression test in the Qualy repo proving the blog pages do not permanently trust stale bootstrap data when fresher manifest/post JSON exists.

**Step 2: Run tests to verify they fail**

Run: `npm --prefix ../Qualy-lp test -- blog`

**Step 3: Implement minimal client refresh fix**

- Always re-fetch fresh manifest/post JSON on mount.
- Prefer the fresher network payload over embedded bootstrap data.
- Use a cache-busting query string to avoid browser/dev-server stale responses.

**Step 4: Run tests to verify they pass**

Run: `npm --prefix ../Qualy-lp test -- blog`

### Task 3: Verify live end-to-end behavior

**Files:**
- No new files required

**Step 1: Refresh Qualy blog artifacts**

Run: `npm --prefix ../Qualy-lp run blog:generate`

**Step 2: Verify generated outputs contain the new post**

Run: `rg -n "yapay-zeka-destekli-satis-surecleri-qualy-ile-musteri-adayi-onceliklendirme" ../Qualy-lp/blog/index.html ../Qualy-lp/public/blog_manifest.json`

**Step 3: Run repo verification**

Run:
- `npm run lint`
- `npm run build`
- `node --import tsx --test tests/lib/blog-draft-media.test.ts tests/server/sanity.test.ts`

