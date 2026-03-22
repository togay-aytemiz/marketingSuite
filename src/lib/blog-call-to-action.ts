import { cleanDraftMarkdownArtifacts } from './blog-draft-media';

export const DEFAULT_CTA_HEADING: Record<'TR' | 'EN', string> = {
  TR: '## Sonraki Adım',
  EN: '## Next Step',
};

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildCallToActionBody(language: 'TR' | 'EN', productName: string, featureName: string) {
  const normalizedProduct = normalizeWhitespace(productName || 'Qualy');
  const normalizedFeature = normalizeWhitespace(featureName || 'mesajlaşma ve satış otomasyonu');

  if (language === 'EN') {
    return `${normalizedProduct} can help you turn ${normalizedFeature} into a repeatable growth workflow. If you want to review your current setup and identify the fastest improvements, get in touch with our team.`;
  }

  return `${normalizedProduct}, ${normalizedFeature} sürecini daha ölçülebilir ve tekrar edilebilir hale getirmene yardımcı olabilir. Mevcut yapını birlikte değerlendirmek ve en hızlı iyileştirme alanlarını görmek istersen ekibimizle iletişime geçebilirsin.`;
}

export function hasFinalCallToAction(content: string | null | undefined, language: 'TR' | 'EN') {
  return cleanDraftMarkdownArtifacts(content).includes(DEFAULT_CTA_HEADING[language]);
}

export function ensureFinalCallToAction(
  content: string | null | undefined,
  language: 'TR' | 'EN',
  productName: string,
  featureName: string
) {
  const heading = DEFAULT_CTA_HEADING[language];
  const normalized = cleanDraftMarkdownArtifacts(content);
  const finalBlock = `${heading}\n\n${buildCallToActionBody(language, productName, featureName)}`.trim();

  if (!normalized) {
    return finalBlock;
  }

  if (normalized.endsWith(finalBlock)) {
    return normalized;
  }

  const lastHeadingIndex = normalized.lastIndexOf(heading);
  const baseContent =
    lastHeadingIndex >= 0 && lastHeadingIndex >= normalized.length - 800
      ? normalized.slice(0, lastHeadingIndex).trim()
      : normalized;

  if (!baseContent) {
    return finalBlock;
  }

  return `${baseContent}\n\n${finalBlock}`.trim();
}
