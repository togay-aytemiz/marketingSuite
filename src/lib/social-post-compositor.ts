import type { SocialPostTheme } from './social-post-prompt';

export interface SocialPostCopyOverlayOptions {
  headline: string;
  subheadline?: string;
  theme: SocialPostTheme;
  brandName?: string;
}

function normalizeText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number
) {
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

export async function composeSocialPostVisualWithCopy(
  dataUrl: string | null | undefined,
  options: SocialPostCopyOverlayOptions
) {
  const normalized = normalizeText(dataUrl);
  if (!normalized) {
    return '';
  }

  const headline = normalizeText(options.headline);
  if (!headline) {
    return normalized;
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
    nextImage.onerror = () => reject(new Error('Failed to load generated social post for copy overlay.'));
    nextImage.src = normalized;
  }).catch(() => null);

  if (!image) {
    return normalized;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    return normalized;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return normalized;
  }

  context.drawImage(image, 0, 0, width, height);

  const isDark = options.theme === 'dark';
  const topGradient = context.createLinearGradient(0, 0, 0, height * 0.55);
  if (isDark) {
    topGradient.addColorStop(0, 'rgba(3, 3, 7, 0.86)');
    topGradient.addColorStop(0.62, 'rgba(3, 3, 7, 0.38)');
    topGradient.addColorStop(1, 'rgba(3, 3, 7, 0)');
  } else {
    topGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    topGradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.52)');
    topGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  }

  context.fillStyle = topGradient;
  context.fillRect(0, 0, width, height * 0.55);

  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillStyle = isDark ? '#F7F7F7' : '#111318';
  context.shadowColor = isDark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(255, 255, 255, 0.9)';
  context.shadowBlur = Math.round(height * 0.012);
  context.shadowOffsetY = Math.round(height * 0.004);

  const brandName = normalizeText(options.brandName || 'Qualy');
  if (brandName) {
    const brandFontSize = Math.max(16, Math.round(height * 0.022));
    context.font = `600 ${brandFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.globalAlpha = 0.82;
    context.fillText(brandName, width / 2, height * 0.055);
    context.globalAlpha = 1;
  }

  const headlineFontSize = Math.max(34, Math.min(76, Math.round(height * 0.07)));
  const headlineLineHeight = Math.round(headlineFontSize * 1.05);
  context.font = `700 ${headlineFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  const maxTextWidth = width * 0.84;
  const headlineLines = wrapText(context, headline, maxTextWidth, 4);
  const headlineY = height * 0.12;
  drawTextLines(context, headlineLines, width / 2, headlineY, headlineLineHeight);

  const subheadline = normalizeText(options.subheadline);
  if (subheadline) {
    const subheadlineFontSize = Math.max(18, Math.min(34, Math.round(height * 0.028)));
    const subheadlineLineHeight = Math.round(subheadlineFontSize * 1.25);
    const subheadlineY = headlineY + headlineLines.length * headlineLineHeight + height * 0.026;
    context.font = `500 ${subheadlineFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillStyle = isDark ? 'rgba(247, 247, 247, 0.82)' : 'rgba(17, 19, 24, 0.72)';
    const subheadlineLines = wrapText(context, subheadline, maxTextWidth * 0.84, 2);
    drawTextLines(context, subheadlineLines, width / 2, subheadlineY, subheadlineLineHeight);
  }

  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  return canvas.toDataURL('image/png');
}
