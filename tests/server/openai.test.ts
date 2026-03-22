import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSearchIntentTitleGuidance,
  buildImagePlanContextSnapshot,
  buildBlogImageSlotMarker,
  buildBlogImagePromptPolicy,
  buildCategoryDistributionInstruction,
  cleanGeneratedMarkdownArtifacts,
  ensureFinalCallToAction,
  enforceTurkishMarketingTerminology,
  extractBlogImageSlotIds,
  normalizeTopicIdeaCandidate,
  normalizeTurkishTextQuality,
  resolveCategoryId,
  resolveCategoryMeta,
} from '../../src/server/openai';

test('cleans orphan bracket lines at the start and end of markdown', () => {
  const cleaned = cleanGeneratedMarkdownArtifacts(`
]
## Baslik

Paragraf.
[
`);

  assert.equal(cleaned.startsWith(']'), false);
  assert.equal(cleaned.endsWith('['), false);
  assert.equal(cleaned.includes('## Baslik'), true);
});

test('cleans orphan bracket lines even when surrounded by blank lines', () => {
  const cleaned = cleanGeneratedMarkdownArtifacts(`

   ]

## Baslik

Paragraf.

[

`);

  assert.equal(cleaned, '## Baslik\n\nParagraf.');
});

test('cleans orphan bracket lines that appear in the middle of markdown', () => {
  const cleaned = cleanGeneratedMarkdownArtifacts(`
## Baslik

[

Paragraf.

]

## Devam
`);

  assert.equal(cleaned.includes('\n[\n'), false);
  assert.equal(cleaned.includes('\n]\n'), false);
  assert.equal(cleaned.includes('## Devam'), true);
});

test('strips an outer markdown code fence from generated article content', () => {
  const cleaned = cleanGeneratedMarkdownArtifacts(`
\`\`\`markdown
Giris paragrafi.

## Ara Baslik

Detay paragrafi.
\`\`\`
`);

  assert.equal(cleaned.startsWith('Giris paragrafi.'), true);
  assert.equal(cleaned.includes('```markdown'), false);
  assert.equal(cleaned.includes('## Ara Baslik'), true);
});

test('extracts blog image slot ids from markdown comments', () => {
  const content = `
## Giris

${buildBlogImageSlotMarker('image-1')}

Metin.

${buildBlogImageSlotMarker('image-2')}
`;

  assert.deepEqual(extractBlogImageSlotIds(content), ['image-1', 'image-2']);
});

test('appends a final CTA section once and keeps it at the end', () => {
  const once = ensureFinalCallToAction('## Baslik\n\nParagraf.', 'TR', 'Qualy', 'WhatsApp');
  const twice = ensureFinalCallToAction(once, 'TR', 'Qualy', 'WhatsApp');

  assert.equal(once.includes('## Sonraki Adım'), true);
  assert.equal(twice, once);
  assert.equal(once.trim().endsWith('ekibimizle iletişime geçebilirsin.'), true);
});

test('normalizes common english marketing terms to Turkish equivalents', () => {
  const normalized = enforceTurkishMarketingTerminology(
    'AI lead scoring ile conversion rate artar ve engagement guclenir.'
  );

  assert.equal(normalized.includes('AI'), false);
  assert.equal(normalized.toLowerCase().includes('lead'), false);
  assert.equal(normalized.toLowerCase().includes('conversion'), false);
  assert.equal(normalized.includes('yapay zeka'), true);
  assert.equal(normalized.includes('müşteri adayı puanlama'), true);
  assert.equal(normalized.includes('dönüşüm oranı'), true);
  assert.equal(normalized.includes('etkileşim'), true);
});

test('normalizes common ASCII Turkish title phrases into natural Turkish characters', () => {
  const normalized = normalizeTurkishTextQuality(
    'Hazir yanitlar nasil kullanilir? Urun notu icin gorsel secimi ve kullanim senaryosu'
  );

  assert.equal(normalized.includes('Hazır yanıtlar'), true);
  assert.equal(normalized.includes('nasıl kullanılır'), true);
  assert.equal(normalized.toLocaleLowerCase('tr-TR').includes('ürün notu'), true);
  assert.equal(normalized.includes('için'), true);
  assert.equal(normalized.includes('görsel'), true);
  assert.equal(normalized.includes('seçimi'), true);
  assert.equal(normalized.includes('kullanım senaryosu'), true);
});

