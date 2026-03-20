import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStrategyContextPromptText,
  extractCompletedChecklistItems,
  extractInScopeFeatureNames,
  extractUpdateNotes,
} from '../../src/server/strategy-context';

test('extracts update notes from markdown quote blocks', () => {
  const markdown = `
> **Update Note (2026-03-20):** Added deterministic handoff.
> **Update Note (2026-03-19):** Improved Instagram webhook coverage.
`;

  const notes = extractUpdateNotes(markdown, 5);

  assert.deepEqual(notes, [
    'Added deterministic handoff.',
    'Improved Instagram webhook coverage.',
  ]);
});

test('extracts in-scope feature names from PRD scope table', () => {
  const markdown = `
### ✅ In Scope (Target MVP)

| Feature | Description | Status |
| --- | --- | --- |
| WhatsApp Integration | Single number per org | Implemented |
| AI Auto-Reply | Skill-based + KB fallback | Implemented |
| Calendar / Booking | Booking workspace | Implemented |
`;

  const features = extractInScopeFeatureNames(markdown, 10);

  assert.deepEqual(features, ['WhatsApp Integration', 'AI Auto-Reply', 'Calendar / Booking']);
});

test('extracts completed roadmap checklist items', () => {
  const markdown = `
- [x] Initialize project repository
- [x] Set up CI/CD pipeline
- [ ] Pending item
- [x] Add Instagram webhook fallback
`;

  const items = extractCompletedChecklistItems(markdown, 10);

  assert.deepEqual(items, [
    'Initialize project repository',
    'Set up CI/CD pipeline',
    'Add Instagram webhook fallback',
  ]);
});

test('builds compact prompt text from context blocks', () => {
  const prompt = buildStrategyContextPromptText({
    projectName: 'WhatsApp AI Qualy',
    sourcePath: '/tmp/leadqualifier/docs',
    updateNotes: ['Added deterministic handoff.'],
    inScopeFeatures: ['AI Auto-Reply', 'Calendar / Booking'],
    roadmapCompletions: ['Set up CI/CD pipeline'],
    focusKeywords: ['instagram', 'handoff', 'booking'],
  });

  assert.match(prompt, /WhatsApp AI Qualy/);
  assert.match(prompt, /Added deterministic handoff\./);
  assert.match(prompt, /AI Auto-Reply/);
  assert.match(prompt, /calendar/i);
  assert.match(prompt, /instagram, handoff, booking/);
});
