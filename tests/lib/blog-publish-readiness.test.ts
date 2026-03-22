import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPublishReadiness,
  extractMarkdownLinkCount,
  hasFinalCallToAction,
} from '../../src/lib/blog-publish-readiness';

test('counts internal markdown links in blog content', () => {
  const count = extractMarkdownLinkCount(`
Paragraf [hazir yanitlar](/blog/hazir-yanitlar) ile devam eder.

Bir de [entegrasyonlar](/blog/entegrasyonlar) linki var.
`);

  assert.equal(count, 2);
});

test('detects final call to action for Turkish and English content', () => {
  assert.equal(hasFinalCallToAction('## Sonraki Adım\n\nMetin', 'TR'), true);
  assert.equal(hasFinalCallToAction('## Next Step\n\nText', 'EN'), true);
  assert.equal(hasFinalCallToAction('## Sonuc\n\nMetin', 'TR'), false);
});

test('accepts readiness when CTA is present at the end of the content', () => {
  const result = buildPublishReadiness({
    language: 'TR',
    title: 'Kısa Başlık',
    description: 'Kısa açıklama',
    content: '## Giriş\n\nMetin.\n\n## Sonraki Adım\n\nCTA metni.',
    category: {
      id: 'category.sales-automation',
      name: 'Satış Otomasyonu',
      resolvedBy: 'exact-id',
      confidence: 'high',
    },
    coverReady: true,
    inlineImageCount: 0,
    inlineReadyCount: 0,
    autoInternalLinks: false,
    sanityConfigured: true,
  });

  assert.equal(result.items.find((item) => item.key === 'cta')?.ok, true);
});

test('checks CTA against English content for EN drafts', () => {
  const result = buildPublishReadiness({
    language: 'EN',
    titleEN: 'Short Title',
    descriptionEN: 'Short description',
    contentEN: '## Next Step\n\nCTA text.',
    category: {
      id: 'category.integrations',
      name: 'Entegrasyonlar',
      resolvedBy: 'exact-id',
      confidence: 'high',
    },
    coverReady: false,
    coverReadyEN: true,
    inlineImageCount: 0,
    inlineReadyCount: 0,
    autoInternalLinks: false,
    sanityConfigured: true,
  });

  assert.equal(result.items.find((item) => item.key === 'cta')?.ok, true);
});

test('builds a blocking readiness checklist when critical publish data is missing', () => {
  const result = buildPublishReadiness({
    language: 'TR',
    title: 'Kisa Baslik',
    description: 'Aciklama',
    content: '## Giris\n\nParagraf',
    category: null,
    coverReady: false,
    inlineImageCount: 2,
    inlineReadyCount: 1,
    autoInternalLinks: true,
    sanityConfigured: true,
  });

  assert.equal(result.canPublish, false);
  assert.equal(result.items.find((item) => item.key === 'category')?.ok, false);
  assert.equal(result.items.find((item) => item.key === 'cover')?.ok, false);
  assert.equal(result.items.find((item) => item.key === 'inline-images')?.ok, false);
  assert.equal(result.items.find((item) => item.key === 'cta')?.ok, false);
});

test('allows publish when required items are present and bilingual content is complete', () => {
  const result = buildPublishReadiness({
    language: 'BOTH',
    title: 'Kisa Baslik',
    titleEN: 'Short Title',
    description: 'Kisa aciklama',
    descriptionEN: 'Short description',
    content: '## Sonraki Adım\n\nMetin [link](/blog/ornek)',
    contentEN: '## Next Step\n\nText [link](/blog/example)',
    category: {
      id: 'category.sales-automation',
      name: 'Satış Otomasyonu',
      resolvedBy: 'slug-match',
      confidence: 'medium',
    },
    coverReady: true,
    coverReadyEN: true,
    inlineImageCount: 2,
    inlineReadyCount: 2,
    autoInternalLinks: true,
    sanityConfigured: true,
  });

  assert.equal(result.canPublish, true);
  assert.equal(result.items.find((item) => item.key === 'language-completeness')?.ok, true);
  assert.equal(result.items.find((item) => item.key === 'category-confidence')?.tone, 'warning');
  assert.equal(result.items.find((item) => item.key === 'internal-links')?.message.includes('2 internal'), true);
});
