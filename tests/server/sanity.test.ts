import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInlineImageUrlsToMarkdown,
  buildSeoTitle,
  buildPostDocumentId,
  normalizeSanityCategory,
  normalizeSanityPost,
  resolveTranslationKeyForPayload,
  sanitizeBlogMarkdownForPublish,
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
    publishedAt: '2026-03-19T09:00:00.000Z',
    _updatedAt: '2026-03-19T10:00:00.000Z',
  });

  assert.equal(post.title, 'A Blog Post');
  assert.deepEqual(post.slug, { current: 'a-blog-post' });
  assert.equal(post.language, 'tr');
  assert.equal(post.publishedAt, '2026-03-19T09:00:00.000Z');
  assert.equal(post.updatedAt, '2026-03-19T10:00:00.000Z');
});

test('builds stable post document ids from translation key and language', () => {
  assert.equal(buildPostDocumentId('writer-123', 'tr'), 'post.writer-123.tr');
  assert.equal(buildPostDocumentId('writer-123', 'en'), 'post.writer-123.en');
});

test('slugifies Turkish titles into ASCII-safe slugs', () => {
  assert.equal(slugifyText('İleri görüşme akışı'), 'ileri-gorusme-akisi');
});

test('builds meaningful translation key from post slug when explicit key is writer timestamp', () => {
  const key = resolveTranslationKeyForPayload(
    {
      translationKey: 'writer-1773989007837',
      tr: {
        title: 'Ornek Baslik',
        slug: 'musteri-kaybini-onleyen-strateji',
        content: 'icerik',
      },
    },
    1773989007837
  );

  assert.equal(key, 'musteri-kaybini-onleyen-strateji');
});

test('falls back to deterministic writer timestamp when payload has no meaningful key or slug', () => {
  const key = resolveTranslationKeyForPayload(
    {
      tr: {
        title: '',
        content: 'icerik',
      },
    },
    1773989007000
  );

  assert.equal(key, 'writer-1773989007000');
});

test('rejects seo title longer than 70 characters instead of truncating', () => {
  assert.throws(
    () => buildSeoTitle('Müşteri Kaybını Önleyen Strateji: AI Yanıtlarından Gerçek Temsilciye Kesintisiz Geçiş'),
    /SEO title must be at most 70 characters/
  );
});

test('accepts seo title when within 70 characters', () => {
  const seoTitle = buildSeoTitle('Müşteri kaybını azaltan temsilci devri stratejileri');
  assert.equal(seoTitle, 'Müşteri kaybını azaltan temsilci devri stratejileri');
});

test('sanitizes blog markdown before sanity publish', () => {
  const sanitized = sanitizeBlogMarkdownForPublish(`
## SSS
Soru ve cevap burada.

<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage" }
</script>

[IMAGE_PROMPT: abstract geometric transition]
[IMAGE_PLACEHOLDER_1]

Son paragraf.
`);

  assert.equal(sanitized.includes('application/ld+json'), false);
  assert.equal(sanitized.includes('IMAGE_PROMPT'), false);
  assert.equal(sanitized.includes('IMAGE_PLACEHOLDER'), false);
  assert.equal(sanitized.includes('Son paragraf.'), true);
});

test('replaces image prompt tokens with markdown image tags', () => {
  const input = `
Giris paragrafi.

[IMAGE_PROMPT: abstract sales funnel visual]

Kapanis paragrafi.
`;

  const output = applyInlineImageUrlsToMarkdown(input, {
    'abstract sales funnel visual': {
      url: 'https://cdn.sanity.io/images/test/production/hash-1200x630.png',
      alt: 'Abstract sales funnel visual',
    },
  });

  assert.equal(output.includes('IMAGE_PROMPT'), false);
  assert.equal(
    output.includes('![Abstract sales funnel visual](https://cdn.sanity.io/images/test/production/hash-1200x630.png)'),
    true
  );
});
