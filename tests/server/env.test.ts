import test from 'node:test';
import assert from 'node:assert/strict';

import { getIntegrationStatus, getSanityToken } from '../../src/server/env';

test('reports Gemini as unconfigured when no AI keys are present', () => {
  const status = getIntegrationStatus({});

  assert.equal(status.gemini.configured, false);
  assert.deepEqual(status.gemini.missing, ['GEMINI_API_KEY']);
  assert.equal(status.openai.configured, false);
  assert.deepEqual(status.openai.missing, ['OPENAI_API_KEY']);
});

test('reports OpenAI as configured when OPENAI_API_KEY is present', () => {
  const status = getIntegrationStatus({
    OPENAI_API_KEY: 'sk-test',
  });

  assert.equal(status.openai.configured, true);
  assert.deepEqual(status.openai.missing, []);
});

test('accepts SANITY_API_TOKEN as a fallback token source', () => {
  const token = getSanityToken({
    SANITY_API_TOKEN: 'fallback-token',
  });

  assert.equal(token, 'fallback-token');
});

test('reports Sanity as configured only when project id and token exist', () => {
  const missingStatus = getIntegrationStatus({
    SANITY_PROJECT_ID: 'n55lf918',
  });

  assert.equal(missingStatus.sanity.configured, false);
  assert.deepEqual(missingStatus.sanity.missing, ['SANITY_TOKEN']);

  const readyStatus = getIntegrationStatus({
    SANITY_PROJECT_ID: 'n55lf918',
    SANITY_API_TOKEN: 'secret-token',
    SANITY_DATASET: 'production',
  });

  assert.equal(readyStatus.sanity.configured, true);
  assert.deepEqual(readyStatus.sanity.missing, []);
  assert.equal(readyStatus.sanity.dataset, 'production');
});
