import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEditorialBlogImagePrompt, selectRelevantSanityPosts } from '../../src/server/gemini';

test('selects relevant sanity posts by overlap and recency', () => {
  const selected = selectRelevantSanityPosts(
    [
      {
        title: 'Instagram Request Badge Logic',
        slug: 'instagram-request-badge',
        excerpt: 'How request classification works in Inbox',
        publishedAt: '2026-03-19T09:00:00.000Z',
      },
      {
        title: 'Calendar Booking Rules',
        slug: 'calendar-booking-rules',
        excerpt: 'Business hours and minimum notice',
        publishedAt: '2026-03-18T09:00:00.000Z',
      },
      {
        title: 'Generic Product Update',
        slug: 'generic-update',
        excerpt: 'A broad update post',
        publishedAt: '2026-01-10T09:00:00.000Z',
      },
    ],
    'instagram webhook request inbox handoff strategy',
    2
  );

  assert.equal(selected.length, 2);
  assert.equal(selected[0]?.slug, 'instagram-request-badge');
});

test('deduplicates posts by slug while ranking relevance', () => {
  const selected = selectRelevantSanityPosts(
    [
      {
        title: 'WhatsApp Template Guide',
        slug: 'whatsapp-template-guide',
        publishedAt: '2026-03-10T09:00:00.000Z',
      },
      {
        title: 'WhatsApp Template Guide (Duplicate)',
        slug: 'whatsapp-template-guide',
        publishedAt: '2026-03-11T09:00:00.000Z',
      },
      {
        title: 'Lead Qualification Checklist',
        slug: 'lead-qualification-checklist',
        publishedAt: '2026-03-09T09:00:00.000Z',
      },
    ],
    'whatsapp templates and response windows',
    10
  );

  const slugs = selected.map((post) => post.slug);
  const uniqueSlugCount = new Set(slugs).size;
  assert.equal(slugs.length, uniqueSlugCount);
  assert.equal(slugs[0], 'whatsapp-template-guide');
});

test('builds a strict no-text editorial cover prompt', () => {
  const prompt = buildEditorialBlogImagePrompt('Conceptual image for sales automation', true);

  assert.equal(prompt.toLowerCase().includes('no text'), true);
  assert.equal(prompt.toLowerCase().includes('no letters'), true);
  assert.equal(prompt.toLowerCase().includes('no logos'), true);
  assert.equal(prompt.toLowerCase().includes('minimal'), true);
  assert.equal(prompt.toLowerCase().includes('cartoon'), true);
  assert.equal(prompt.toLowerCase().includes('glassmorphism'), true);
  assert.equal(prompt.toLowerCase().includes('1-2'), true);
  assert.equal(prompt.toLowerCase().includes('clutter'), true);
  assert.equal(prompt.toLowerCase().includes('dark graphite'), true);
  assert.equal(prompt.toLowerCase().includes('deep navy'), true);
  assert.equal(prompt.toLowerCase().includes('frosted glass tile'), true);
  assert.equal(prompt.toLowerCase().includes('no people'), true);
  assert.equal(prompt.toLowerCase().includes('avoid empty generic glass tiles'), true);
});

test('builds a strict no-text editorial inline prompt', () => {
  const prompt = buildEditorialBlogImagePrompt('Abstract visual for integrations', false);

  assert.equal(prompt.toLowerCase().includes('no visible text'), true);
  assert.equal(prompt.toLowerCase().includes('negative space'), true);
  assert.equal(prompt.toLowerCase().includes('single focal subject'), true);
  assert.equal(prompt.toLowerCase().includes('infographic'), true);
  assert.equal(prompt.toLowerCase().includes('realistic editorial photography'), true);
  assert.equal(prompt.toLowerCase().includes('clean simplified explainer card'), true);
  assert.equal(prompt.toLowerCase().includes('publication-grade realism'), true);
});
