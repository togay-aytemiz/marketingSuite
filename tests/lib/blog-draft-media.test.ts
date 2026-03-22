import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArticlePreviewMarkdown,
  buildInlineImagePlacementSummaries,
  cleanDraftMarkdownArtifacts,
  migrateLegacyImagePromptsToSlots,
  sanitizeEditorialPromptText,
} from '../../src/lib/blog-draft-media';
import {
  finalizeCoverImagePromptText,
  finalizeInlineImagePromptText,
} from '../../src/lib/editorial-cover-style';

test('cleans orphan bracket lines from draft markdown', () => {
  const cleaned = cleanDraftMarkdownArtifacts(`
## Baslik

]

Metin.

[
`);

  assert.equal(cleaned.includes('\n]\n'), false);
  assert.equal(cleaned.includes('\n[\n'), false);
  assert.equal(cleaned.includes('Metin.'), true);
});

test('migrates legacy image prompts to slot markers and keeps image plans', () => {
  const result = migrateLegacyImagePromptsToSlots(
    `
## Baslik

[IMAGE_PROMPT: An abstract depiction of multichannel communication with WhatsApp and Instagram logos, vibrant colors.]

Paragraf.
`,
    []
  );

  assert.equal(result.content.includes('[IMAGE_PROMPT:'), false);
  assert.equal(result.content.includes('<!-- BLOG_IMAGE:image-1 -->'), true);
  assert.equal(result.inlineImages.length, 1);
  assert.equal(result.inlineImages[0]?.slotId, 'image-1');
  assert.equal(result.inlineImages[0]?.prompt.toLowerCase().includes('logos'), false);
});

test('sanitizes editorial prompts to remove logo and noisy-style requests', () => {
  const sanitized = sanitizeEditorialPromptText(
    'An abstract depiction of multichannel communication with WhatsApp and Instagram logos, vibrant colors, app icons, glowing UI cards.'
  );

  assert.equal(sanitized.toLowerCase().includes('logos'), false);
  assert.equal(sanitized.toLowerCase().includes('vibrant colors'), false);
  assert.equal(sanitized.toLowerCase().includes('icons'), false);
  assert.equal(sanitized.toLowerCase().includes('controlled premium palette'), true);
});

test('builds article preview markdown without inline media markers', () => {
  const preview = buildArticlePreviewMarkdown(`
## Baslik

Giris paragrafi.

<!-- BLOG_IMAGE:image-1 -->

Detaylar.

[IMAGE_PROMPT: legacy prompt]
`);

  assert.equal(preview.includes('BLOG_IMAGE'), false);
  assert.equal(preview.includes('[IMAGE_PROMPT:'), false);
  assert.equal(preview.includes('Detaylar.'), true);
});

test('builds article preview markdown without markdown or html image embeds', () => {
  const preview = buildArticlePreviewMarkdown(`
## Baslik

Paragraf girisi.

![Alt metin](https://example.com/inline-image.png)

<img src="https://example.com/legacy-image.png" alt="Legacy" />

Kapanis.
`);

  assert.equal(preview.includes('!['), false);
  assert.equal(preview.toLowerCase().includes('<img'), false);
  assert.equal(preview.includes('Paragraf girisi.'), true);
  assert.equal(preview.includes('Kapanis.'), true);
});

test('dedents shared markdown indentation for article preview rendering', () => {
  const preview = buildArticlePreviewMarkdown(`
    ## Baslik

    Giris paragrafi.

    ### Ara Baslik

    Detay cumlesi.
  `);

  assert.equal(preview.startsWith('## Baslik'), true);
  assert.equal(preview.includes('\n\n### Ara Baslik'), true);
  assert.equal(preview.includes('    ##'), false);
});

test('normalizes selectively indented heading lines for article preview rendering', () => {
  const preview = buildArticlePreviewMarkdown(`
Giris paragrafi.

    ## Ara Baslik

Detay paragrafi.
  `);

  assert.equal(preview.includes('\n\n## Ara Baslik\n\n'), true);
  assert.equal(preview.includes('    ## Ara Baslik'), false);
});

