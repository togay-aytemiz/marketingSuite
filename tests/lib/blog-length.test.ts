import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBlogLength, resolveBlogLengthRequirements } from '../../src/lib/blog-length';

test('normalizes legacy token-based labels to word-based blog lengths', () => {
  assert.equal(
    normalizeBlogLength('Medium (1500 - 2500 tokens)'),
    'Medium (1200 - 1700 words)'
  );
  assert.equal(
    normalizeBlogLength('Short (1000 - 1500 tokens)'),
    'Short (800 - 1100 words)'
  );
});

test('resolves explicit word targets for medium length', () => {
  const requirements = resolveBlogLengthRequirements('Medium (1200 - 1700 words)');

  assert.equal(requirements.key, 'medium');
  assert.equal(requirements.minWords, 1200);
  assert.equal(requirements.maxWords, 1700);
  assert.equal(requirements.recommendedH2Count, '5-6');
});
