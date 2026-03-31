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
    'mixed',
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

test('buildPrompt appends local codebase reality context when provided', () => {
  const prompt = buildPrompt(
    [],
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Prioritize serious leads',
    'Score intent without fake dashboards.',
    'See Qualy',
    '#0F172A',
    'LinkedIn',
    'Feature announcement',
    '1:1',
    'Professional',
    'Clean SaaS',
    'mixed',
    'Clean Screenshot Highlight',
    'EN',
    '',
    'Lead qualification',
    0,
    undefined,
    undefined,
    null,
    '',
    `Product surfaces consistently describe lead scoring as 0-10, not 0-100.
- Lead status model: hot, warm, cold.
- Messaging channels repeated across shipped surfaces: WhatsApp, Instagram, Messenger, Telegram.`
  );

  assert.match(prompt, /LOCAL CODEBASE REALITY CONTEXT \(derived from nearby product code\):/);
  assert.match(prompt, /0-10, not 0-100/i);
  assert.match(prompt, /higher priority than generic SaaS assumptions/i);
  assert.match(prompt, /hot, warm, cold/i);
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
    'mixed',
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
    'mixed',
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

test('buildPrompt resolves mixed theme into per-variation light and dark directions', () => {
  const lightPrompt = buildPrompt(
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
    'mixed',
    'Social Media Promo',
    'EN',
    '',
    'Lead handoff speed',
    1
  );
  const darkPrompt = buildPrompt(
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
    'mixed',
    'Social Media Promo',
    'EN',
    '',
    'Lead handoff speed',
    3
  );

  assert.match(lightPrompt, /Requested Theme Mode:\s+mixed/i);
  assert.match(lightPrompt, /Resolved Theme Variant:\s+light/i);
  assert.match(darkPrompt, /Requested Theme Mode:\s+mixed/i);
  assert.match(darkPrompt, /Resolved Theme Variant:\s+dark/i);
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
    'light',
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

test('buildPrompt explicitly disables CTA rendering when CTA is turned off', () => {
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
    'Quiet Signal Editorial',
    'light',
    'Social Media Promo',
    'EN',
    '',
    'Support automation',
    0,
    undefined,
    undefined,
    null,
    '',
    '',
    false
  );

  assert.match(prompt, /headline and subheadline only/i);
  assert.match(prompt, /CTA is disabled for this visual/i);
  assert.doesNotMatch(prompt, /Call to Action \(CTA\) Button:/i);
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
    'light',
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
    theme: 'dark',
    variationIndex: 2,
    campaignType: 'Product promotion',
    campaignFocus: 'Lead qualification',
    customInstruction: 'Use an angled composition and avoid any device mockup.',
  });

  assert.match(prompt, /Resolved Theme Variant:\s+dark/i);
  assert.match(prompt, /CAMPAIGN OBJECTIVE:/);
  assert.match(prompt, /Product promotion/i);
  assert.match(prompt, /Do not let the image drift into a feature announcement/i);
  assert.match(prompt, /NON-NEGOTIABLE CUSTOM INSTRUCTIONS:/);
  assert.match(prompt, /Use an angled composition and avoid any device mockup\./);
});

test('buildGeminiRenderPrompt forbids CTA output when CTA is disabled', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Quiet Signal editorial poster for Qualy.',
    headline: 'See what matters first',
    subheadline: 'Focus on the highest-intent conversations.',
    cta: 'Try Qualy',
    includeCta: false,
    language: 'EN',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'light',
    variationIndex: 0,
  });

  assert.match(prompt, /headline and subheadline only/i);
  assert.match(prompt, /CTA is disabled for this visual/i);
  assert.doesNotMatch(prompt, /Call to Action \(CTA\) Button:/i);
});
