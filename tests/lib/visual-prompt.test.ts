import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGeminiRenderPrompt, buildPrompt } from '../../src/lib/visual-prompt';

test('buildPrompt appends product strategy context when provided', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Handle every conversation',
    'Route, tag, and respond faster.',
    'Try Qualy',
    '#0F172A',
    'LinkedIn',
    'Feature announcement',
    '1:1',
    'Professional',
    'Clean SaaS',
    'Clean Screenshot Highlight',
    'EN',
    '',
    'Support automation',
    0,
    undefined,
    undefined,
    null,
    `Source Product: Qualy
Current In-Scope Features:
- AI Inbox
- Shared team assignments
Roadmap Highlights (Completed):
- Added deterministic routing`
  );

  assert.match(prompt, /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
  assert.match(prompt, /Current In-Scope Features:/);
  assert.match(prompt, /AI Inbox/);
  assert.match(prompt, /deterministic routing/i);
});

test('buildPrompt omits product strategy context when none is provided', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Handle every conversation',
    'Route, tag, and respond faster.',
    'Try Qualy',
    '#0F172A',
    'LinkedIn',
    'Feature announcement',
    '1:1',
    'Professional',
    'Clean SaaS',
    'Clean Screenshot Highlight',
    'EN',
    '',
    'Support automation'
  );

  assert.doesNotMatch(prompt, /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
});

test('buildPrompt injects the quiet-signal house style and platform direction', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Stop losing warm leads',
    'See the handoff priority instantly.',
    'See Qualy',
    '#84CC16',
    'Instagram',
    'Product promotion',
    '4:5',
    'Professional',
    'Quiet Signal Editorial',
    'Social Media Promo',
    'EN',
    '',
    'Lead handoff speed'
  );

  assert.match(prompt, /HOUSE STYLE:\s+Quiet Signal/i);
  assert.match(prompt, /one dominant subject/i);
  assert.match(prompt, /Platform: Instagram/i);
  assert.match(prompt, /4:5/i);
});

test('buildPrompt includes the visual house style guardrails for scroll-stopping minimal output', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Handle every conversation',
    'Route, tag, and respond faster.',
    'Try Qualy',
    '#0F172A',
    'Instagram',
    'Feature announcement',
    '4:5',
    'Professional',
    'Clean SaaS',
    'Social Media Promo',
    'EN',
    '',
    'Support automation'
  );

  assert.match(prompt, /HOUSE STYLE:\s+Quiet Signal/i);
  assert.match(prompt, /one dominant subject/i);
  assert.match(prompt, /exactly one accent color/i);
  assert.match(prompt, /3 seconds/i);
  assert.doesNotMatch(prompt, /break the rules/i);
});

test('buildPrompt makes product-promotion intent explicit and treats custom instructions as binding', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'See what matters first',
    'Focus on the highest-intent conversations.',
    'Try Qualy',
    '#84CC16',
    'Instagram',
    'Product promotion',
    '4:5',
    'Professional',
    'Quiet Signal Editorial',
    'Social Media Promo',
    'EN',
    'Use an angled composition and avoid any device mockup.',
    'Lead qualification'
  );

  assert.match(prompt, /CAMPAIGN OBJECTIVE:/);
  assert.match(prompt, /Primary objective: sell the broader product value/i);
  assert.match(prompt, /Do not frame this as a feature announcement/i);
  assert.match(prompt, /NON-NEGOTIABLE CUSTOM INSTRUCTIONS:/);
  assert.match(prompt, /Use an angled composition and avoid any device mockup\./);
});

test('buildGeminiRenderPrompt carries campaign intent and custom instructions into render stage', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Quiet Signal editorial poster for Qualy.',
    headline: 'See what matters first',
    subheadline: 'Focus on the highest-intent conversations.',
    cta: 'Try Qualy',
    language: 'EN',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    campaignType: 'Product promotion',
    campaignFocus: 'Lead qualification',
    customInstruction: 'Use an angled composition and avoid any device mockup.',
  });

  assert.match(prompt, /CAMPAIGN OBJECTIVE:/);
  assert.match(prompt, /Product promotion/i);
  assert.match(prompt, /Do not let the image drift into a feature announcement/i);
  assert.match(prompt, /NON-NEGOTIABLE CUSTOM INSTRUCTIONS:/);
  assert.match(prompt, /Use an angled composition and avoid any device mockup\./);
});
