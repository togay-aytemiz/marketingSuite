import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInternalBlogUrl,
  buildSearchIntentTitleGuidance,
  buildImagePlanContextSnapshot,
  buildBlogImageSlotMarker,
  buildBlogImagePromptPolicy,
  buildCategoryDistributionInstruction,
  analyzeSeoForBlog,
  cleanGeneratedMarkdownArtifacts,
  ensureFinalCallToAction,
  enforceTurkishMarketingTerminology,
  extractBlogImageSlotIds,
  generateBlogPost,
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

test('builds english internal links under /en/blog', () => {
  assert.equal(buildInternalBlogUrl('sales-automation', 'TR'), '/blog/sales-automation');
  assert.equal(buildInternalBlogUrl('sales-automation', 'EN'), '/en/blog/sales-automation');
});

test('analyzeSeoForBlog includes image alt-text coverage in the SEO prompt', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 72,
                keywords: [
                  { word: 'qualy', count: 2 },
                  { word: 'automation', count: 3 },
                ],
                suggestions: ['Add missing image alt text.'],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await (analyzeSeoForBlog as unknown as (
    title: string,
    description: string,
    content: string,
    keywords: string,
    imageAccessibility?: {
      coverAltText?: string;
      inlineImages?: Array<{ slotId?: string; altText?: string }>;
    }
  ) => Promise<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] } | null>)(
    'Qualy blog title',
    'Qualy blog description',
    'Blog content body',
    'qualy, sales automation',
    {
      coverAltText: '',
      inlineImages: [
        { slotId: 'image-1', altText: 'Lead scoring dashboard' },
        { slotId: 'image-2', altText: '' },
      ],
    }
  );

  assert.equal(result?.score, 64);
  assert.equal(result?.suggestions[0], 'Add missing image alt text.');
  assert.match(prompts[0] || '', /IMAGE ALT TEXT COVERAGE/i);
  assert.match(prompts[0] || '', /Cover image alt text:\s+missing/i);
  assert.match(prompts[0] || '', /image-1:\s+Lead scoring dashboard/i);
  assert.match(prompts[0] || '', /image-2:\s+missing/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('analyzeSeoForBlog embeds content facts and filters out contradictory suggestions', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 85,
                keywords: [
                  { word: 'qualy', count: 2 },
                ],
                // We simulate the LLM returning these despite rules, to ensure filtering works
                suggestions: [
                  'Add an internal link to another blog post.',
                  'Add a call-to-action at the end.',
                  'Add alt text to images for better accessibility.',
                  'Enhance the H2 tags with more keywords.' // This one should be kept
                ],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await (analyzeSeoForBlog as unknown as (
    title: string,
    description: string,
    content: string,
    keywords: string,
    imageAccessibility?: {
      coverAltText?: string;
      inlineImages?: Array<{ slotId?: string; altText?: string }>;
    }
  ) => Promise<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] } | null>)(
    'Qualy blog title',
    'Qualy blog description',
    `Blog content body with a link [here](/blog/sales)
    
    ## Sonraki Adım
    
    Hemen iletisime gecin.
    `,
    'qualy, sales automation',
    {
      coverAltText: 'Cover image',
      inlineImages: [
        { slotId: 'image-1', altText: 'Lead scoring dashboard' },
      ],
    }
  );

  assert.equal(result?.score, 85);
  // Only the valid suggestion should remain
  assert.equal(result?.suggestions.length, 1);
  assert.equal(result?.suggestions[0], 'Enhance the H2 tags with more keywords.');
  
  // Verify the prompt contains the computed facts
  assert.match(prompts[0] || '', /CONTENT FACTS/i);
  assert.match(prompts[0] || '', /Internal blog links found:\s*1/i);
  assert.match(prompts[0] || '', /Final call-to-action section present:\s*yes/i);
  assert.match(prompts[0] || '', /All images have alt text:\s*yes/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});


test('generateBlogPost uses a second translation call for BOTH language mode', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];
  const schemas: Array<Record<string, unknown> | null> = [];
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callIndex += 1;
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));
    schemas.push((body?.response_format?.json_schema?.schema as Record<string, unknown>) || null);

    let content = '';
    if (callIndex === 1) {
      content = JSON.stringify({
        title: 'Yapay Zeka ile Musteri Adayi Onceliklendirme',
        description: 'Satis ekipleri icin hizli onceliklendirme rehberi.',
        slug: 'yapay-zeka-musteri-adayi-onceliklendirme',
        categoryId: null,
        content: 'Giris.\n\n## Skorlama\n\nDetay.\n\n<!-- BLOG_IMAGE:image-1 -->',
      });
    } else if (callIndex === 2) {
      content = JSON.stringify({
        coverImagePrompt: 'Lead scoring dashboard for revenue teams',
        coverAltText: 'Musteri adayi onceliklendirme gorseli',
        inlineImages: [
          {
            slotId: 'image-1',
            prompt: 'Editorial photo: sales team reviewing lead scores',
            altText: 'Skorlama paneli',
          },
        ],
      });
    } else if (callIndex === 3) {
      content = JSON.stringify({
        titleEN: 'AI Lead Prioritization for Revenue Teams',
        descriptionEN: 'A practical guide to prioritizing leads with AI.',
        contentEN: 'Intro.\n\n## Scoring\n\nDetails.\n\n<!-- BLOG_IMAGE:image-1 -->',
        coverAltTextEN: 'Lead prioritization dashboard',
      });
    } else {
      throw new Error(`Unexpected OpenAI call count: ${callIndex}`);
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content,
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await generateBlogPost(
    'Qualy',
    'Lead Scoring',
    'Sales teams',
    'AI sales assistant',
    'Yapay zeka destekli satis surecleri',
    'yapay zeka, musteri adayi',
    'Professional & Informative',
    'Medium (1000 words)',
    'BOTH',
    'Editorial B2B (minimal cover, realistic inline, brandless)'
  );

  assert.equal(callIndex, 3);
  assert.equal(Array.isArray(schemas[0]?.required), true);
  assert.equal((schemas[0]?.required as string[]).includes('titleEN'), false);
  assert.match(prompts[0] || '', /Language:\s+Turkish/);
  assert.doesNotMatch(prompts[0] || '', /Language:\s+Turkish and English/);
  assert.match(prompts[2] || '', /Translate\/adapt this Turkish SaaS blog draft into English/i);
  assert.equal(result?.titleEN, 'AI Lead Prioritization for Revenue Teams');
  assert.equal(result?.coverAltTextEN, 'Lead prioritization dashboard');

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
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
