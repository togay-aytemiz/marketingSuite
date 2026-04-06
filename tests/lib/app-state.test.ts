import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultState } from '../../src/types';
import { APP_STATE_VERSION, buildPersistedAppState, hydrateAppState } from '../../src/lib/app-state';

test('defaults app language to BOTH', () => {
  assert.equal(defaultState.language, 'BOTH');
});

test('defaults visual creator to the quiet-signal house style', () => {
  assert.equal(defaultState.designStyle, 'Quiet Signal Editorial');
  assert.equal(defaultState.theme, 'mixed');
  assert.equal(defaultState.includeCta, true);
});

test('defaults social post creator to a dark instagram feature flow with four image slots', () => {
  assert.equal(defaultState.socialPostPlatform, 'Instagram');
  assert.equal(defaultState.socialPostTheme, 'dark');
  assert.equal(defaultState.socialPostCategory, 'new_feature');
  assert.equal(defaultState.socialPostLanguage, 'TR');
  assert.equal(defaultState.socialPostFocus, '');
  assert.equal(defaultState.socialPostBlogContent, '');
  assert.equal(defaultState.socialPostReferenceImage, null);
  assert.deepEqual(defaultState.socialPostHeadlinePlans, [null, null, null, null]);
  assert.deepEqual(defaultState.socialPostSubheadlinePlans, [null, null, null, null]);
  assert.deepEqual(defaultState.socialPostFinalVisuals, [null, null, null, null]);
});

test('migrates legacy stored TR language to BOTH but preserves explicit modern choice', () => {
  const legacyState = hydrateAppState(JSON.stringify({ language: 'TR' }));
  const modernState = hydrateAppState(
    JSON.stringify({
      stateVersion: APP_STATE_VERSION,
      language: 'TR',
    })
  );

  assert.equal(legacyState.language, 'BOTH');
  assert.equal(modernState.language, 'TR');
});

test('persists the current app state version with normalized language', () => {
  const persisted = buildPersistedAppState({
    ...defaultState,
    language: 'EN',
    productName: 'Qualy',
    activeModule: 'socialPosts',
    socialPostPlatform: 'LinkedIn',
    socialPostTheme: 'light',
    socialPostCategory: 'blog',
    socialPostLanguage: 'EN',
    socialPostFocus: 'Use a document-style hero card',
    socialPostBlogContent: 'Paste the article here.',
    blogKeywordStrategy: {
      primaryKeyword: 'whatsapp otomasyonu',
      secondaryKeywords: ['müşteri adayı puanlama'],
      supportKeywords: [],
      longTailKeywords: [],
      semanticKeywords: [],
    },
  });

  assert.equal(persisted.stateVersion, APP_STATE_VERSION);
  assert.equal(persisted.language, 'EN');
  assert.equal(persisted.productName, 'Qualy');
  assert.equal(persisted.activeModule, 'socialPosts');
  assert.equal(persisted.socialPostPlatform, 'LinkedIn');
  assert.equal(persisted.socialPostTheme, 'light');
  assert.equal(persisted.socialPostCategory, 'blog');
  assert.equal(persisted.socialPostLanguage, 'EN');
  assert.equal(persisted.socialPostFocus, 'Use a document-style hero card');
  assert.equal(persisted.socialPostBlogContent, 'Paste the article here.');
  assert.equal(persisted.blogKeywords, 'whatsapp otomasyonu, müşteri adayı puanlama');
  assert.equal(persisted.includeCta, true);
  assert.deepEqual(persisted.blogKeywordStrategy, {
    primaryKeyword: 'whatsapp otomasyonu',
    secondaryKeywords: ['müşteri adayı puanlama'],
    supportKeywords: [],
    longTailKeywords: [],
    semanticKeywords: [],
  });
});

test('normalizes legacy stored blog length labels to the new word-based options', () => {
  const hydrated = hydrateAppState(
    JSON.stringify({
      stateVersion: APP_STATE_VERSION,
      blogLength: 'Medium (1500 - 2500 tokens)',
    })
  );

  assert.equal(hydrated.blogLength, 'Medium (1200 - 1700 words)');
});

test('hydrates structured keyword strategy from legacy flat keyword summaries', () => {
  const hydrated = hydrateAppState(
    JSON.stringify({
      blogKeywords: 'whatsapp otomasyonu, müşteri adayı puanlama, satış iş akışı',
    })
  );

  assert.equal(hydrated.blogKeywordStrategy.primaryKeyword, 'whatsapp otomasyonu');
  assert.deepEqual(hydrated.blogKeywordStrategy.secondaryKeywords, [
    'müşteri adayı puanlama',
    'satış iş akışı',
  ]);
  assert.equal(hydrated.blogKeywords, 'whatsapp otomasyonu, müşteri adayı puanlama, satış iş akışı');
});

test('hydrates CTA toggle from persisted state and defaults legacy sessions to enabled', () => {
  const legacyState = hydrateAppState(JSON.stringify({ cta: 'See Qualy' }));
  const persistedState = hydrateAppState(
    JSON.stringify({
      stateVersion: APP_STATE_VERSION,
      includeCta: false,
      cta: 'See Qualy',
    })
  );

  assert.equal(legacyState.includeCta, true);
  assert.equal(persistedState.includeCta, false);
  assert.equal(persistedState.cta, 'See Qualy');
});

test('hydrates legacy per-image social post instructions into a single shared focus field', () => {
  const hydrated = hydrateAppState(
    JSON.stringify({
      socialPostImageInstructions: ['', 'Use a document-style hero card', '', ''],
    })
  );

  assert.equal(hydrated.socialPostFocus, 'Use a document-style hero card');
});