test('normalizes non-breaking spaces around heading markers for article preview rendering', () => {
  const preview = buildArticlePreviewMarkdown(`
\u00A0\u00A0##\u00A0Ara Baslik

Paragraf.
  `);

  assert.equal(preview.startsWith('## Ara Baslik'), true);
  assert.equal(preview.includes('##\u00A0Ara Baslik'), false);
  assert.equal(preview.includes('\u00A0\u00A0##'), false);
});

test('strips an outer markdown code fence from article preview content', () => {
  const preview = buildArticlePreviewMarkdown(`
\`\`\`markdown
Giris paragrafi.

## Ara Baslik

Detay paragrafi.
\`\`\`
`);

  assert.equal(preview.startsWith('Giris paragrafi.'), true);
  assert.equal(preview.includes('```markdown'), false);
  assert.equal(preview.includes('\n\n## Ara Baslik\n\n'), true);
});

test('strips a leading markdown code fence even when the closing fence is missing', () => {
  const preview = buildArticlePreviewMarkdown(`
\`\`\`markdown
Giris paragrafi.

## Ara Baslik

Detay paragrafi.
`);

  assert.equal(preview.startsWith('Giris paragrafi.'), true);
  assert.equal(preview.includes('```markdown'), false);
  assert.equal(preview.includes('\n\n## Ara Baslik\n\n'), true);
});

test('extracts inline image placement summaries from slot markers', () => {
  const placements = buildInlineImagePlacementSummaries(`
## Birinci Baslik

Aciklama.

<!-- BLOG_IMAGE:image-1 -->

Bu bolum ilk gorsel ile aciklanir.

## Ikinci Baslik

<!-- BLOG_IMAGE:image_2 -->

Ikinci gorsel baglam cumlesi.
`);

  assert.equal(placements.length, 2);
  assert.equal(placements[0]?.slotId, 'image-1');
  assert.equal(placements[0]?.heading, 'Birinci Baslik');
  assert.equal(placements[0]?.context.includes('ilk gorsel'), true);
  assert.equal(placements[1]?.slotId, 'image-2');
  assert.equal(placements[1]?.heading, 'Ikinci Baslik');
});

test('finalizes cover prompt into stable premium house style', () => {
  const prompt = finalizeCoverImagePromptText('A vibrant team scene for sales automation');

  assert.equal(prompt.toLowerCase().includes('workflow'), true);
  assert.equal(prompt.toLowerCase().includes('handoff'), true);
  assert.equal(prompt.toLowerCase().includes('premium editorial'), false);
  assert.equal(prompt.split(/\s+/).length <= 12, true);
});

test('cover prompt finalization is idempotent and does not recursively expand', () => {
  const once = finalizeCoverImagePromptText('sales conversion signal with connected analytics');
  const twice = finalizeCoverImagePromptText(once);

  assert.equal(twice, once);
  assert.equal((twice.match(/analytics/gi) || []).length >= 1, true);
  assert.equal(twice.split(/\s+/).length <= 12, true);
});

test('finalizes inline prompt toward realistic professional visuals', () => {
  const prompt = finalizeInlineImagePromptText(
    'A vibrant and abstract illustration of a tech-driven sales team using AI tools, with digital gradients and futuristic elements.'
  );

  assert.equal(prompt.toLowerCase().startsWith('editorial photo:'), true);
  assert.equal(prompt.toLowerCase().includes('sales team'), true);
  assert.equal(prompt.toLowerCase().includes('futuristic elements'), false);
  assert.equal(prompt.split(/\s+/).length <= 21, true);
});

test('inline prompt finalization is idempotent and does not recursively repeat the stem', () => {
  const once = finalizeInlineImagePromptText('real-time analytics for sales conversion measurement');
  const twice = finalizeInlineImagePromptText(once);

  assert.equal(twice, once);
  assert.equal((twice.match(/clean editorial explainer card about/gi) || []).length <= 1, true);
  assert.equal((twice.match(/publication-grade editorial photograph showing/gi) || []).length <= 1, true);
});
