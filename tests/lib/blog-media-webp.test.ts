import test from 'node:test';
import assert from 'node:assert/strict';

import type { BlogInlineImagePlan } from '../../src/lib/blog-image-slots';
import { convertBlogPublishMediaToWebp } from '../../src/lib/blog-media-webp';

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6iUAAAAASUVORK5CYII=';
const JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAdEAACAQQDAQAAAAAAAAAAAAABAgMABAURBhIh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAVEQEBAAAAAAAAAAAAAAAAAAABAP/aAAwDAQACEQMRAD8A0vSUbS8dM4lF2dA//9k=';
const GIF_DATA_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const WEBP_DATA_URL =
  'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

test('converts publish media data urls to webp and deduplicates repeated sources', async () => {
  const calls: string[] = [];
  const inlineImages: BlogInlineImagePlan[] = [
    { slotId: 'image-1', prompt: 'First image', dataUrl: PNG_DATA_URL },
    { slotId: 'image-2', prompt: 'Second image', dataUrl: JPEG_DATA_URL },
    { slotId: 'image-3', prompt: 'Reused image', dataUrl: PNG_DATA_URL },
  ];

  const converted = await convertBlogPublishMediaToWebp(
    {
      coverImageDataUrl: PNG_DATA_URL,
      coverImageDataUrlEN: PNG_DATA_URL,
      inlineImages,
    },
    async (dataUrl) => {
      calls.push(dataUrl);
      if (dataUrl === PNG_DATA_URL) {
        return WEBP_DATA_URL;
      }

      return `${WEBP_DATA_URL}#jpeg`;
    }
  );

  assert.deepEqual(calls, [PNG_DATA_URL, JPEG_DATA_URL]);
  assert.equal(converted.coverImageDataUrl, WEBP_DATA_URL);
  assert.equal(converted.coverImageDataUrlEN, WEBP_DATA_URL);
  assert.equal(converted.inlineImages[0].dataUrl, WEBP_DATA_URL);
  assert.equal(converted.inlineImages[1].dataUrl, `${WEBP_DATA_URL}#jpeg`);
  assert.equal(converted.inlineImages[2].dataUrl, WEBP_DATA_URL);
});

test('preserves webp, gif, and remote image urls without invoking the converter', async () => {
  const calls: string[] = [];

  const converted = await convertBlogPublishMediaToWebp(
    {
      coverImageDataUrl: WEBP_DATA_URL,
      coverImageDataUrlEN: 'https://cdn.sanity.io/images/test/production/example.png',
      inlineImages: [
        { slotId: 'image-1', prompt: 'Animated gif', dataUrl: GIF_DATA_URL },
        { slotId: 'image-2', prompt: 'Already webp', dataUrl: WEBP_DATA_URL },
      ],
    },
    async (dataUrl) => {
      calls.push(dataUrl);
      return `${WEBP_DATA_URL}#unexpected`;
    }
  );

  assert.deepEqual(calls, []);
  assert.equal(converted.coverImageDataUrl, WEBP_DATA_URL);
  assert.equal(converted.coverImageDataUrlEN, 'https://cdn.sanity.io/images/test/production/example.png');
  assert.equal(converted.inlineImages[0].dataUrl, GIF_DATA_URL);
  assert.equal(converted.inlineImages[1].dataUrl, WEBP_DATA_URL);
});

test('falls back to original media when webp conversion fails', async () => {
  const converted = await convertBlogPublishMediaToWebp(
    {
      coverImageDataUrl: PNG_DATA_URL,
      inlineImages: [{ slotId: 'image-1', prompt: 'First image', dataUrl: JPEG_DATA_URL }],
    },
    async (dataUrl) => {
      if (dataUrl === PNG_DATA_URL) {
        throw new Error('conversion failed');
      }

      return '';
    }
  );

  assert.equal(converted.coverImageDataUrl, PNG_DATA_URL);
  assert.equal(converted.inlineImages[0].dataUrl, JPEG_DATA_URL);
});
