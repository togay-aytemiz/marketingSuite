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

test('buildGeminiRenderPrompt keeps readable copy limited to the supplied lockup when renderText is enabled', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with sample status chips like hot, warm, cold.',
    headline: 'Önemli leadleri önce gör',
    subheadline: 'Yapay zeka en güçlü sinyali yukarı taşısın.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
  });

  assert.match(prompt, /All visible text must be in Turkish/i);
  assert.match(prompt, /Only the supplied headline, subheadline, and CTA \(if enabled\) may appear as readable copy/i);
  assert.match(prompt, /Turkish ad copy must stay crisp, legible, and readable/i);
  assert.match(prompt, /If a chat bubble, message, reply, label, callout, status chip, score indicator, or UI text is intentionally visible, render it as short readable Turkish/i);
  assert.match(prompt, /do not blur, crop, hide, or skeletonize intended copy/i);
  assert.match(prompt, /Only decorative dense UI chrome may become abstract skeleton lines/i);
  assert.doesNotMatch(prompt, /Keep any supporting UI copy abstract, blurred, cropped, or unreadable/i);
  assert.match(prompt, /Do not reproduce prompt phrases like "Customer Info", "customer profiles", "High score", "Lead Score", or "AI Automated Response" as visible UI text/i);
});

test('buildGeminiRenderPrompt makes magic edits target the previous image and visibly apply feedback', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with a dense card stack.',
    headline: 'Önemli leadleri önce gör',
    subheadline: 'Yapay zeka en güçlü sinyali yukarı taşısın.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    previousImage: 'data:image/png;base64,previous',
    userComment: 'Kartları sadeleştir ve bozuk tarih yazılarını kaldır.',
  });

  assert.match(prompt, /EDIT MODE/i);
  assert.match(prompt, /The first attached image is the current generated visual to edit/i);
  assert.match(prompt, /must visibly apply the user feedback/i);
  assert.match(prompt, /Kartları sadeleştir ve bozuk tarih yazılarını kaldır/i);
});

test('buildGeminiRenderPrompt passes mandatory headline copy without wrapping quotation marks', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium editorial social post visual.',
    headline: 'Qualy ile Etkili İletişim',
    subheadline: 'Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'light',
    variationIndex: 0,
  });

  assert.match(prompt, /Exact headline text to render:\s+Qualy ile Etkili İletişim/i);
  assert.match(prompt, /Exact subheadline text to render:\s+Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin\./i);
  assert.doesNotMatch(prompt, /Headline:\s+"Qualy ile Etkili İletişim"/i);
  assert.doesNotMatch(prompt, /Subheadline:\s+"Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin\."/i);
});

test('buildGeminiRenderPrompt passes mandatory copy as values and forbids field-label prefixes', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium editorial social post visual.',
    headline: 'Qualy ile Etkili İletişim',
    subheadline: 'Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'light',
    variationIndex: 0,
  });

  assert.match(prompt, /Exact headline text to render:\s+Qualy ile Etkili İletişim/i);
  assert.match(prompt, /Exact subheadline text to render:\s+Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin\./i);
  assert.match(prompt, /Do not render field labels such as "Headline", "Subheadline", "CTA", or "Call to Action"/i);
  assert.doesNotMatch(prompt, /Headline:\s+Qualy ile Etkili İletişim/i);
  assert.doesNotMatch(prompt, /Subheadline:\s+Yapay zeka destekli akıllı asistanınız/i);
});

test('buildGeminiRenderPrompt treats prompt example labels as semantic-only when visible copy is disabled', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with status chips like hot, warm, cold around a lead card.',
    headline: ' ',
    subheadline: ' ',
    cta: '',
    includeCta: false,
    renderText: false,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'light',
    variationIndex: 0,
    hasBrandReferences: true,
  });

  assert.doesNotMatch(prompt, /unless the planned prompt explicitly overrides that constraint/i);
  assert.match(prompt, /Do not render literal words from the prompt/i);
  assert.match(prompt, /replace it with abstract lines, neutral bars, dots, icons, or no-text placeholders/i);
  assert.match(prompt, /If any readable text survives, it must be in Turkish only/i);
});

test('buildGeminiRenderPrompt does not ask for standalone logo placement even when brand references exist', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with one subtle corner logo.',
    headline: 'Yeni blog yazısı',
    subheadline: 'WhatsApp otomasyonunu tek karede anlat.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    hasBrandReferences: true,
  });

  assert.match(prompt, /Do not add a standalone decorative logo placement/i);
  assert.match(prompt, /If the product ui naturally includes a brand mark, it may remain there without becoming a focal point/i);
  assert.doesNotMatch(prompt, /safe area/i);
  assert.doesNotMatch(prompt, /5-8%/i);
});

