import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSeoForBlog, generateCopyIdeas, planVisualPrompt, regenerateBlogTitles } from '../../src/services/gemini';

test('analyzeSeoForBlog sends image alt-text fields to the backend', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: {
          score: 88,
          keywords: [{ word: 'qualy', count: 2 }],
          suggestions: [],
        },
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
      coverAltText: 'Revenue team dashboard',
      inlineImages: [
        { slotId: 'image-1', altText: 'Lead routing workflow' },
        { slotId: 'image-2', altText: '' },
      ],
    }
  );

  assert.equal(result?.score, 88);
  assert.equal(payload?.coverAltText, 'Revenue team dashboard');
  assert.deepEqual(payload?.inlineImages, [
    { slotId: 'image-1', altText: 'Lead routing workflow' },
    { slotId: 'image-2', altText: '' },
  ]);

  global.fetch = originalFetch;
});

test('regenerateBlogTitles sends the bilingual article context to the backend', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: {
          title: 'Yeni Başlık',
          slug: 'yeni-baslik',
          titleEN: 'New Title',
          slugEN: 'new-title',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await regenerateBlogTitles({
    content: '## Giriş\n\nMakale içeriği.',
    contentEN: '## Introduction\n\nArticle content.',
    currentTitle: 'Eski Başlık',
    currentTitleEN: 'Old Title',
    description: 'Kısa açıklama',
    descriptionEN: 'Short description',
    keywords: 'whatsapp otomasyonu',
  });

  assert.deepEqual(result, {
    title: 'Yeni Başlık',
    slug: 'yeni-baslik',
    titleEN: 'New Title',
    slugEN: 'new-title',
  });
  assert.equal(payload?.content, '## Giriş\n\nMakale içeriği.');
  assert.equal(payload?.contentEN, '## Introduction\n\nArticle content.');
  assert.equal(payload?.currentTitle, 'Eski Başlık');
  assert.equal(payload?.currentTitleEN, 'Old Title');
  assert.equal(payload?.description, 'Kısa açıklama');
  assert.equal(payload?.descriptionEN, 'Short description');
  assert.equal(payload?.keywords, 'whatsapp otomasyonu');

  global.fetch = originalFetch;
});

test('generateCopyIdeas sends the optional AI idea emphasis to the backend', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: {
          headlines: ['See what matters first'],
          subheadlines: ['Focus on the highest-intent conversations.'],
          ctas: ['Try Qualy'],
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await generateCopyIdeas(
    'Qualy',
    'AI Inbox',
    'Unified inbox for support and sales teams.',
    'Instagram',
    'Product promotion',
    'Professional',
    'EN',
    'Lead kalitesini ve dönüşümü vurgula'
  );

  assert.deepEqual(result, {
    headlines: ['See what matters first'],
    subheadlines: ['Focus on the highest-intent conversations.'],
    ctas: ['Try Qualy'],
  });
  assert.equal(payload?.ideaAngle, 'Lead kalitesini ve dönüşümü vurgula');

  global.fetch = originalFetch;
});

test('planVisualPrompt sends the planner payload to the backend', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: {
          prompt: 'Gemini render prompt',
          styleName: 'Quiet Signal',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await planVisualPrompt({
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
    designStyle: 'Quiet Signal Editorial',
    mode: 'Social Media Promo',
    language: 'EN',
    customInstruction: '',
    campaignFocus: 'Lead handoff speed',
    variationIndex: 3,
    hasScreenshots: true,
    hasReferenceImage: true,
    isMagicEdit: false,
    userComment: 'Reduce clutter',
  });

  assert.deepEqual(result, {
    prompt: 'Gemini render prompt',
    styleName: 'Quiet Signal',
  });
  assert.equal(payload?.platform, 'Instagram');
  assert.equal(payload?.aspectRatio, '4:5');
  assert.equal(payload?.hasScreenshots, true);
  assert.equal(payload?.hasReferenceImage, true);
  assert.equal(payload?.userComment, 'Reduce clutter');

  global.fetch = originalFetch;
});
