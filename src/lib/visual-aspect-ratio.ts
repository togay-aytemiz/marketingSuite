export type RequestedVisualAspectRatio = '1:1' | '4:5' | '16:9';

interface AspectCropRegion {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

const TARGET_ASPECT_RATIO: Record<RequestedVisualAspectRatio, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
};

const GEMINI_IMAGE_CONFIG_ASPECT_RATIO: Record<RequestedVisualAspectRatio, string> = {
  '1:1': '1:1',
  '4:5': '3:4',
  '16:9': '16:9',
};

function normalizeRequestedAspectRatio(value: string): RequestedVisualAspectRatio {
  if (value === '4:5' || value === '16:9') {
    return value;
  }

  return '1:1';
}

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').trim();
}

function parseDataUrlMimeType(dataUrl: string) {
  const match = normalizeWhitespace(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  return match?.[1]?.toLowerCase() || '';
}

export function getGeminiImageConfigAspectRatio(aspectRatio: string) {
  return GEMINI_IMAGE_CONFIG_ASPECT_RATIO[normalizeRequestedAspectRatio(aspectRatio)];
}

export function calculateCenteredAspectCrop(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: string
): AspectCropRegion {
  const safeWidth = Math.max(1, Math.round(sourceWidth));
  const safeHeight = Math.max(1, Math.round(sourceHeight));
  const targetRatio = TARGET_ASPECT_RATIO[normalizeRequestedAspectRatio(aspectRatio)];
  const currentRatio = safeWidth / safeHeight;

  if (Math.abs(currentRatio - targetRatio) < 0.0001) {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: safeWidth,
      sourceHeight: safeHeight,
      outputWidth: safeWidth,
      outputHeight: safeHeight,
    };
  }

  if (currentRatio > targetRatio) {
    const croppedWidth = Math.min(safeWidth, Math.max(1, Math.round(safeHeight * targetRatio)));
    const sourceX = Math.max(0, Math.floor((safeWidth - croppedWidth) / 2));

    return {
      sourceX,
      sourceY: 0,
      sourceWidth: croppedWidth,
      sourceHeight: safeHeight,
      outputWidth: croppedWidth,
      outputHeight: safeHeight,
    };
  }

  const croppedHeight = Math.min(safeHeight, Math.max(1, Math.round(safeWidth / targetRatio)));
  const sourceY = Math.max(0, Math.floor((safeHeight - croppedHeight) / 2));

  return {
    sourceX: 0,
    sourceY,
    sourceWidth: safeWidth,
    sourceHeight: croppedHeight,
    outputWidth: safeWidth,
    outputHeight: croppedHeight,
  };
}

export async function fitGeneratedVisualToAspectRatio(
  dataUrl: string | null | undefined,
  aspectRatio: string
) {
  const normalized = normalizeWhitespace(dataUrl);
  if (!normalized) {
    return '';
  }

  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
    || typeof Image === 'undefined'
  ) {
    return normalized;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Failed to load generated visual for aspect-ratio fit.'));
    nextImage.src = normalized;
  }).catch(() => null);

  if (!image) {
    return normalized;
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return normalized;
  }

  const crop = calculateCenteredAspectCrop(sourceWidth, sourceHeight, aspectRatio);
  if (
    crop.sourceX === 0
    && crop.sourceY === 0
    && crop.sourceWidth === sourceWidth
    && crop.sourceHeight === sourceHeight
  ) {
    return normalized;
  }

  const canvas = document.createElement('canvas');
  canvas.width = crop.outputWidth;
  canvas.height = crop.outputHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    return normalized;
  }

  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    crop.outputWidth,
    crop.outputHeight
  );

  const mimeType = parseDataUrlMimeType(normalized);
  const outputMimeType = mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
    ? mimeType
    : 'image/png';

  return canvas.toDataURL(outputMimeType, outputMimeType === 'image/jpeg' ? 0.95 : undefined);
}
