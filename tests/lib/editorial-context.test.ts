import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEditorialPostUrl,
  buildEditorialResearchSummaryPosts,
  extractUsedInternalBlogLinks,
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
