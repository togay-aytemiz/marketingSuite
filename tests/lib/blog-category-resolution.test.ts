import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDraftCategory } from '../../src/lib/blog-category-resolution';

test('resolves category from a slug-like category id value', () => {
  const resolved = resolveDraftCategory({
    rawCategoryId: 'sales-automation',
    sanityCategories: [
      { id: 'category.sales-automation', name: 'Satış Otomasyonu' },
      { id: 'category.integrations', name: 'Entegrasyonlar' },
    ],
    recentPosts: [
      { title: 'P1', categoryId: 'category.sales-automation', category: 'Satış Otomasyonu' },
    ],
  });

  assert.deepEqual(resolved, {
    id: 'category.sales-automation',
    name: 'Satış Otomasyonu',
    resolvedBy: 'slug-match',
    confidence: 'medium',
    fallbackReason: 'Model returned a slug-like category value, mapped to the closest Sanity category.',
  });
});

test('falls back to the least-covered category when no category id is returned', () => {
  const resolved = resolveDraftCategory({
    rawCategoryId: null,
    sanityCategories: [
      { id: 'category.sales-automation', name: 'Satış Otomasyonu' },
      { id: 'category.integrations', name: 'Entegrasyonlar' },
      { id: 'category.comparisons', name: 'Karşılaştırmalar' },
    ],
    recentPosts: [
      { title: 'P1', categoryId: 'category.sales-automation', category: 'Satış Otomasyonu' },
      { title: 'P2', categoryId: 'category.sales-automation', category: 'Satış Otomasyonu' },
      { title: 'P3', categoryId: 'category.integrations', category: 'Entegrasyonlar' },
    ],
  });

  assert.deepEqual(resolved, {
    id: 'category.comparisons',
    name: 'Karşılaştırmalar',
    resolvedBy: 'fallback-balance',
    confidence: 'low',
    fallbackReason: 'Model category was invalid, so the least-covered matching category was selected automatically.',
  });
});
