import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultState } from '../../src/types';
import { APP_STATE_VERSION, buildPersistedAppState, hydrateAppState } from '../../src/lib/app-state';

test('defaults app language to BOTH', () => {
  assert.equal(defaultState.language, 'BOTH');
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
  });

  assert.equal(persisted.stateVersion, APP_STATE_VERSION);
  assert.equal(persisted.language, 'EN');
  assert.equal(persisted.productName, 'Qualy');
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
