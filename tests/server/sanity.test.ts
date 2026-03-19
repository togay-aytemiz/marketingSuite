import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPostDocumentId,
  normalizeSanityCategory,
  normalizeSanityPost,
  slugifyText,
} from '../../src/server/sanity';

test('normalizes localized Qualy categories for Turkish', () => {
  const category = normalizeSanityCategory(
    {
      _id: 'cat-practical',
      titleTr: 'Practical Guide',
      titleEn: 'Practical Guide',
      descriptionTr: 'Turkce aciklama',
      descriptionEn: 'English description',
      slug: 'practical-guide',
    },
    'tr'
  );

  assert.equal(category.title, 'Practical Guide');
  assert.equal(category.description, 'Turkce aciklama');
  assert.deepEqual(category.slug, { current: 'practical-guide' });
});

test('falls back to legacy category fields when localized fields are missing', () => {
  const category = normalizeSanityCategory(
    {
      _id: 'cat-legacy',
      title: 'Legacy Category',
      description: 'Legacy description',
      slug: { current: 'legacy-category' },
    },
    'en'
  );

  assert.equal(category.title, 'Legacy Category');
  assert.equal(category.description, 'Legacy description');
  assert.deepEqual(category.slug, { current: 'legacy-category' });
});

test('normalizes post slugs from string fields', () => {
  const post = normalizeSanityPost({
    _id: 'post-1',
    title: 'A Blog Post',
    slug: 'a-blog-post',
    excerpt: 'Example excerpt',
    language: 'tr',
    translationKey: 'writer-1',
  });

  assert.equal(post.title, 'A Blog Post');
  assert.deepEqual(post.slug, { current: 'a-blog-post' });
  assert.equal(post.language, 'tr');
});

test('builds stable post document ids from translation key and language', () => {
  assert.equal(buildPostDocumentId('writer-123', 'tr'), 'post.writer-123.tr');
  assert.equal(buildPostDocumentId('writer-123', 'en'), 'post.writer-123.en');
});

test('slugifies Turkish titles into ASCII-safe slugs', () => {
  assert.equal(slugifyText('İleri görüşme akışı'), 'ileri-gorusme-akisi');
});
