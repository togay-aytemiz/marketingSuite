import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInlineImageUrlsToMarkdown,
  buildSeoTitle,
  buildPostDocumentId,
  getEditorialCategoryPolicy,
  normalizeSanityCategory,
  normalizeSanityPost,
  publishToSanity,
  resolveTranslationKeyForPayload,
  sanitizeBlogMarkdownForPublish,
  syncEditorialCategories,
  slugifyText,
} from '../../src/server/sanity';

const TEST_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6iUAAAAASUVORK5CYII=';

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

test('replaces blog image slot markers with markdown image tags', () => {
  const input = `
Giris paragrafi.

<!-- BLOG_IMAGE:image-1 -->

Kapanis paragrafi.
`;

  const output = applyInlineImageUrlsToMarkdown(input, {
    'image-1': {
      url: 'https://cdn.sanity.io/images/test/production/slot-1200x630.png',
      alt: 'Satis otomasyonu gorseli',
    },
  });

  assert.equal(output.includes('BLOG_IMAGE:image-1'), false);
  assert.equal(
    output.includes('![Satis otomasyonu gorseli](https://cdn.sanity.io/images/test/production/slot-1200x630.png)'),
    true
  );
});

test('sanitizes orphan bracket lines in published markdown', () => {
  const sanitized = sanitizeBlogMarkdownForPublish(`
## Baslik

[

Metin.

]
`);

  assert.equal(sanitized.includes('\n[\n'), false);
  assert.equal(sanitized.includes('\n]\n'), false);
  assert.equal(sanitized.includes('Metin.'), true);
});

test('dedents uniformly indented markdown before sanity publish', () => {
  const sanitized = sanitizeBlogMarkdownForPublish(`
    Giris paragrafi.

    ## Ara Baslik

    Detay paragrafi.
  `);

  assert.equal(sanitized.startsWith('Giris paragrafi.'), true);
  assert.equal(sanitized.includes('\n\n## Ara Baslik\n\n'), true);
  assert.equal(sanitized.includes('    ## Ara Baslik'), false);
});

test('strips an outer markdown code fence before sanity publish', () => {
  const sanitized = sanitizeBlogMarkdownForPublish(`
\`\`\`markdown
Giris paragrafi.

## Ara Baslik

Detay paragrafi.
\`\`\`
`);

  assert.equal(sanitized.startsWith('Giris paragrafi.'), true);
  assert.equal(sanitized.includes('```markdown'), false);
  assert.equal(sanitized.includes('\n\n## Ara Baslik\n\n'), true);
});

test('strips a leading markdown code fence before sanity publish when the closing fence is missing', () => {
  const sanitized = sanitizeBlogMarkdownForPublish(`
\`\`\`markdown
Giris paragrafi.

## Ara Baslik

Detay paragrafi.
`);

  assert.equal(sanitized.startsWith('Giris paragrafi.'), true);
  assert.equal(sanitized.includes('```markdown'), false);
  assert.equal(sanitized.includes('\n\n## Ara Baslik\n\n'), true);
});