test('builds title guidance that prefers search intent over generic release-note framing', () => {
  const guidance = buildSearchIntentTitleGuidance('TR');

  assert.equal(guidance.includes('problem + solution + use case'), true);
  assert.equal(guidance.includes('ürün notu'), true);
  assert.equal(guidance.includes('hazir, nasil'), true);
});

test('builds a restrained cover-image policy for glassmorphism visuals', () => {
  const policy = buildBlogImagePromptPolicy('soft glassmorphism');

  assert.equal(policy.toLowerCase().includes('glassmorphism'), true);
  assert.equal(policy.toLowerCase().includes('1-2'), true);
  assert.equal(policy.toLowerCase().includes('cover images'), true);
  assert.equal(policy.toLowerCase().includes('no visible text'), true);
  assert.equal(policy.toLowerCase().includes('dark graphite'), true);
  assert.equal(policy.toLowerCase().includes('deep navy'), true);
  assert.equal(policy.toLowerCase().includes('one large frosted glass tile'), true);
  assert.equal(policy.toLowerCase().includes('no people'), true);
});

test('builds category distribution snapshot sorted by lower post counts first', () => {
  const instruction = buildCategoryDistributionInstruction(
    [
      { title: 'A', category: 'Mesajlaşma' },
      { title: 'B', category: 'Mesajlaşma' },
      { title: 'C', category: 'Satış Otomasyonu' },
    ],
    [
      { id: 'cat-msg', name: 'Mesajlaşma' },
      { id: 'cat-sales', name: 'Satış Otomasyonu' },
      { id: 'cat-crm', name: 'CRM' },
    ]
  );

  assert.equal(instruction.includes('SANITY CATEGORY DISTRIBUTION SNAPSHOT'), true);
  const crmIndex = instruction.indexOf('ID: cat-crm');
  const salesIndex = instruction.indexOf('ID: cat-sales');
  const msgIndex = instruction.indexOf('ID: cat-msg');

  assert.equal(crmIndex >= 0, true);
  assert.equal(salesIndex >= 0, true);
  assert.equal(msgIndex >= 0, true);
  assert.equal(crmIndex < salesIndex, true);
  assert.equal(salesIndex < msgIndex, true);
});

test('builds category distribution using categoryId even when category names differ by locale', () => {
  const instruction = buildCategoryDistributionInstruction(
    [
      { title: 'A', category: 'Messaging', categoryId: 'cat-msg' },
      { title: 'B', category: 'Messaging', categoryId: 'cat-msg' },
      { title: 'C', category: 'Sales Automation', categoryId: 'cat-sales' },
    ],
    [
      { id: 'cat-msg', name: 'Mesajlaşma' },
      { id: 'cat-sales', name: 'Satış Otomasyonu' },
      { id: 'cat-crm', name: 'CRM' },
    ]
  );

  const crmIndex = instruction.indexOf('ID: cat-crm');
  const salesIndex = instruction.indexOf('ID: cat-sales');
  const msgIndex = instruction.indexOf('ID: cat-msg');

  assert.equal(crmIndex < salesIndex, true);
  assert.equal(salesIndex < msgIndex, true);
});

test('builds a compact image plan context snapshot instead of embedding full article markdown', () => {
  const snapshot = buildImagePlanContextSnapshot(`
Giris paragrafi.

## Yapay Zeka ile Müşteri Adayı Önceliklendirme

Bu bolum veriye dayali puanlama ve onceliklendirme mantigini anlatir.

<!-- BLOG_IMAGE:image-1 -->

## Gercek Zamanli Veri Analizi

Bu bolum ekiplerin canli veriyle hizli aksiyon almasini anlatir.

<!-- BLOG_IMAGE:image-2 -->
`);

  assert.equal(snapshot.includes('ARTICLE OUTLINE'), true);
  assert.equal(snapshot.includes('INLINE IMAGE SLOTS'), true);
  assert.equal(snapshot.includes('image-1'), true);
  assert.equal(snapshot.includes('image-2'), true);
  assert.equal(snapshot.includes('<!-- BLOG_IMAGE'), false);
});

