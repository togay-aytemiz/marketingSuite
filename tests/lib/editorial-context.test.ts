import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInternalLinkAudit,
  buildEditorialPostUrl,
  buildEditorialResearchSummaryPosts,
  extractUsedInternalBlogLinks,
  extractValidatedUsedInternalBlogLinks,
  sanitizeInternalBlogLinks,
} from '../../src/lib/editorial-context';

test('buildEditorialResearchSummaryPosts deduplicates by title and keeps newest posts first', () => {
  const summary = buildEditorialResearchSummaryPosts([
    {
      title: 'WhatsApp Otomasyonu Rehberi',
      slug: 'whatsapp-otomasyonu-rehberi',
      category: 'Mesajlaşma',
      publishedAt: '2026-03-01T10:00:00.000Z',
    },
    {
      title: 'Lead Scoring Nedir',
      slug: 'lead-scoring-nedir',
      category: 'Satış Otomasyonu',
      language: 'en',
      publishedAt: '2026-03-15T10:00:00.000Z',
    },
    {
      title: 'WhatsApp Otomasyonu Rehberi',
      slug: 'whatsapp-otomasyonu-rehberi-v2',
      category: 'Mesajlaşma',
      publishedAt: '2026-03-20T10:00:00.000Z',
    },
  ]);

  assert.equal(summary.length, 2);
  assert.equal(summary[0]?.title, 'WhatsApp Otomasyonu Rehberi');
  assert.equal(summary[0]?.slug, 'whatsapp-otomasyonu-rehberi-v2');
  assert.equal(summary[1]?.title, 'Lead Scoring Nedir');
  assert.equal(buildEditorialPostUrl(summary[0] || {}), '/blog/whatsapp-otomasyonu-rehberi-v2');
  assert.equal(buildEditorialPostUrl(summary[1] || {}), '/en/blog/lead-scoring-nedir');
});

test('extractUsedInternalBlogLinks returns only used internal blog links and keeps language context', () => {
  const links = extractUsedInternalBlogLinks([
    {
      language: 'TR',
      content: `
Giriste [WhatsApp lead yonetimi](/blog/whatsapp-lead-yonetimi) linki var.
[Dis kaynak](https://example.com/dis-kaynak) dahil edilmemeli.
[WhatsApp lead yonetimi](/blog/whatsapp-lead-yonetimi) ikinci kez geciyor.
`,
    },
    {
      language: 'EN',
      content: `
See [Lead routing playbook](/en/blog/lead-routing-playbook) for the related workflow.
`,
    },
  ]);

  assert.deepEqual(links, [
    {
      label: 'WhatsApp lead yonetimi',
      href: '/blog/whatsapp-lead-yonetimi',
      language: 'TR',
    },
    {
      label: 'Lead routing playbook',
      href: '/en/blog/lead-routing-playbook',
      language: 'EN',
    },
  ]);
});

test('extractValidatedUsedInternalBlogLinks excludes bogus draft urls and keeps only real reviewed posts', () => {
  const links = extractValidatedUsedInternalBlogLinks(
    [
      {
        language: 'TR',
        content: `
Bkz. [Gercek Yazi](/blog/gercek-yazi) ve [Uydurma Link](/blog/olmayan-link).
`,
      },
    ],
    [
      {
        slug: 'gercek-yazi',
        language: 'tr',
      },
    ]
  );

  assert.deepEqual(links, [
    {
      label: 'Gercek Yazi',
      href: '/blog/gercek-yazi',
      language: 'TR',
    },
  ]);
});

test('buildInternalLinkAudit warns when reviewed Turkish posts exist but no Turkish internal link is used', () => {
  const audit = buildInternalLinkAudit({
    appLanguage: 'TR',
    autoInternalLinks: true,
    reviewedPosts: [
      {
        title: 'Musteri Skorlama Rehberi',
        slug: 'musteri-skorlama-rehberi',
        publishedAt: '2026-03-20T10:00:00.000Z',
      },
    ],
    usedLinks: [],
  });

  assert.equal(audit.shouldWarn, true);
  assert.deepEqual(audit.missingLanguages, ['TR']);
  assert.equal(audit.usedInTargetLanguagesCount, 0);
});

test('buildInternalLinkAudit flags only the missing language for bilingual drafts', () => {
  const audit = buildInternalLinkAudit({
    appLanguage: 'BOTH',
    autoInternalLinks: true,
    reviewedPosts: [
      {
        title: 'Turkce Yazi',
        slug: 'turkce-yazi',
        publishedAt: '2026-03-20T10:00:00.000Z',
      },
      {
        title: 'English Post',
        slug: 'english-post',
        language: 'en',
        publishedAt: '2026-03-21T10:00:00.000Z',
      },
    ],
    usedLinks: [
      {
        label: 'Turkce Yazi',
        href: '/blog/turkce-yazi',
        language: 'TR',
      },
    ],
  });

  assert.equal(audit.shouldWarn, true);
  assert.deepEqual(audit.missingLanguages, ['EN']);
  assert.equal(audit.usedInTargetLanguagesCount, 1);
  assert.equal(audit.reviewedCounts.EN, 1);
});

test('sanitizeInternalBlogLinks removes invented internal blog urls that are not in the system post list', () => {
  const sanitized = sanitizeInternalBlogLinks(
    'Bkz. [Gercek Yazi](/blog/gercek-yazi) ve [Uydurma Link](/blog/olmayan-link).',
    [
      {
        slug: 'gercek-yazi',
        language: 'tr',
      },
    ],
    'TR'
  );

  assert.equal(sanitized.includes('[Gercek Yazi](/blog/gercek-yazi)'), true);
  assert.equal(sanitized.includes('/blog/olmayan-link'), false);
  assert.equal(sanitized.includes('Uydurma Link'), true);
});

test('sanitizeInternalBlogLinks rewrites wrong-language blog prefixes to the real allowed url', () => {
  const sanitized = sanitizeInternalBlogLinks(
    'See [Lead routing](/blog/lead-routing-playbook) for details.',
    [
      {
        slug: 'lead-routing-playbook',
        language: 'en',
      },
    ],
    'EN'
  );

  assert.equal(sanitized.includes('[Lead routing](/en/blog/lead-routing-playbook)'), true);
  assert.equal(sanitized.includes('](/blog/lead-routing-playbook)'), false);
});