test('rejects new publish when cover image asset is missing', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    return new Response(JSON.stringify({ result: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      publishToSanity(
        {
          tr: {
            title: 'Kapaksiz yazi',
            content: 'Icerik',
          },
        },
        {
          SANITY_PROJECT_ID: 'testproj',
          SANITY_DATASET: 'production',
          SANITY_TOKEN: 'token',
        }
      ),
    /Missing cover image asset for TR post/
  );

  assert.equal(calls.length, 1);
  global.fetch = originalFetch;
});

test('rejects publish when inline placeholder has no uploaded asset', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    return new Response(JSON.stringify({ result: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      publishToSanity(
        {
          tr: {
            title: 'Inline gorsel eksik',
            content: 'Giris\n\n[IMAGE_PROMPT: strateji gorseli]\n\nKapanis',
            coverImageDataUrl: TEST_IMAGE_DATA_URL,
            inlineImages: [{ prompt: 'strateji gorseli' }],
          },
        },
        {
          SANITY_PROJECT_ID: 'testproj',
          SANITY_DATASET: 'production',
          SANITY_TOKEN: 'token',
        }
      ),
    /Missing uploaded image asset for inline prompt "strateji gorseli" in TR post/
  );

  assert.equal(calls.length, 1);
  global.fetch = originalFetch;
});

test('reuses existing cover asset on update when new cover data is not provided', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];
  let mutationBody = '';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/data/query/')) {
      return new Response(
        JSON.stringify({
          result: [
            {
              _id: 'post.guncel-yazi.tr',
              publishedAt: '2026-03-20T10:00:00.000Z',
              coverImage: {
                _type: 'image',
                alt: 'Eski kapak',
                asset: {
                  _type: 'reference',
                  _ref: 'image-existing-1200x630-png',
                },
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.includes('/data/mutate/')) {
      mutationBody = String(init?.body || '');
      return new Response(JSON.stringify({ results: [{ id: 'post.guncel-yazi.tr' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  }) as typeof fetch;

  const result = await publishToSanity(
    {
      tr: {
        title: 'Guncel Yazi',
        content: 'Icerik',
      },
    },
    {
      SANITY_PROJECT_ID: 'testproj',
      SANITY_DATASET: 'production',
      SANITY_TOKEN: 'token',
    }
  );

  assert.equal(result.success, true);
  assert.equal(calls.some((url) => url.includes('/assets/images/')), false);
  assert.equal(mutationBody.includes('image-existing-1200x630-png'), true);

  global.fetch = originalFetch;
});

test('editorial category policy includes only seo-focused categories and excludes legacy set', () => {
  const policy = getEditorialCategoryPolicy();
  const slugs = policy.map((item) => item.slug);

  assert.equal(policy.length, 6);
  assert.equal(slugs.includes('sales-automation'), true);
  assert.equal(slugs.includes('integrations'), true);
  assert.equal(slugs.includes('case-study'), true);
  assert.equal(slugs.includes('use-cases'), true);
  assert.equal(slugs.includes('measurement-analytics'), true);
  assert.equal(slugs.includes('comparisons'), true);
  assert.equal(slugs.includes('practical-guide'), false);
  assert.equal(slugs.includes('ultimate-guide'), false);
  assert.equal(slugs.includes('how-to-article'), false);
  assert.equal(slugs.includes('concepts'), false);
  assert.equal(slugs.includes('instant-messaging'), false);
  assert.equal(slugs.includes('platform-release'), false);
  assert.equal(slugs.includes('industry-playbook'), false);
});

test('syncs editorial categories by patching existing and creating missing items', async () => {
  const originalFetch = global.fetch;
  const mutateBodies: string[] = [];
  const calls: string[] = [];
  let callIndex = 0;

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);

    callIndex += 1;
    if (callIndex === 1) {
      return new Response(
        JSON.stringify({
          result: [
            {
              _id: 'cat-practical-existing',
              slug: { current: 'practical-guide' },
              title: 'Old Practical',
            },
            {
              _id: 'cat-msg-existing',
              slug: { current: 'instant-messaging' },
              title: 'Old Messaging',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (callIndex === 2) {
      mutateBodies.push(String(init?.body || ''));
      return new Response(JSON.stringify({ results: [{ id: 'upsert-ok' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (callIndex === 3) {
      return new Response(
        JSON.stringify({
          result: [
            { _id: 'cat-practical-existing', slug: { current: 'practical-guide' }, title: 'Old Practical' },
            { _id: 'cat-msg-existing', slug: { current: 'instant-messaging' }, title: 'Old Messaging' },
            { _id: 'category.sales-automation', slug: { current: 'sales-automation' }, title: 'Satış Otomasyonu / Sales Automation' },
            { _id: 'category.integrations', slug: { current: 'integrations' }, title: 'Entegrasyonlar / Integrations' },
            { _id: 'category.case-study', slug: { current: 'case-study' }, title: 'Vaka Analizi / Case Study' },
            { _id: 'category.use-cases', slug: { current: 'use-cases' }, title: 'Kullanım Senaryoları / Use Cases' },
            { _id: 'category.measurement-analytics', slug: { current: 'measurement-analytics' }, title: 'Ölçüm ve Analiz / Measurement and Analytics' },
            { _id: 'category.comparisons', slug: { current: 'comparisons' }, title: 'Karşılaştırmalar / Comparisons' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (callIndex === 4) {
      return new Response(
        JSON.stringify({
          result: [
            { _id: 'post-1', categoryRef: 'cat-practical-existing' },
            { _id: 'post-2', categoryRef: 'cat-msg-existing' },
            { _id: 'post-3', categoryRef: 'category.integrations' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (callIndex === 5) {
      mutateBodies.push(String(init?.body || ''));
      return new Response(JSON.stringify({ results: [{ id: 'cleanup-ok' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (callIndex === 6) {
      return new Response(
        JSON.stringify({
          result: [
            { _id: 'category.sales-automation', titleTr: 'Satış Otomasyonu', titleEn: 'Sales Automation', slug: { current: 'sales-automation' } },
            { _id: 'category.integrations', titleTr: 'Entegrasyonlar', titleEn: 'Integrations', slug: { current: 'integrations' } },
            { _id: 'category.case-study', titleTr: 'Vaka Analizi', titleEn: 'Case Study', slug: { current: 'case-study' } },
            { _id: 'category.use-cases', titleTr: 'Kullanım Senaryoları', titleEn: 'Use Cases', slug: { current: 'use-cases' } },
            { _id: 'category.measurement-analytics', titleTr: 'Ölçüm ve Analiz', titleEn: 'Measurement and Analytics', slug: { current: 'measurement-analytics' } },
            { _id: 'category.comparisons', titleTr: 'Karşılaştırmalar', titleEn: 'Comparisons', slug: { current: 'comparisons' } },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  }) as typeof fetch;

  const result = await syncEditorialCategories({
    SANITY_PROJECT_ID: 'testproj',
    SANITY_DATASET: 'production',
    SANITY_TOKEN: 'token',
  });

  assert.equal(result.updated, 0);
  assert.equal(result.created, 6);
  assert.equal(result.pruned, 2);
  assert.equal(result.reassignedPosts, 2);
  assert.equal(result.fallbackCategorySlug, 'sales-automation');
  assert.deepEqual(result.prunedCategorySlugs.sort(), ['instant-messaging', 'practical-guide']);
  assert.equal(result.totalPolicyCount, getEditorialCategoryPolicy().length);
  assert.equal(mutateBodies[0]?.includes('"createIfNotExists"'), true);
  assert.equal(mutateBodies[1]?.includes('"patch":{"id":"post-1"'), true);
  assert.equal(mutateBodies[1]?.includes('"patch":{"id":"post-2"'), true);
  assert.equal(mutateBodies[1]?.includes('"delete":{"id":"cat-practical-existing"'), true);
  assert.equal(mutateBodies[1]?.includes('"delete":{"id":"cat-msg-existing"'), true);
  assert.equal(calls.some((url) => url.includes('/data/query/')), true);
  assert.equal(calls.some((url) => url.includes('/data/mutate/')), true);

  global.fetch = originalFetch;
});
