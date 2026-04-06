import fs from 'node:fs/promises';
import path from 'node:path';

import {
  getThemeMatchedVisualBrandReferenceAssetCandidate,
  getVisualBrandReferenceAssetCandidates,
} from '../lib/visual-brand-profile';

export interface GeminiInlineImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

interface VisualReferencePartsInput {
  images?: string[];
  previousImage?: string;
  referenceImage?: string | null;
  brandReferenceImages?: string[];
}

interface LoadVisualBrandReferenceImagesInput {
  theme?: 'light' | 'dark' | 'mixed';
  kind?: 'logo' | 'icon' | 'any';
}

function inferImageMimeType(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.svg')) {
    return null;
  }

  if (lower.endsWith('.png')) {
    return 'image/png';
  }

  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return 'image/png';
}

export function createInlineImagePart(dataUrl?: string | null): GeminiInlineImagePart | null {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = String(match[1] || '').toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) {
    return null;
  }

  return {
    inlineData: {
      mimeType,
      data: match[2],
    },
  };
}

export function buildVisualReferenceParts(input: VisualReferencePartsInput): GeminiInlineImagePart[] {
  const images = Array.isArray(input.images) ? input.images : [];
  const brandReferenceImages = Array.isArray(input.brandReferenceImages) ? input.brandReferenceImages : [];
  const previousPart = createInlineImagePart(input.previousImage);

  if (previousPart) {
    return [
      previousPart,
      createInlineImagePart(input.referenceImage),
      ...brandReferenceImages.map((image) => createInlineImagePart(image)).filter(Boolean),
    ].filter(Boolean) as GeminiInlineImagePart[];
  }

  return [
    ...images.map((image) => createInlineImagePart(image)).filter(Boolean),
    createInlineImagePart(input.referenceImage),
    ...brandReferenceImages.map((image) => createInlineImagePart(image)).filter(Boolean),
  ].filter(Boolean) as GeminiInlineImagePart[];
}

const cachedBrandReferenceImages = new Map<string, string[]>();

export async function loadVisualBrandReferenceImages(input: LoadVisualBrandReferenceImagesInput = {}) {
  const theme = input.theme || 'mixed';
  const kind = input.kind || 'any';
  const cacheKey = `${theme}:${kind}`;
  const cached = cachedBrandReferenceImages.get(cacheKey);
  if (cached) {
    return cached;
  }

  const brandReferenceImages: string[] = [];
  const candidates =
    theme !== 'mixed' && kind !== 'any'
      ? [getThemeMatchedVisualBrandReferenceAssetCandidate(theme, kind)].filter(Boolean)
      : getVisualBrandReferenceAssetCandidates().filter((asset) => kind === 'any' || asset.kind === kind);

  for (const asset of candidates) {
    const absolutePath = path.resolve(process.cwd(), asset.relativePath);

    try {
      const buffer = await fs.readFile(absolutePath);
      const mimeType = inferImageMimeType(asset.fileName);
      if (!mimeType) {
        continue;
      }
      brandReferenceImages.push(`data:${mimeType};base64,${buffer.toString('base64')}`);
    } catch {
      // Ignore missing brand asset files and continue with any others that exist.
    }
  }

  if (brandReferenceImages.length > 0) {
    cachedBrandReferenceImages.set(cacheKey, brandReferenceImages);
  }
  return brandReferenceImages;
}