test('resolves category with fallback to least-covered category when model returns invalid id', () => {
  const categories = [
    { id: 'cat-msg', name: 'Mesajlaşma' },
    { id: 'cat-sales', name: 'Satış Otomasyonu' },
    { id: 'cat-crm', name: 'CRM' },
  ];

  const recentPosts = [
    { title: 'P1', category: 'Mesajlaşma' },
    { title: 'P2', category: 'Mesajlaşma' },
    { title: 'P3', category: 'Satış Otomasyonu' },
  ];

  assert.equal(resolveCategoryId('cat-sales', categories, recentPosts), 'cat-sales');
  assert.equal(resolveCategoryId('CRM', categories, recentPosts), 'cat-crm');
  assert.equal(resolveCategoryId('non-existing-id', categories, recentPosts), 'cat-crm');
});

test('resolves category when model returns a slug instead of the Sanity document id', () => {
  const categories = [
    { id: 'category.sales-automation', name: 'Satış Otomasyonu' },
    { id: 'category.integrations', name: 'Entegrasyonlar' },
  ];

  const recentPosts = [
    { title: 'P1', category: 'Satış Otomasyonu', categoryId: 'category.sales-automation' },
    { title: 'P2', category: 'Satış Otomasyonu', categoryId: 'category.sales-automation' },
  ];

  assert.equal(resolveCategoryId('sales-automation', categories, recentPosts), 'category.sales-automation');
});

test('returns resolved category metadata for the chosen category', () => {
  const categories = [
    { id: 'cat-msg', name: 'Mesajlaşma' },
    { id: 'cat-sales', name: 'Satış Otomasyonu' },
  ];

  const resolved = resolveCategoryMeta(null, categories, [
    { title: 'P1', category: 'Mesajlaşma', categoryId: 'cat-msg' },
  ]);

  assert.deepEqual(resolved, {
    id: 'cat-sales',
    name: 'Satış Otomasyonu',
    resolvedBy: 'fallback-balance',
    confidence: 'low',
    fallbackReason: 'Model category was invalid, so the least-covered matching category was selected automatically.',
  });
});

test('returns category metadata explaining slug-based resolution', () => {
  const categories = [
    { id: 'category.sales-automation', name: 'Satış Otomasyonu' },
    { id: 'category.integrations', name: 'Entegrasyonlar' },
  ];

  const resolved = resolveCategoryMeta('sales-automation', categories, []);

  assert.deepEqual(resolved, {
    id: 'category.sales-automation',
    name: 'Satış Otomasyonu',
    resolvedBy: 'slug-match',
    confidence: 'medium',
    fallbackReason: 'Model returned a slug-like category value, mapped to the closest Sanity category.',
  });
});

test('normalizes topic idea rationale fields and turkish terminology', () => {
  const normalized = normalizeTopicIdeaCandidate(
    {
      topic: 'AI lead scoring ile hazir yanitlar nasil kullanilir',
      keywords: 'AI lead scoring, conversion rate, engagement, urun notu',
      categoryId: 'cat-sales',
      reason: 'Lead scoring ve conversion odakli hazir yanit acisi.',
      categoryGap: 'Bu kategoride son donemde daha az urun notu yazisi var.',
      excludedRecentTitles: ['Eski Yazi 1', ' ', 'Eski Yazi 2'],
    },
    true,
    [{ id: 'cat-sales', name: 'Satis' }],
    [{ title: 'Post 1', category: 'Satis' }]
  );

  assert.equal(normalized?.topic.includes('AI'), false);
  assert.equal(normalized?.keywords.includes('conversion'), false);
  assert.equal(normalized?.topic.includes('hazır yanıtlar nasıl kullanılır'), true);
  assert.equal(normalized?.keywords.includes('ürün notu'), true);
  assert.equal(normalized?.reason.includes('müşteri adayı puanlama'), true);
  assert.deepEqual(normalized?.excludedRecentTitles, ['Eski Yazi 1', 'Eski Yazi 2']);
  assert.equal(normalized?.categoryId, 'cat-sales');
});
