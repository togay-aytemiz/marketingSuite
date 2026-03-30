import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVisualReferenceParts, createInlineImagePart } from '../../src/server/visual-image-parts';

test('createInlineImagePart rejects unsupported svg data urls for gemini image inputs', () => {
  const part = createInlineImagePart('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');

  assert.equal(part, null);
});

test('buildVisualReferenceParts skips unsupported svg brand references but keeps raster inputs', () => {
  const parts = buildVisualReferenceParts({
    images: ['data:image/png;base64,SCREENSHOT'],
    referenceImage: 'data:image/jpeg;base64,REFERENCE',
    brandReferenceImages: [
      'data:image/svg+xml;base64,LOGO',
      'data:image/svg+xml;base64,ICON',
    ],
  });

  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((part) => part.inlineData.mimeType), [
    'image/png',
    'image/jpeg',
  ]);
});

test('buildVisualReferenceParts keeps only the previous image during magic edit', () => {
  const parts = buildVisualReferenceParts({
    images: ['data:image/png;base64,SCREENSHOT'],
    previousImage: 'data:image/png;base64,PREVIOUS',
    referenceImage: 'data:image/jpeg;base64,REFERENCE',
    brandReferenceImages: [
      'data:image/svg+xml;base64,LOGO',
      'data:image/svg+xml;base64,ICON',
    ],
  });

  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0], {
    inlineData: {
      mimeType: 'image/png',
      data: 'PREVIOUS',
    },
  });
});
