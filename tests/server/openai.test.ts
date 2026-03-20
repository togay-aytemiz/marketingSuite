import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBlogImageSlotMarker,
  buildCategoryDistributionInstruction,
  cleanGeneratedMarkdownArtifacts,
  ensureFinalCallToAction,
  enforceTurkishMarketingTerminology,
  extractBlogImageSlotIds,
  normalizeTopicIdeaCandidate,
  resolveCategoryId,
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

test('normalizes topic idea rationale fields and turkish terminology', () => {
  const normalized = normalizeTopicIdeaCandidate(
    {
      topic: 'AI lead scoring ile conversion artisi',
      keywords: 'AI lead scoring, conversion rate, engagement',
      categoryId: 'cat-sales',
      reason: 'Lead scoring ve conversion odakli yeni bir aci.',
      categoryGap: 'Bu kategoride son donemde daha az yazi var.',
      excludedRecentTitles: ['Eski Yazi 1', ' ', 'Eski Yazi 2'],
    },
    true,
    [{ id: 'cat-sales', name: 'Satis' }],
    [{ title: 'Post 1', category: 'Satis' }]
  );

  assert.equal(normalized?.topic.includes('AI'), false);
  assert.equal(normalized?.keywords.includes('conversion'), false);
  assert.equal(normalized?.reason.includes('müşteri adayı puanlama'), true);
  assert.deepEqual(normalized?.excludedRecentTitles, ['Eski Yazi 1', 'Eski Yazi 2']);
  assert.equal(normalized?.categoryId, 'cat-sales');
});
