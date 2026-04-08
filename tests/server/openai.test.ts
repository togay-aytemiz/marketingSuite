import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addInternalLinks,
  buildInternalBlogUrl,
  buildSearchIntentTitleGuidance,
  buildImagePlanContextSnapshot,
  buildBlogImageSlotMarker,
  buildBlogImagePromptPolicy,
  buildCategoryDistributionInstruction,
  analyzeSeoForBlog,
  cleanGeneratedMarkdownArtifacts,
  editBlogPost,
  ensureFinalCallToAction,
  enforceTurkishMarketingTerminology,
  extractBlogImageSlotIds,
  generateBlogPost,
  generateSocialPostPromptPlan,
  generateVisualPromptPlan,
  regenerateBlogTitles,
  generateTopicIdeas,
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

test('preserves markdown link urls while normalizing Turkish marketing terms', () => {
  const normalized = enforceTurkishMarketingTerminology(
    'Bkz. [Lead routing rehberi](/blog/lead-routing-rehberi).'
  );

  assert.equal(normalized.includes('[müşteri adayı routing rehberi](/blog/lead-routing-rehberi)'), true);
  assert.equal(normalized.includes('/blog/müşteri adayı-routing-rehberi'), false);
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

test('generateVisualPromptPlan requests a Gemini-ready prompt that keeps the house style intact', async () => {
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
                prompt: 'Gemini render prompt for a Quiet Signal Instagram poster.',
                styleName: 'Quiet Signal',
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

  try {
    const result = await generateVisualPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      headline: 'Stop losing warm leads',
      subheadline: 'Prioritize conversations instantly.',
      cta: 'See Qualy',
      brandColor: '#84CC16',
      platform: 'Instagram',
      campaignType: 'Product promotion',
      aspectRatio: '4:5',
      tone: 'Professional',
      designStyle: 'Clean SaaS',
      theme: 'mixed',
      mode: 'Social Media Promo',
      language: 'EN',
      customInstruction: '',
      campaignFocus: 'Lead handoff speed',
      variationIndex: 2,
      hasScreenshots: true,
      hasReferenceImage: false,
      isMagicEdit: false,
    });

    assert.equal(result?.styleName, 'Quiet Signal');
    assert.equal(result?.prompt, 'Gemini render prompt for a Quiet Signal Instagram poster.');
    assert.match(prompts[0] || '', /HOUSE STYLE:\s+Quiet Signal/i);
    assert.match(prompts[0] || '', /Platform:\s+Instagram/i);
    assert.match(prompts[0] || '', /Aspect Ratio:\s+4:5/i);
    assert.match(prompts[0] || '', /Resolved Theme Variant:\s+dark/i);
    assert.match(prompts[0] || '', /Gemini/i);
    assert.match(prompts[0] || '', /Return JSON only/i);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateVisualPromptPlan forwards campaign intent and custom instructions into the OpenAI planner brief', async () => {
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
                prompt: 'Gemini render prompt for a Quiet Signal Instagram poster.',
                styleName: 'Quiet Signal',
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

  try {
    await generateVisualPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      headline: 'See what matters first',
      subheadline: 'Focus on the highest-intent conversations.',
      cta: 'Try Qualy',
      brandColor: '#84CC16',
      platform: 'Instagram',
      campaignType: 'Product promotion',
      aspectRatio: '4:5',
      tone: 'Professional',
      designStyle: 'Clean SaaS',
      theme: 'light',
      mode: 'Social Media Promo',
      language: 'EN',
      customInstruction: 'Use an angled composition and avoid any device mockup.',
      campaignFocus: 'Lead qualification',
      variationIndex: 0,
      hasScreenshots: false,
      hasReferenceImage: false,
      isMagicEdit: false,
    });

    assert.match(prompts[0] || '', /CAMPAIGN OBJECTIVE:/);
    assert.match(prompts[0] || '', /Primary objective: sell the broader product value/i);
    assert.match(prompts[0] || '', /Do not frame this as a feature announcement/i);
    assert.match(prompts[0] || '', /NON-NEGOTIABLE CUSTOM INSTRUCTIONS:/);
    assert.match(prompts[0] || '', /Use an angled composition and avoid any device mockup\./);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateSocialPostPromptPlan requests a Gemini-ready prompt for social page posts', async () => {
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
                prompt: 'Gemini prompt for a premium Instagram social post visual.',
                headline: 'Yeni özellik, daha net',
                subheadline: 'Önemli konuşmaları tek bakışta öne çıkar.',
                styleName: 'Social Post System',
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

  try {
    const result = await generateSocialPostPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      platform: 'Instagram',
      theme: 'dark',
      category: 'new_feature',
      language: 'TR',
      focus: 'AI automatically tagging conversations',
      blogContent: '',
      extraInstruction: 'Use floating tags around the main card.',
      variationIndex: 1,
    });

    assert.equal(result?.prompt, 'Gemini prompt for a premium Instagram social post visual.');
    assert.equal(result?.headline, 'Yeni özellik, daha net');
    assert.equal(result?.subheadline, 'Önemli konuşmaları tek bakışta öne çıkar.');
    assert.match(prompts[0] || '', /Create a modern SaaS product marketing visual/i);
    assert.match(prompts[0] || '', /white haze \+ soft chrome bloom/i);
    assert.match(prompts[0] || '', /Platform:\s+Instagram/i);
    assert.match(prompts[0] || '', /Theme Mode:\s+dark/i);
    assert.match(prompts[0] || '', /Category:\s+Feature announcement/i);
    assert.match(prompts[0] || '', /Copy Language:\s+Turkish/i);
    assert.match(prompts[0] || '', /FOCUS:\s+AI automatically tagging conversations/i);
    assert.match(prompts[0] || '', /If focus is provided, the headline and subheadline must stay anchored to that focus/i);
    assert.match(prompts[0] || '', /Treat focus as the primary campaign angle for visible copy, not as a literal phrase to repeat word-for-word/i);
    assert.match(prompts[0] || '', /Do not let background product context, project naming, or dominant channel references override the user-provided focus/i);
    assert.match(prompts[0] || '', /Treat the headline and subheadline as shared campaign copy that can be reused across all four visual variations/i);
    assert.match(prompts[0] || '', /Do not plan standalone decorative logo placements or make the composition revolve around a logo/i);
    assert.match(prompts[0] || '', /If the product ui naturally contains a brand mark, it may appear there, but it should stay non-focal/i);
    assert.match(prompts[0] || '', /VARIATION DIRECTION:/i);
    assert.match(prompts[0] || '', /headline/i);
    assert.match(prompts[0] || '', /Return JSON only/i);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateSocialPostPromptPlan tells the planner to keep focus as the main copy angle over background context', async () => {
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
                prompt: 'Gemini prompt for a premium Instagram social post visual.',
                headline: 'WhatsApp Yapay Zeka ile İş Akışınızı Geliştirin',
                subheadline: 'İşletmeniz için otomasyon ve entegrasyon çözümleri',
                styleName: 'Social Post System',
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

  try {
    const result = await generateSocialPostPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      platform: 'Instagram',
      theme: 'light',
      category: 'product_overview',
      language: 'TR',
      focus: 'AI reply for Instagram',
      blogContent: '',
      extraInstruction: '',
      variationIndex: 0,
    });

    assert.match(prompts[0] || '', /Treat this focus as the primary campaign angle for both copy and composition/i);
    assert.match(prompts[0] || '', /Use product context, PRD\/ROADMAP context, and local codebase reality only to validate or enrich that angle/i);
    assert.match(prompts[0] || '', /Do not default to broader product naming, project titles, or dominant channel wording from background context when the focus is narrower/i);
    assert.match(prompts[0] || '', /Interpret the focus into polished marketing copy rather than echoing it verbatim unless it is already clean headline language/i);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateSocialPostPromptPlan strips field labels and wrapping quotation marks from planned lockup copy', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompt: 'Gemini prompt for a premium Instagram social post visual.',
                headline: 'Headline: “Qualy ile Etkili İletişim”',
                subheadline: 'Subheadline: "Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin."',
                styleName: 'Social Post System',
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

  try {
    const result = await generateSocialPostPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      platform: 'Instagram',
      theme: 'light',
      category: 'product_overview',
      language: 'TR',
      focus: 'AI can score leads',
      blogContent: '',
      extraInstruction: '',
      variationIndex: 0,
    });

    assert.equal(result?.headline, 'Qualy ile Etkili İletişim');
    assert.equal(result?.subheadline, 'Yapay zeka destekli akıllı asistanınız, müşteri ilişkilerinizi güçlendirsin.');
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateSocialPostPromptPlan lets AI decide focus when the user leaves the field blank', async () => {
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
                prompt: 'Gemini prompt for a premium LinkedIn social post visual.',
                headline: 'AI lead qualification',
                subheadline: 'Read the strongest signals faster.',
                styleName: 'Social Post System',
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

  try {
    await generateSocialPostPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      platform: 'LinkedIn',
      theme: 'light',
      category: 'blog',
      language: 'EN',
      focus: '',
      blogContent: 'Article title: AI lead qualification playbook. Body: explain scoring, routing, and sales handoff.',
      extraInstruction: '',
      variationIndex: 0,
    });

    assert.match(prompts[0] || '', /FOCUS:\s+AI should decide the strongest focus/i);
    assert.match(prompts[0] || '', /VISUAL HINT:\s+AI should decide the clearest visual hint/i);
    assert.match(prompts[0] || '', /Copy Language:\s+English/i);
    assert.match(prompts[0] || '', /BLOG CONTENT CONTEXT:/i);
    assert.match(prompts[0] || '', /AI lead qualification playbook/i);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test('generateSocialPostPromptPlan preserves white source ui surfaces when a reference image exists', async () => {
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
                prompt: 'Gemini prompt for a premium Instagram social post visual.',
                headline: 'Call notes, daha net',
                subheadline: 'Özet sekmesini ilk bakışta görün.',
                styleName: 'Social Post System',
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

  try {
    await generateSocialPostPromptPlan({
      productName: 'Qualy',
      featureName: 'AI Inbox',
      description: 'Unified inbox for support and sales teams.',
      platform: 'Instagram',
      theme: 'dark',
      category: 'new_feature',
      language: 'TR',
      focus: 'Özet sekmesini öne çıkar',
      blogContent: '',
      extraInstruction: '',
      variationIndex: 0,
      hasReferenceImage: true,
    } as any);

    assert.match(prompts[0] || '', /Treat the uploaded reference UI as the primary product surface source/i);
    assert.match(prompts[0] || '', /Keep white or light panels crisp, solid, and product-real instead of turning them into smoked or frosted glass/i);
    assert.match(prompts[0] || '', /Do not reinterpret the source as a dark fantasy dashboard or generic glass cards/i);
    assert.match(prompts[0] || '', /Never preserve personal names, usernames, initials, or profile photos from the reference/i);
    assert.match(prompts[0] || '', /Simplify or regenerate avatars into generic fictional profile markers/i);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
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
      const longDraft = [
        'Giris.',
        '',
        '## Skorlama',
        '',
        `${Array.from({ length: 1250 }, () => 'detay').join(' ')} uygulanabilir ornekler ve operasyon notlari.`,
      ].join('\n');
      content = JSON.stringify({
        title: 'Yapay Zeka ile Musteri Adayi Onceliklendirme',
        description: 'Satis ekipleri icin hizli onceliklendirme rehberi.',
        slug: 'yapay-zeka-musteri-adayi-onceliklendirme',
        categoryId: null,
        content: `${longDraft}\n\n<!-- BLOG_IMAGE:image-1 -->`,
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

test('generateBlogPost expands under-length drafts before building the image plan', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  const shortDraft = [
    'Giris paragrafi.',
    '',
    '## Yapay Zeka ile Onceliklendirme',
    '',
    'Bu taslak kisa tutuldu.',
    '',
    '## Sık Sorulan Sorular',
    '',
    '### Bu ne saglar?',
    '',
    'Daha hizli aksiyon.',
  ].join('\n');

  const expandedDraft = [
    'Giris paragrafi.',
    '',
    'Bu genisletilmis taslak, satis ekiplerinin hangi sinyalleri oncelemesi gerektigini adim adim anlatir.',
    '',
    '## Yapay Zeka ile Onceliklendirme',
    '',
    `${Array.from({ length: 1250 }, () => 'genisletilmis').join(' ')} strateji uygulama olcum ornekleri.`,
    '',
    '## Sık Sorulan Sorular',
    '',
    '### Bu ne saglar?',
    '',
    'Daha hizli aksiyon ve daha net operasyon ritmi.',
  ].join('\n');

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callIndex += 1;
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    let content = '';
    if (callIndex === 1) {
      content = JSON.stringify({
        title: 'Yapay Zeka ile Musteri Adayi Onceliklendirme',
        description: 'Satis ekipleri icin onceliklendirme rehberi.',
        slug: 'yapay-zeka-musteri-adayi-onceliklendirme',
        categoryId: null,
        content: shortDraft,
      });
    } else if (callIndex === 2) {
      content = JSON.stringify({
        content: expandedDraft,
      });
    } else if (callIndex === 3) {
      content = JSON.stringify({
        coverImagePrompt: 'Revenue team prioritizing qualified pipeline',
        coverAltText: 'Onceliklendirme gorseli',
        inlineImages: [],
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
    'Medium (1500 - 2500 tokens)',
    'TR',
    'Editorial B2B (minimal cover, realistic inline, brandless)'
  );

  assert.equal(callIndex, 3);
  assert.match(prompts[0] || '', /Minimum word count:\s+1200/i);
  assert.match(prompts[0] || '', /Recommended H2 sections:\s+5-6/i);
  assert.match(prompts[0] || '', /Use target keywords naturally across the article/i);
  assert.match(prompts[0] || '', /Avoid repetitive wording, repeated sentence openings, and obvious phrase recycling/i);
  assert.match(prompts[1] || '', /Expand this markdown article/i);
  assert.match(prompts[1] || '', /Target range:\s+1200-1700 words/i);
  assert.match(prompts[1] || '', /Use target keywords naturally across the article/i);
  assert.match(prompts[1] || '', /Avoid repetitive wording, repeated sentence openings, and obvious phrase recycling/i);
  assert.match(prompts[2] || '', /ARTICLE CONTEXT SNAPSHOT:/i);
  assert.match(prompts[2] || '', /H2:\s+Yapay Zeka ile Onceliklendirme/i);
  assert.equal(result?.content.includes('<!-- BLOG_IMAGE:image-1 -->'), true);
  assert.equal(result?.inlineImages.length, 1);
  assert.equal(result?.inlineImages[0]?.slotId, 'image-1');
  assert.equal(result?.inlineImages[0]?.altText?.toLocaleLowerCase('tr-TR').includes('for sales team'), false);
  assert.equal(result?.content.includes('genisletilmis taslak'), true);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('editBlogPost prompt reinforces natural keyword use and non-repetitive writing', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let capturedPrompt = '';

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    capturedPrompt = String(body?.messages?.[1]?.content || '');

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: '## Giris\n\nRevize metin.',
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

  const result = await editBlogPost(
    '## Giris\n\nEski metin.',
    'Anahtar kelime kullanimini daha dogal hale getir.',
    'Qualy',
    'Lead Scoring',
    'Sales teams',
    'AI sales assistant',
    'TR'
  );

  assert.equal(result?.includes('## Giris'), true);
  assert.match(capturedPrompt, /Use target keywords naturally across the revised article/i);
  assert.match(capturedPrompt, /Avoid repetitive wording, repeated sentence openings, and obvious phrase recycling/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('generateBlogPost keeps inline alt text in Turkish for shared TR/BOTH drafts', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callIndex += 1;

    let content = '';
    if (callIndex === 1) {
      content = JSON.stringify({
        title: 'Yapay Zeka ile Musteri Analizi',
        description: 'TR draft aciklamasi.',
        slug: 'yapay-zeka-musteri-analizi',
        categoryId: null,
        content: [
          'Giris paragrafi.',
          '',
          '## Musteri Analizi',
          '',
          `${Array.from({ length: 900 }, () => 'analiz').join(' ')} detay.`,
          '',
          '<!-- BLOG_IMAGE:image-1 -->',
        ].join('\n'),
      });
    } else if (callIndex === 2) {
      content = JSON.stringify({
        coverImagePrompt: 'Data flow for customer analysis',
        coverAltText: 'Musteri analizi kapak gorseli',
        inlineImages: [
          {
            slotId: 'image-1',
            prompt: 'Editorial photo: team analyzing customer data',
            altText: 'Business team reviewing AI dashboard',
          },
        ],
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
    'Customer Analysis',
    'Sales teams',
    'AI sales assistant',
    'Yapay zeka ile musteri analizi rehberi',
    'musteri analizi, yapay zeka',
    'Professional & Informative',
    'Short (800 - 1100 words)',
    'TR',
    'Editorial B2B (minimal cover, realistic inline, brandless)'
  );

  assert.equal(result?.inlineImages.length, 1);
  assert.equal(result?.inlineImages[0]?.slotId, 'image-1');
  assert.equal(result?.inlineImages[0]?.altText?.includes('Business team'), false);
  assert.equal(result?.inlineImages[0]?.altText?.toLocaleLowerCase('tr-TR').includes('görseli'), true);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('generateBlogPost inserts two inline image slots for long articles when none are returned', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    callIndex += 1;

    const content = callIndex === 1
      ? JSON.stringify({
          title: 'Uzun Veri Analizi Rehberi',
          description: 'Uzun TR taslak.',
          slug: 'uzun-veri-analizi-rehberi',
          categoryId: null,
          content: [
            'Giris paragrafi.',
            '',
            '## Veri Toplama',
            '',
            `${Array.from({ length: 850 }, () => 'veri').join(' ')} toplama detaylari.`,
            '',
            '## Skorlama',
            '',
            `${Array.from({ length: 850 }, () => 'skorlama').join(' ')} skorlama detaylari.`,
            '',
            '## Operasyonel Uygulama',
            '',
            `${Array.from({ length: 850 }, () => 'operasyon').join(' ')} uygulama detaylari.`,
          ].join('\n'),
        })
      : JSON.stringify({
          coverImagePrompt: 'Data operations workflow',
          coverAltText: 'Veri analizi kapak gorseli',
          inlineImages: [],
        });

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
    'Analytics',
    'Revenue teams',
    'AI sales assistant',
    'Uzun veri analizi rehberi',
    'veri analizi, skorlama',
    'Professional & Informative',
    'Long (1800 - 2600 words)',
    'TR',
    'Editorial B2B (minimal cover, realistic inline, brandless)'
  );

  assert.equal(callIndex, 2);
  assert.equal(result?.content.includes('<!-- BLOG_IMAGE:image-1 -->'), true);
  assert.equal(result?.content.includes('<!-- BLOG_IMAGE:image-2 -->'), true);
  assert.equal(result?.inlineImages.length, 2);

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
      keywords: 'AI lead scoring, conversion rate, engagement, urun notu, conversion rate',
      categoryId: 'cat-sales',
      keywordStrategy: {
        primaryKeyword: 'AI lead scoring',
        secondaryKeywords: ['conversion rate', 'engagement'],
        supportKeywords: ['hazir yanitlar', 'urun notu'],
        longTailKeywords: ['hazir yanitlar nasil kullanilir'],
        semanticKeywords: ['workflow', 'sales funnel'],
      },
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
  assert.equal(normalized?.keywords.includes('ürün notu'), false);
  assert.equal(
    normalized?.keywords,
    'yapay zeka müşteri adayı puanlama, dönüşüm oranı, etkileşim, hazır yanıtlar, hazır yanıtlar nasıl kullanılır'
  );
  assert.equal(normalized?.keywordStrategy?.primaryKeyword, 'yapay zeka müşteri adayı puanlama');
  assert.deepEqual(normalized?.keywordStrategy?.secondaryKeywords, ['dönüşüm oranı', 'etkileşim']);
  assert.deepEqual(normalized?.keywordStrategy?.supportKeywords, ['hazır yanıtlar']);
  assert.deepEqual(normalized?.keywordStrategy?.longTailKeywords, ['hazır yanıtlar nasıl kullanılır']);
  assert.deepEqual(normalized?.keywordStrategy?.semanticKeywords, ['iş akışı', 'satış hunisi']);
  assert.equal(normalized?.reason.includes('müşteri adayı puanlama'), true);
  assert.deepEqual(normalized?.excludedRecentTitles, ['Eski Yazi 1', 'Eski Yazi 2']);
  assert.equal(normalized?.categoryId, 'cat-sales');
});

test('generateTopicIdeas asks for marketing-manager style keyword sets', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let capturedPrompt = '';

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    capturedPrompt = String(body?.messages?.[1]?.content || '');

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    topic: 'WhatsApp otomasyonunda müşteri adayı önceliklendirme rehberi',
                    keywords: 'whatsapp otomasyonu, müşteri adayı önceliklendirme, satış ekibi iş akışı',
                    categoryId: null,
                    keywordStrategy: {
                      primaryKeyword: 'whatsapp otomasyonu',
                      secondaryKeywords: ['müşteri adayı önceliklendirme', 'satış ekibi iş akışı'],
                      supportKeywords: ['otomatik yanıt', 'mesaj önceliklendirme'],
                      longTailKeywords: ['whatsapp otomasyonunda müşteri adayı önceliklendirme nasıl yapılır'],
                      semanticKeywords: ['yanıt süresi', 'nitelikli talep'],
                    },
                    reason: 'Qualified talebi büyütür.',
                    categoryGap: 'Bu açı daha az işlendi.',
                    excludedRecentTitles: [],
                  },
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

  const result = await generateTopicIdeas(
    'Qualy',
    'WhatsApp automation',
    'Revenue teams',
    'Inbox automation for sales and support',
    'TR'
  );

  assert.equal(result?.length, 1);
  assert.equal(result?.[0]?.keywordStrategy?.primaryKeyword, 'whatsapp otomasyonu');
  assert.match(capturedPrompt, /senior SEO content strategist and B2B SaaS marketing manager/i);
  assert.match(capturedPrompt, /qualified organic traffic/i);
  assert.match(capturedPrompt, /primary keyword, 3-6 secondary keywords, 5-10 support keywords, 4-8 long-tail keywords, and 8-15 semantic keywords/i);
  assert.match(capturedPrompt, /Avoid generic announcement or vanity phrases/i);
  assert.match(capturedPrompt, /keywordStrategy:/i);
  assert.match(capturedPrompt, /primaryKeyword: exactly 1 main keyword/i);
  assert.match(capturedPrompt, /longTailKeywords: 4-8 longer user-intent phrases/i);
  assert.match(capturedPrompt, /ürün notu/i);
  assert.match(capturedPrompt, /Diversify the batch across multiple categories and intent types/i);
  assert.match(capturedPrompt, /Do not default to Vaka Analizi/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('generateBlogPost prompt includes grouped keyword roles when a structured strategy is available', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callIndex += 1;
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    const content = callIndex === 1
      ? JSON.stringify({
          title: 'WhatsApp Müşteri Hizmetleri Otomasyonu Rehberi',
          description: 'Mesajlaşma ekipleri için otomasyon rehberi.',
          slug: 'whatsapp-musteri-hizmetleri-otomasyonu-rehberi',
          categoryId: null,
          content: [
            'Giriş paragrafı.',
            '',
            '## WhatsApp Müşteri Hizmetleri Otomasyonu',
            '',
            `${Array.from({ length: 850 }, () => 'otomasyon').join(' ')} detaylı uygulama rehberi.`,
          ].join('\n'),
        })
      : JSON.stringify({
          coverImagePrompt: 'Editorial messaging operations workflow',
          coverAltText: 'WhatsApp otomasyon kapak görseli',
          inlineImages: [],
        });

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

  await generateBlogPost(
    'Qualy',
    'WhatsApp Automation',
    'Support teams',
    'AI inbox for service teams',
    'WhatsApp müşteri hizmetleri otomasyonu nasıl kurulur',
    'whatsapp müşteri hizmetleri otomasyonu, whatsapp otomatik cevap',
    'Professional & Informative',
    'Short (800 - 1100 words)',
    'TR',
    'Editorial B2B (minimal cover, realistic inline, brandless)',
    [],
    [],
    {
      primaryKeyword: 'whatsapp müşteri hizmetleri otomasyonu',
      secondaryKeywords: ['whatsapp otomatik cevap', 'whatsapp otomatik mesaj'],
      supportKeywords: ['müşteri mesajlarına otomatik cevap', 'whatsapp business otomasyonu'],
      longTailKeywords: ['whatsapp müşteri hizmetleri otomasyonu nasıl kurulur'],
      semanticKeywords: ['yanıt süresi', 'mesaj trafiği', 'müşteri memnuniyeti'],
    }
  );

  assert.equal(callIndex, 2);
  assert.match(prompts[0] || '', /STRUCTURED KEYWORD STRATEGY:/i);
  assert.match(prompts[0] || '', /Primary keyword:\s+whatsapp müşteri hizmetleri otomasyonu/i);
  assert.match(prompts[0] || '', /Secondary keywords:\s+whatsapp otomatik cevap, whatsapp otomatik mesaj/i);
  assert.match(prompts[0] || '', /Long-tail keywords:\s+whatsapp müşteri hizmetleri otomasyonu nasıl kurulur/i);
  assert.match(prompts[0] || '', /Semantic keywords:\s+yanıt süresi, mesaj trafiği, müşteri memnuniyeti/i);
  assert.match(prompts[0] || '', /Primary keyword must appear naturally in the SEO title, intro, at least one H2, and the meta description/i);
  assert.match(prompts[0] || '', /Long-tail keywords should be used in H2\/H3 and FAQ-style sections/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('generateBlogPost localizes generic English product anchor text in Turkish drafts', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let callIndex = 0;

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    callIndex += 1;

    const content = callIndex === 1
      ? JSON.stringify({
          title: 'WhatsApp Otomasyonu Rehberi',
          description: 'TR açıklama.',
          slug: 'whatsapp-otomasyonu-rehberi',
          categoryId: null,
          content: [
            'Giriş paragrafı.',
            '',
            '## Sonuç ve Çağrı',
            '',
            `${Array.from({ length: 850 }, () => 'otomasyon').join(' ')} Daha fazlası için [Our Product](https://www.askqualy.com) sayfamızı ziyaret edin.`,
          ].join('\n'),
        })
      : JSON.stringify({
          coverImagePrompt: 'Editorial messaging workflow',
          coverAltText: 'Kapak görseli',
          inlineImages: [],
        });

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
    'WhatsApp Automation',
    'Support teams',
    'AI inbox for service teams',
    'WhatsApp otomasyonu nasıl kurulur',
    'whatsapp otomasyonu, otomatik yanıt',
    'Professional & Informative',
    'Short (800 - 1100 words)',
    'TR',
    'Editorial B2B (minimal cover, realistic inline, brandless)'
  );

  assert.equal(callIndex, 2);
  assert.equal(result?.content.includes('[Our Product]'), false);
  assert.equal(result?.content.includes('[ürün]'), true);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('regenerateBlogTitles rebuilds TR and EN titles with matching slugs from article bodies', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const capturedPrompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    capturedPrompts.push(String(body?.messages?.[1]?.content || ''));
    const prompt = capturedPrompts[capturedPrompts.length - 1] || '';

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: /Language:\s+Turkish/i.test(prompt)
                  ? 'WhatsApp müşteri adayı önceliklendirme rehberi'
                  : 'WhatsApp lead prioritization guide',
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

  const result = await regenerateBlogTitles({
    content: '## Giriş\n\nBu yazı WhatsApp otomasyonunda müşteri adayı önceliklendirme sürecini anlatır.',
    contentEN: '## Introduction\n\nThis article explains WhatsApp lead prioritization workflows.',
    currentTitle: 'Eski Başlık',
    currentTitleEN: 'Old Title',
    description: 'Satış ekipleri için kısa açıklama.',
    descriptionEN: 'Short description for revenue teams.',
    keywords: 'whatsapp otomasyonu, müşteri adayı önceliklendirme',
  });

  assert.deepEqual(result, {
    title: 'WhatsApp müşteri adayı önceliklendirme rehberi',
    slug: 'whatsapp-musteri-adayi-onceliklendirme-rehberi',
    titleEN: 'WhatsApp lead prioritization guide',
    slugEN: 'whatsapp-lead-prioritization-guide',
  });
  assert.equal(capturedPrompts.length, 2);
  assert.match(capturedPrompts[0] || '', /Regenerate the article title based on the finished article below/i);
  assert.match(capturedPrompts[0] || '', /Must be at most 70 characters/i);
  assert.match(capturedPrompts[0] || '', /Current Title:\s+Eski Başlık/i);
  assert.match(capturedPrompts[0] || '', /Language:\s+Turkish/i);
  assert.match(capturedPrompts[1] || '', /Current Title:\s+Old Title/i);
  assert.match(capturedPrompts[1] || '', /Language:\s+English/i);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('addInternalLinks retries when the first AI revision does not add any real internal links', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    const content = prompts.length === 1
      ? '## Giris\n\nMusteri adayi yonetimi sureci burada anlatiliyor.'
      : '## Giris\n\n[Lead routing rehberi](/blog/lead-routing-rehberi) ile sureci detaylandir.';

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

  const result = await addInternalLinks(
    '## Giris\n\nMusteri adayi yonetimi sureci burada anlatiliyor.',
    [
      {
        title: 'Lead routing rehberi',
        slug: 'lead-routing-rehberi',
        language: 'tr',
      },
    ],
    'TR',
    'Qualy',
    'Lead routing'
  );

  assert.equal(prompts.length, 2);
  assert.match(prompts[1] || '', /You must add at least one exact internal link/i);
  assert.equal(result?.includes('](/blog/lead-routing-rehberi)'), true);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('addInternalLinks accepts a repaired real link even when the draft previously contained a bogus internal url', async () => {
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
              content: '## Giris\n\n[Gercek rehber](/blog/gercek-rehber) ile sureci tamamla.',
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

  const result = await addInternalLinks(
    '## Giris\n\n[Uydurma link](/blog/olmayan-link) ile sureci anlat.',
    [
      {
        title: 'Gercek rehber',
        slug: 'gercek-rehber',
        language: 'tr',
      },
    ],
    'TR',
    'Qualy',
    'Lead routing'
  );

  assert.equal(prompts.length, 1);
  assert.equal(result?.includes('](/blog/gercek-rehber)'), true);
  assert.equal(result?.includes('/blog/olmayan-link'), false);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});

test('addInternalLinks injects a deterministic fallback link when both AI passes fail', async () => {
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
              content: '## Giris\n\nMusteri adayi yonetimi sureci burada anlatiliyor.',
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

  const result = await addInternalLinks(
    '## Giris\n\nMusteri adayi yonetimi sureci burada anlatiliyor.',
    [
      {
        title: 'Musteri adayi skorlama yontemleri',
        slug: 'musteri-adayi-skorlama-yontemleri',
        language: 'tr',
      },
    ],
    'TR',
    'Qualy',
    'Lead routing'
  );

  assert.equal(prompts.length, 2);
  assert.equal(result?.includes('](/blog/musteri-adayi-skorlama-yontemleri)'), true);

  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAiKey;
});