test('buildGeminiRenderPrompt keeps attached brand references as optional correctness guides, not corner signatures', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with one subtle corner logo.',
    headline: 'Yeni blog yazısı',
    subheadline: 'WhatsApp otomasyonunu tek karede anlat.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'Lead Scoring',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    hasBrandReferences: true,
  });

  assert.match(prompt, /Do not add a standalone decorative logo placement/i);
  assert.match(prompt, /Use attached official brand references only as correctness guides for any natural in-product brand mark/i);
  assert.match(prompt, /Do not isolate, badge, enlarge, or repeat brand marks/i);
});

test('buildGeminiRenderPrompt explicitly forbids English ui copy when the render language is Turkish', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with cards labelled Lead extraction, Customer interaction, and automation workflow.',
    headline: 'Önemli sohbetleri önce gör',
    subheadline: 'Yapay zeka en doğru sinyali öne çıkarsın.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
  });

  assert.match(prompt, /Never render English words from the planned prompt, internal reasoning, or example ui labels/i);
  assert.match(prompt, /If a supporting label is unavoidable, translate it into short readable Turkish or omit the non-essential label/i);
});

test('buildGeminiRenderPrompt keeps an explicitly requested single channel locked during render', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual about AI reply to Instagram with one focused DM panel.',
    headline: 'Instagram mesajlarına hızlı yanıt',
    subheadline: 'Yapay zeka doğru cevabı ilk anda hazırlasın.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    campaignType: 'Product overview',
    campaignFocus: 'AI reply to Instagram',
    customInstruction: 'Keep the composition centered on Instagram DM handling.',
  });

  assert.match(prompt, /CHANNEL PRIORITY:/i);
  assert.match(prompt, /Requested channels:\s+Instagram/i);
  assert.match(prompt, /Do not swap the requested channel focus to WhatsApp, Messenger, Telegram, or other surrounding product channels/i);
  assert.match(prompt, /If one channel is explicitly requested, keep the render centered on that channel unless the brief explicitly asks for a multi-channel story/i);
});

test('buildGeminiRenderPrompt lets light themes stay airy while adding a restrained tint and channel accent', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual about AI reply to Instagram with one focused DM panel.',
    headline: 'Instagram mesajlarını hızlandır',
    subheadline: 'Yapay zeka ilk cevabı daha hızlı hazırlasın.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'light',
    variationIndex: 0,
    campaignType: 'Product overview',
    campaignFocus: 'AI reply to Instagram',
  });

  assert.match(prompt, /faint cool-blue, lilac, blush, or mint haze/i);
  assert.match(prompt, /Do not fall back to a flat plain white canvas/i);
  assert.match(prompt, /Allow one small Instagram gradient icon or badge near the focal area/i);
  assert.match(prompt, /faint rose-lilac-peach tint behind that zone/i);
});

test('buildGeminiRenderPrompt treats uploaded UI images as source material instead of a passive style reference', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with one dominant product crop.',
    headline: 'Yeni özellik',
    subheadline: 'Önemli capability daha görünür olsun.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    referenceImage: 'data:image/png;base64,REFERENCE',
  });

  assert.match(prompt, /Treat the uploaded image as primary UI source material, not a passive style reference/i);
  assert.match(prompt, /Keep recognizable panel geometry, spacing, and hierarchy from the reference/i);
  assert.match(prompt, /Use 1-3 focused crops or panels from the reference/i);
  assert.match(prompt, /Do not copy its exact readable text, product copy, or layout verbatim/i);
});

test('buildGeminiRenderPrompt keeps uploaded reference ui crisp instead of reinterpreting it as glassy abstraction', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual with one dominant product crop.',
    headline: 'Yeni özellik',
    subheadline: 'Önemli capability daha görünür olsun.',
    cta: '',
    includeCta: false,
    renderText: true,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    brandName: 'Qualy',
    theme: 'dark',
    variationIndex: 0,
    referenceImage: 'data:image/png;base64,REFERENCE',
  });

  assert.match(prompt, /Treat the uploaded image as primary UI source material, not a passive style reference/i);
  assert.match(prompt, /Keep recognizable panel geometry, spacing, and hierarchy from the reference/i);
  assert.match(prompt, /If the reference contains white or light surfaces, keep them crisp, bright, and solid/i);
  assert.match(prompt, /Do not reinterpret the reference as smoked glass, frosted panels, or a dark fantasy dashboard/i);
  assert.match(prompt, /Use 1-3 focused crops or panels from the reference/i);
  assert.match(prompt, /Emphasize the focus with one localized accent, outline, glow, zoom, or contrast shift/i);
  assert.match(prompt, /Never preserve real names, usernames, initials, avatar photos, or face crops from the reference/i);
  assert.match(prompt, /Simplify or regenerate avatars into generic fictional profile markers/i);
  assert.match(prompt, /If a tiny identity label survives, replace it with a fictional localized placeholder or omit the non-essential label/i);
});
