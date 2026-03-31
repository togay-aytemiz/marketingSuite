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
