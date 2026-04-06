import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUALY_VISUAL_BRAND_PROFILE,
  buildVisualBrandBlock,
  getVisualBrandReferenceAssetCandidates,
  getThemeMatchedVisualBrandReferenceAssetCandidate,
  resolveVisualBrandName,
} from '../../src/lib/visual-brand-profile';
import { buildGeminiRenderPrompt, buildPrompt } from '../../src/lib/visual-prompt';

test('falls back to Qualy when the visual product name is blank', () => {
  assert.equal(resolveVisualBrandName(''), QUALY_VISUAL_BRAND_PROFILE.name);
  assert.equal(resolveVisualBrandName('   '), QUALY_VISUAL_BRAND_PROFILE.name);
  assert.equal(resolveVisualBrandName('Qualy Inbox'), 'Qualy Inbox');
});

test('exposes Qualy logo and icon reference asset candidates', () => {
  const assets = getVisualBrandReferenceAssetCandidates();
  const kinds = assets.map((asset) => asset.kind);
  const fileNames = assets.map((asset) => asset.fileName);

  assert.deepEqual(kinds.slice(0, 2), ['logo', 'logo']);
  assert.equal(fileNames[0], 'logo-black.png');
  assert.equal(fileNames[1], 'logo-white.png');
  assert.equal(fileNames.includes('logo-black.svg'), true);
  assert.equal(fileNames.includes('icon-black.svg'), true);
});

test('buildVisualBrandBlock explains restrained wordmark and icon usage', () => {
  const block = buildVisualBrandBlock('');

  assert.match(block, /BRAND SYSTEM:\s+Qualy/i);
  assert.match(block, /wordmark/i);
  assert.match(block, /icon/i);
  assert.match(block, /small signature/i);
});

test('picks the theme-matched logo asset with the strongest contrast', () => {
  const darkLogo = getThemeMatchedVisualBrandReferenceAssetCandidate('dark', 'logo');
  const lightLogo = getThemeMatchedVisualBrandReferenceAssetCandidate('light', 'logo');

  assert.equal(darkLogo?.fileName, 'logo-white.png');
  assert.equal(lightLogo?.fileName, 'logo-black.png');
});

test('buildPrompt injects Qualy brand fallback and brand system guidance', () => {
  const prompt = buildPrompt(
    [],
    '',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Stop losing warm leads',
    'Prioritize conversations instantly.',
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

  assert.match(prompt, /Product Name: Qualy/i);
  assert.match(prompt, /BRAND SYSTEM:\s+Qualy/i);
  assert.match(prompt, /wordmark or icon/i);
});

test('buildGeminiRenderPrompt adds brand reference guidance when Qualy assets are attached', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Quiet Signal editorial poster for Qualy.',
    headline: 'Stop losing warm leads',
    subheadline: 'Prioritize conversations instantly.',
    cta: 'See Qualy',
    language: 'EN',
    images: [],
    featureName: 'AI Inbox',
    theme: 'mixed',
    variationIndex: 0,
    referenceImage: null,
    brandName: 'Qualy',
    hasBrandReferences: true,
  });

  assert.match(prompt, /Qualy/i);
  assert.match(prompt, /brand references/i);
  assert.match(prompt, /wordmark/i);
  assert.match(prompt, /contrast/i);
  assert.match(prompt, /black or white/i);
});

test('buildGeminiRenderPrompt keeps brand references as correctness guides without asking for standalone logo placement', () => {
  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: 'Premium social page post visual for Qualy.',
    headline: ' ',
    subheadline: ' ',
    cta: '',
    includeCta: false,
    renderText: false,
    language: 'TR',
    images: [],
    featureName: 'AI Inbox',
    theme: 'dark',
    variationIndex: 0,
    brandName: 'Qualy',
    hasBrandReferences: true,
  });

  assert.match(prompt, /Do not add a standalone decorative logo placement/i);
  assert.match(prompt, /natural in-product brand mark/i);
  assert.doesNotMatch(prompt, /single subtle official brand logo placement is allowed/i);
});
