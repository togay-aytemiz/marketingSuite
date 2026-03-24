import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSeoForBlog } from '../../src/services/gemini';

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
