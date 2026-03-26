import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMediaGenerationSummary,
  resolveMediaPreviewState,
} from '../../src/lib/blog-media-progress';

test('prefers loading state over empty cover placeholder while background generation is running', () => {
  const result = resolveMediaPreviewState({
    kind: 'cover',
    loading: true,
    imageUrl: null,
  });

  assert.deepEqual(result, {
    status: 'loading',
    title: 'Cover is generating',
    description: 'This runs automatically in the background. The preview will appear here as soon as it is ready.',
  });
});

test('returns the empty inline placeholder when no image is loading yet', () => {
  const result = resolveMediaPreviewState({
    kind: 'inline',
    loading: false,
    imageUrl: null,
  });

  assert.deepEqual(result, {
    status: 'empty',
    title: 'Inline visual not generated',
    description: 'Keep this image realistic, restrained, and suitable for an editorial article.',
  });
});

test('returns ready state when a generated image url exists', () => {
  const result = resolveMediaPreviewState({
    kind: 'inline',
    loading: true,
    imageUrl: 'data:image/webp;base64,abc123',
  });

  assert.deepEqual(result, {
    status: 'ready',
    title: null,
    description: null,
  });
});

test('builds a pending media summary when cover and inline jobs are still running', () => {
  const result = buildMediaGenerationSummary({
    coverLoading: true,
    inlineLoadingCount: 2,
  });

  assert.deepEqual(result, {
    pendingAssetCount: 3,
    title: 'Visuals are generating automatically',
    description: '3 assets are still being prepared in the background. You can keep editing while previews continue to fill in.',
  });
});

test('omits the summary when no media jobs are pending', () => {
  const result = buildMediaGenerationSummary({
    coverLoading: false,
    inlineLoadingCount: 0,
  });

  assert.equal(result, null);
});
