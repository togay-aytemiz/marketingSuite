import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInternalBlogUrl,
  getSingleOutputLanguageName,
  normalizeAppLanguage,
} from '../../src/lib/app-language';

test('normalizes app language and falls back to BOTH', () => {
  assert.equal(normalizeAppLanguage('tr'), 'TR');
  assert.equal(normalizeAppLanguage('en'), 'EN');
  assert.equal(normalizeAppLanguage('both'), 'BOTH');
  assert.equal(normalizeAppLanguage('unknown'), 'BOTH');
});

test('treats BOTH as Turkish for single-output prompts', () => {
  assert.equal(getSingleOutputLanguageName('BOTH'), 'Turkish');
  assert.equal(getSingleOutputLanguageName('EN'), 'English');
});

test('builds locale-correct internal blog urls', () => {
  assert.equal(buildInternalBlogUrl('yapay-zeka-satis', 'TR'), '/blog/yapay-zeka-satis');
  assert.equal(buildInternalBlogUrl('ai-sales-prioritization', 'EN'), '/en/blog/ai-sales-prioritization');
});
