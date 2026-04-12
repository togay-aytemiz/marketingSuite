import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSeoForBlog,
  generateCopyIdeas,
  generateSocialPostVisual,
  planSocialPostPrompt,
  planVisualPrompt,
  regenerateBlogTitles,
} from '../../src/services/gemini';

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
    'Lead kalitesini ve dönüşümü vurgula',
    false
  );

  assert.deepEqual(result, {
    headlines: ['See what matters first'],
    subheadlines: ['Focus on the highest-intent conversations.'],
    ctas: ['Try Qualy'],
  });
  assert.equal(payload?.ideaAngle, 'Lead kalitesini ve dönüşümü vurgula');
  assert.equal(payload?.includeCta, false);

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
    includeCta: false,
    brandColor: '#84CC16',
    platform: 'Instagram',
    campaignType: 'Product promotion',
    aspectRatio: '4:5',
    tone: 'Professional',
    designStyle: 'Quiet Signal Editorial',
    theme: 'mixed',
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
  assert.equal(payload?.theme, 'mixed');
  assert.equal(payload?.includeCta, false);
  assert.equal(payload?.hasScreenshots, true);
  assert.equal(payload?.hasReferenceImage, true);
  assert.equal(payload?.userComment, 'Reduce clutter');

  global.fetch = originalFetch;
});

test('planSocialPostPrompt sends theme, category, and per-image focus to the backend', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: {
          prompt: 'Gemini social post render prompt',
          headline: 'Yapay zeka skoru öne çıkarır',
          subheadline: 'Doğru sohbeti önce görün.',
          styleName: 'Social Post System',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await planSocialPostPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'new_feature',
    language: 'TR',
    focus: 'AI automatically tagging conversations',
    blogContent: '',
    extraInstruction: 'Use floating tags around the hero card.',
    variationIndex: 2,
    hasReferenceImage: true,
  });

  assert.deepEqual(result, {
    prompt: 'Gemini social post render prompt',
    headline: 'Yapay zeka skoru öne çıkarır',
    subheadline: 'Doğru sohbeti önce görün.',
    styleName: 'Social Post System',
  });
  assert.equal(payload?.platform, 'Instagram');
  assert.equal(payload?.theme, 'dark');
  assert.equal(payload?.category, 'new_feature');
  assert.equal(payload?.language, 'TR');
  assert.equal(payload?.focus, 'AI automatically tagging conversations');
  assert.equal(payload?.blogContent, '');
  assert.equal(payload?.extraInstruction, 'Use floating tags around the hero card.');
  assert.equal(payload?.variationIndex, 2);
  assert.equal(payload?.hasReferenceImage, true);

  global.fetch = originalFetch;
});

test('generateSocialPostVisual asks Gemini for a text-free base while passing lockup copy through for app overlay', async () => {
  const originalFetch = global.fetch;
  let payload: Record<string, unknown> | null = null;

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        result: 'data:image/png;base64,social-post',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  const result = await generateSocialPostVisual({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'LinkedIn',
    aspectRatio: '1:1',
    theme: 'light',
    language: 'TR',
    plannedPrompt: 'Gemini social post render prompt',
    headline: 'Önemli sohbetleri önce gör',
    subheadline: 'Yapay zeka hangi leadin sıcak olduğunu öne çıkarsın.',
    category: 'product_overview',
    focus: 'AI reply for Instagram',
    referenceImage: 'data:image/png;base64,reference',
    previousImage: 'data:image/png;base64,previous',
    userComment: 'Reduce the glow and simplify the card stack.',
  });

  assert.equal(result, 'data:image/png;base64,social-post');
  assert.equal(payload?.platform, 'LinkedIn');
  assert.equal(payload?.aspectRatio, '1:1');
  assert.equal(payload?.theme, 'light');
  assert.equal(payload?.language, 'TR');
  assert.equal(payload?.campaignType, 'Product overview');
  assert.equal(payload?.customInstruction, 'AI reply for Instagram');
  assert.equal(payload?.campaignFocus, 'AI reply for Instagram');
  assert.equal(payload?.plannedPrompt, 'Gemini social post render prompt');
  assert.equal(payload?.headline, 'Önemli sohbetleri önce gör');
  assert.equal(payload?.subheadline, 'Yapay zeka hangi leadin sıcak olduğunu öne çıkarsın.');
  assert.equal(payload?.referenceImage, 'data:image/png;base64,reference');
  assert.equal(payload?.renderText, false);
  assert.equal(payload?.includeCta, false);
  assert.equal(payload?.attachBrandReferences, true);
  assert.equal(payload?.brandReferenceTheme, 'light');
  assert.equal(payload?.brandReferenceKind, 'logo');
  assert.equal(payload?.requireBrandPlacement, false);
  assert.equal(payload?.userComment, 'Reduce the glow and simplify the card stack.');

  global.fetch = originalFetch;
});
