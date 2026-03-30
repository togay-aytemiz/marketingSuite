import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKeywordSummaryFromStrategy,
  buildKeywordSummaryText,
  createEmptyBlogKeywordStrategy,
  hasBlogKeywordStrategy,
  keywordStrategiesEqual,
  normalizeBlogKeywordStrategy,
  parseKeywordInput,
} from '../../src/lib/blog-keyword-strategy';

test('parseKeywordInput splits, trims, deduplicates, and caps keyword lists', () => {
  const items = parseKeywordInput('whatsapp otomasyonu,  whatsapp otomasyonu\nmüşteri adayı puanlama; etkileşim', 3);

  assert.deepEqual(items, [
    'whatsapp otomasyonu',
    'müşteri adayı puanlama',
    'etkileşim',
  ]);
});

test('normalizeBlogKeywordStrategy falls back to flat keyword summary when structured data is missing', () => {
  const strategy = normalizeBlogKeywordStrategy(null, 'whatsapp otomasyonu, müşteri adayı puanlama, satış iş akışı');

  assert.equal(strategy.primaryKeyword, 'whatsapp otomasyonu');
  assert.deepEqual(strategy.secondaryKeywords, ['müşteri adayı puanlama', 'satış iş akışı']);
  assert.deepEqual(strategy.supportKeywords, []);
});

test('buildKeywordSummaryFromStrategy prioritizes primary, secondary, support, and long-tail keywords', () => {
  const summary = buildKeywordSummaryFromStrategy({
    primaryKeyword: 'whatsapp müşteri hizmetleri otomasyonu',
    secondaryKeywords: ['whatsapp otomatik cevap'],
    supportKeywords: ['müşteri mesajlarına otomatik cevap'],
    longTailKeywords: ['whatsapp müşteri hizmetleri otomasyonu nasıl kurulur'],
    semanticKeywords: ['yanıt süresi'],
  });

  assert.deepEqual(summary, [
    'whatsapp müşteri hizmetleri otomasyonu',
    'whatsapp otomatik cevap',
    'müşteri mesajlarına otomatik cevap',
    'whatsapp müşteri hizmetleri otomasyonu nasıl kurulur',
  ]);
  assert.equal(buildKeywordSummaryText({
    primaryKeyword: 'whatsapp müşteri hizmetleri otomasyonu',
    secondaryKeywords: ['whatsapp otomatik cevap'],
    supportKeywords: [],
    longTailKeywords: [],
    semanticKeywords: [],
  }), 'whatsapp müşteri hizmetleri otomasyonu, whatsapp otomatik cevap');
});

test('hasBlogKeywordStrategy and keywordStrategiesEqual work on normalized keyword sets', () => {
  const empty = createEmptyBlogKeywordStrategy();
  const left = normalizeBlogKeywordStrategy({
    primaryKeyword: 'whatsapp otomasyonu',
    secondaryKeywords: ['müşteri adayı puanlama', 'müşteri adayı puanlama'],
  });
  const right = normalizeBlogKeywordStrategy(null, 'whatsapp otomasyonu, müşteri adayı puanlama');

  assert.equal(hasBlogKeywordStrategy(empty), false);
  assert.equal(hasBlogKeywordStrategy(left), true);
  assert.equal(keywordStrategiesEqual(left, right), true);
});
