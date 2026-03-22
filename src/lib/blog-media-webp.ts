import type { BlogInlineImagePlan } from './blog-image-slots';

export interface BlogPublishMediaBundle {
  coverImageDataUrl?: string;
  coverImageDataUrlEN?: string;
  inlineImages: BlogInlineImagePlan[];
}

export type BlogImageDataUrlConverter = (dataUrl: string) => Promise<string>;

const CONVERTIBLE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);

function normalizeWhitespace(value: string) {
  return String(value || '').trim();
}

function parseDataUrlMimeType(dataUrl: string) {
  const match = normalizeWhitespace(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  return match?.[1]?.toLowerCase() || '';
}

export function shouldConvertImageDataUrlToWebp(dataUrl: string | null | undefined) {
  const mimeType = parseDataUrlMimeType(String(dataUrl || ''));
  return CONVERTIBLE_IMAGE_MIME_TYPES.has(mimeType);
}

export function isWebpImageDataUrl(dataUrl: string | null | undefined) {
  return parseDataUrlMimeType(String(dataUrl || '')) === 'image/webp';
}

async function convertMediaDataUrlWithFallback(
  dataUrl: string | null | undefined,
  convert: BlogImageDataUrlConverter,
  cache: Map<string, Promise<string>>
) {
  const normalized = normalizeWhitespace(String(dataUrl || ''));
  if (!normalized || !shouldConvertImageDataUrlToWebp(normalized)) {
    return normalized;
  }

  if (!cache.has(normalized)) {
    cache.set(
      normalized,
      Promise.resolve(convert(normalized))
        .then((converted) => (isWebpImageDataUrl(converted) ? converted : normalized))
        .catch(() => normalized)
    );
  }

  return cache.get(normalized) || normalized;
}

export async function convertBlogPublishMediaToWebp(
  media: BlogPublishMediaBundle,
  convert: BlogImageDataUrlConverter
): Promise<BlogPublishMediaBundle> {
  const cache = new Map<string, Promise<string>>();
  const [coverImageDataUrl, coverImageDataUrlEN, inlineImages] = await Promise.all([
    convertMediaDataUrlWithFallback(media.coverImageDataUrl, convert, cache),
    convertMediaDataUrlWithFallback(media.coverImageDataUrlEN, convert, cache),
    Promise.all(
      (media.inlineImages || []).map(async (image) => ({
        ...image,
        dataUrl: await convertMediaDataUrlWithFallback(image.dataUrl, convert, cache),
      }))
    ),
  ]);

  return {
    coverImageDataUrl,
    coverImageDataUrlEN,
    inlineImages,
  };
}

export async function convertImageDataUrlToWebp(dataUrl: string, quality = 0.86) {
  const normalized = normalizeWhitespace(dataUrl);
  if (!shouldConvertImageDataUrlToWebp(normalized)) {
    return normalized;
  }

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return normalized;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Failed to load image for WebP conversion.'));
    nextImage.src = normalized;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');

  if (!context || canvas.width <= 0 || canvas.height <= 0) {
    return normalized;
  }

  context.drawImage(image, 0, 0);
  const converted = canvas.toDataURL('image/webp', quality);
  return isWebpImageDataUrl(converted) ? converted : normalized;
}
