import { getOpenAiApiKey } from './env';
import { getStrategyContextSnapshot } from './strategy-context';
import { getVisualRealityContextSnapshot } from './visual-reality-context';
import { selectRelevantSanityPosts } from './gemini';
import {
  buildInternalBlogUrl,
  getLanguageName,
  getPrimaryLanguage,
  getSingleOutputLanguageName,
  isDualLanguage,
  normalizeAppLanguage,
} from '../lib/app-language';
import {
  buildInlineImagePlacementSummaries,
  sanitizeEditorialPromptText,
  stripOuterMarkdownFence,
} from '../lib/blog-draft-media';
import {
  extractValidatedUsedInternalBlogLinks,
  sanitizeInternalBlogLinks,
} from '../lib/editorial-context';
import {
  ensureFinalCallToAction,
  hasFinalCallToAction,
} from '../lib/blog-call-to-action';
import {
  extractMarkdownLinkCount,
} from '../lib/blog-publish-readiness';
import {
  countWords,
  resolveBlogLengthRequirements,
} from '../lib/blog-length';
import {
  resolveDraftCategory,
  type DraftCategoryOption,
  type DraftRecentCategoryReference,
} from '../lib/blog-category-resolution';
import { buildPrompt as buildVisualPromptBrief } from '../lib/visual-prompt';
import {
  finalizeCoverImagePromptText,
  finalizeInlineImagePromptText,
  getCoverImageHouseStyleBullets,
  getInlineImageHouseStyleBullets,
} from '../lib/editorial-cover-style';
import { VISUAL_HOUSE_STYLE } from '../lib/visual-house-style';
import {
  buildBlogImageSlotMarker,
  extractBlogImageSlotIds,
  normalizeBlogImageSlotId,
  type BlogInlineImagePlan,
} from '../lib/blog-image-slots';
export { buildBlogImageSlotMarker, extractBlogImageSlotIds } from '../lib/blog-image-slots';
export { ensureFinalCallToAction } from '../lib/blog-call-to-action';
export { buildInternalBlogUrl } from '../lib/app-language';

export interface SanityPostReference {
  title: string;
  slug: string;
  excerpt?: string;
  category?: string;
  language?: string;
  publishedAt?: string;
}

export interface RecentTopicReference {
  title: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  categoryId?: string;
  language?: string;
  publishedAt?: string;
}

export interface BlogPostResponse {
  title: string;
  description: string;
  slug: string;
  coverImagePrompt: string;
  coverAltText: string;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    resolvedBy?: 'exact-id' | 'exact-name' | 'slug-match' | 'fallback-balance';
    confidence?: 'high' | 'medium' | 'low';
    fallbackReason?: string | null;
  } | null;
  content: string;
  inlineImages: BlogInlineImagePlan[];
  titleEN?: string;
  descriptionEN?: string;
  slugEN?: string;
  coverImagePromptEN?: string;
  coverAltTextEN?: string;
  contentEN?: string;
}

export interface TopicIdeaSuggestion {
  topic: string;
  keywords: string;
  categoryId: string | null;
  keywordStrategy?: BlogKeywordStrategy | null;
  reason?: string;
  categoryGap?: string;
  excludedRecentTitles?: string[];
}

export interface BlogKeywordStrategy {
  primaryKeyword: string;
  secondaryKeywords: string[];
  supportKeywords: string[];
  longTailKeywords: string[];
  semanticKeywords: string[];
}

export interface RegeneratedBlogTitlesResult {
  title?: string;
  slug?: string;
  titleEN?: string;
  slugEN?: string;
}

export interface VisualPromptPlanInput {
  productName: string;
  featureName: string;
  description: string;
  headline: string;
  subheadline: string;
  cta: string;
  includeCta?: boolean;
  brandColor: string;
  platform: string;
  campaignType: string;
  aspectRatio: string;
  tone: string;
  designStyle: string;
  theme: 'light' | 'dark' | 'mixed';
  mode: string;
  language: string;
  customInstruction: string;
  campaignFocus: string;
  variationIndex?: number;
  hasScreenshots?: boolean;
  hasReferenceImage?: boolean;
  isMagicEdit?: boolean;
  userComment?: string;
}

export interface VisualPromptPlanResult {
  prompt: string;
  styleName: string;
}

interface SeoImageAccessibilityInput {
  coverAltText?: string;
  inlineImages?: Array<Pick<BlogInlineImagePlan, 'slotId' | 'altText'>>;
}

interface OpenAiChatConfig {
  prompt: string;
  system?: string;
  temperature?: number;
  schemaName?: string;
  schema?: Record<string, unknown>;
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const MAX_SEO_TITLE_LENGTH = 70;
const ORPHAN_BRACKET_LINE_REGEX = /^[\[\]\(\)\{\}]+$/;
const OFFICIAL_QUALY_SITE_URL = 'https://www.askqualy.com';
const QUALY_SITE_GUARDRAILS = `
OFFICIAL QUALY WEBSITE RULES:
- The official Qualy website is ${OFFICIAL_QUALY_SITE_URL}.
- Never invent, guess, or substitute another Qualy domain (for example: qualy.ai).
- When the article references the product website or homepage, use ${OFFICIAL_QUALY_SITE_URL}.
- For internal blog links, keep site-relative links like /blog/slug or /en/blog/slug unless the user explicitly asks for absolute URLs.
`;

const TURKISH_MARKETING_TERM_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bour product\b/gi, replacement: 'ürün' },
  { pattern: /\blead scoring\b/gi, replacement: 'müşteri adayı puanlama' },
  { pattern: /\blead\b/gi, replacement: 'müşteri adayı' },
  { pattern: /\bconversion rate\b/gi, replacement: 'dönüşüm oranı' },
  { pattern: /\bconversion\b/gi, replacement: 'dönüşüm' },
  { pattern: /\bengagement\b/gi, replacement: 'etkileşim' },
  { pattern: /\bsales funnel\b/gi, replacement: 'satış hunisi' },
  { pattern: /\bfunnel\b/gi, replacement: 'huni' },
  { pattern: /\bworkflow\b/gi, replacement: 'iş akışı' },
  { pattern: /\bAI\b/g, replacement: 'yapay zeka' },
];
const TURKISH_ASCII_TEXT_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bhazir yanitlar\b/gi, replacement: 'hazır yanıtlar' },
  { pattern: /\bhazir yanit\b/gi, replacement: 'hazır yanıt' },
  { pattern: /\bnasil kullanilir\b/gi, replacement: 'nasıl kullanılır' },
  { pattern: /\bnasil yapilir\b/gi, replacement: 'nasıl yapılır' },
  { pattern: /\badim adim\b/gi, replacement: 'adım adım' },
  { pattern: /\bkullanim senaryosu\b/gi, replacement: 'kullanım senaryosu' },
  { pattern: /\burun notu\b/gi, replacement: 'ürün notu' },
  { pattern: /\bhazirlanir\b/gi, replacement: 'hazırlanır' },
  { pattern: /\bkullanilir\b/gi, replacement: 'kullanılır' },
  { pattern: /\byapilir\b/gi, replacement: 'yapılır' },
  { pattern: /\bnasil\b/gi, replacement: 'nasıl' },
  { pattern: /\bhazir\b/gi, replacement: 'hazır' },
  { pattern: /\byanitlar\b/gi, replacement: 'yanıtlar' },
  { pattern: /\byanit\b/gi, replacement: 'yanıt' },
  { pattern: /\bicin\b/gi, replacement: 'için' },
  { pattern: /\bgorseller\b/gi, replacement: 'görseller' },
  { pattern: /\bgorseli\b/gi, replacement: 'görseli' },
  { pattern: /\bgorsel\b/gi, replacement: 'görsel' },
  { pattern: /\bsecimi\b/gi, replacement: 'seçimi' },
  { pattern: /\bsecim\b/gi, replacement: 'seçim' },
  { pattern: /\burunler\b/gi, replacement: 'ürünler' },
  { pattern: /\burun\b/gi, replacement: 'ürün' },
  { pattern: /\bkullanim\b/gi, replacement: 'kullanım' },
  { pattern: /\bolcum\b/gi, replacement: 'ölçüm' },
  { pattern: /\bcozum\b/gi, replacement: 'çözüm' },
  { pattern: /\bkarsilastirma\b/gi, replacement: 'karşılaştırma' },
  { pattern: /\bcagri\b/gi, replacement: 'çağrı' },
  { pattern: /\bmusteri\b/gi, replacement: 'müşteri' },
  { pattern: /\bdonusum\b/gi, replacement: 'dönüşüm' },
  { pattern: /\betkilesim\b/gi, replacement: 'etkileşim' },
  { pattern: /\bozellikleri\b/gi, replacement: 'özellikleri' },
  { pattern: /\bozelligi\b/gi, replacement: 'özelliği' },
  { pattern: /\bozellik\b/gi, replacement: 'özellik' },
  { pattern: /\byazilar\b/gi, replacement: 'yazılar' },
  { pattern: /\byazisi\b/gi, replacement: 'yazısı' },
  { pattern: /\byazi\b/gi, replacement: 'yazı' },
];
const GENERIC_SEO_KEYWORD_PHRASES = new Set([
  'announcement',
  'duyuru',
  'feature announcement',
  'feature news',
  'guncelleme',
  'guncelleme notu',
  'ozellik duyurusu',
  'product update',
  'release note',
  'release notes',
  'urun notu',
]);
const TURKISH_SLUG_CHAR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function preserveUrlTokens(value: string, transform: (input: string) => string) {
  const replacements = new Map<string, string>();
  let tokenIndex = 0;
  const nextToken = (originalValue: string) => {
    const token = `__URL_TOKEN_${tokenIndex}__`;
    tokenIndex += 1;
    replacements.set(token, originalValue);
    return token;
  };

  const protectedValue = String(value || '')
    .replace(/\]\(([^)\s]+)\)/g, (_match, url: string) => `](${nextToken(url)})`)
    .replace(/\bhttps?:\/\/[^\s)]+/g, (url) => nextToken(url));

  let restored = transform(protectedValue);

  for (const [token, originalValue] of replacements.entries()) {
    restored = restored.replaceAll(token, originalValue);
  }

  return restored;
}

function normalizeKeywordComparisonKey(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSeoKeywordList(
  value: string | null | undefined,
  shouldNormalizeTurkish: boolean,
  maxItems = 5
) {
  const rawItems = String(value || '')
    .split(/[,\n;|]/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const rawItem of rawItems) {
    const normalizedItem = shouldNormalizeTurkish
      ? normalizeTurkishMarketingText(rawItem)
      : cleanGeneratedMarkdownArtifacts(rawItem);
    const comparisonKey = normalizeKeywordComparisonKey(normalizedItem);

    if (!comparisonKey || GENERIC_SEO_KEYWORD_PHRASES.has(comparisonKey) || seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    deduped.push(normalizedItem);

    if (deduped.length >= maxItems) {
      break;
    }
  }

  return deduped;
}

function normalizeKeywordBucketItems(
  value: unknown,
  shouldNormalizeTurkish: boolean,
  maxItems: number
) {
  const rawItems = Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === 'string') {
          return [item];
        }

        if (item && typeof item === 'object' && typeof (item as { term?: unknown }).term === 'string') {
          return [(item as { term: string }).term];
        }

        return [];
      })
    : typeof value === 'string'
      ? value.split(/[,\n;|]/)
      : [];

  return normalizeSeoKeywordList(rawItems.join(', '), shouldNormalizeTurkish, maxItems);
}

function buildKeywordSummaryList(strategy: BlogKeywordStrategy, maxItems = 8) {
  const deduped: string[] = [];
  const seen = new Set<string>();

  const add = (items: string[]) => {
    for (const item of items) {
      const normalized = normalizeWhitespace(item);
      const key = normalizeKeywordComparisonKey(normalized);
      if (!normalized || !key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(normalized);

      if (deduped.length >= maxItems) {
        return;
      }
    }
  };

  add([strategy.primaryKeyword]);
  add(strategy.secondaryKeywords);
  add(strategy.supportKeywords);
  add(strategy.longTailKeywords);

  return deduped.slice(0, maxItems);
}

function normalizeKeywordStrategyCandidate(
  value: unknown,
  fallbackKeywords: string | null | undefined,
  shouldNormalizeTurkish: boolean
): BlogKeywordStrategy | null {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const primaryKeyword = normalizeKeywordBucketItems(source?.primaryKeyword, shouldNormalizeTurkish, 1)[0]
    || normalizeKeywordBucketItems(fallbackKeywords, shouldNormalizeTurkish, 5)[0]
    || '';

  if (!primaryKeyword) {
    return null;
  }

  const fallbackKeywordItems = normalizeSeoKeywordList(fallbackKeywords, shouldNormalizeTurkish, 8);
  const secondaryKeywords = normalizeKeywordBucketItems(
    source?.secondaryKeywords,
    shouldNormalizeTurkish,
    6
  );
  const supportKeywords = normalizeKeywordBucketItems(
    source?.supportKeywords,
    shouldNormalizeTurkish,
    10
  );
  const longTailKeywords = normalizeKeywordBucketItems(
    source?.longTailKeywords,
    shouldNormalizeTurkish,
    8
  );
  const semanticKeywords = normalizeKeywordBucketItems(
    source?.semanticKeywords,
    shouldNormalizeTurkish,
    15
  );

  if (secondaryKeywords.length === 0 && fallbackKeywordItems.length > 1) {
    secondaryKeywords.push(...fallbackKeywordItems.slice(1, 5));
  }

  return {
    primaryKeyword,
    secondaryKeywords,
    supportKeywords,
    longTailKeywords,
    semanticKeywords,
  };
}

function buildKeywordStrategyInstruction(language: 'TR' | 'EN') {
  const genericExamples = language === 'TR'
    ? '"ürün notu", "güncelleme", "özellik duyurusu"'
    : '"product update", "announcement", "feature news"';

  return `
KEYWORD STRATEGY:
- Work like a B2B SaaS marketing manager optimizing for qualified organic traffic, not vanity traffic.
- Build one clear primary keyword, 3-6 secondary keywords, 5-10 support keywords, 4-8 long-tail keywords, and 8-15 semantic keywords.
- Prefer high-intent, product-adjacent long-tail phrases tied to real pain points, workflows, use cases, integrations, comparisons, checklists, troubleshooting, and templates.
- Keep every keyword tightly aligned with shipped capabilities, target audience pain points, and the article angle.
- Avoid generic announcement or vanity phrases such as ${genericExamples} unless the user explicitly asked for release notes.
- If keyword hints are weak, broad, or off-topic, refine them into stronger SEO phrases instead of copying them literally.
  `.trim();
}

function buildStructuredKeywordStrategyPromptBlock(
  strategy: BlogKeywordStrategy | null | undefined,
  language: 'TR' | 'EN'
) {
  if (!strategy) {
    return `
STRUCTURED KEYWORD STRATEGY:
- No structured keyword strategy was provided.
- Infer the hierarchy yourself and stay consistent: 1 primary, 3-6 secondary, 5-10 support, 4-8 long-tail, and 8-15 semantic keywords.
`.trim();
  }

  const none = language === 'TR' ? 'yok' : 'none';

  return `
STRUCTURED KEYWORD STRATEGY:
- Treat this hierarchy as fixed source-of-truth for the article.
- Primary keyword: ${strategy.primaryKeyword}
- Secondary keywords: ${strategy.secondaryKeywords.join(', ') || none}
- Support keywords: ${strategy.supportKeywords.join(', ') || none}
- Long-tail keywords: ${strategy.longTailKeywords.join(', ') || none}
- Semantic keywords: ${strategy.semanticKeywords.join(', ') || none}

KEYWORD USAGE RULES:
- Primary keyword must appear naturally in the SEO title, intro, at least one H2, and the meta description.
- Secondary keywords should be distributed across H2 sections and body copy.
- Support keywords should deepen explanations, examples, workflows, objections, and operational detail.
- Long-tail keywords should be used in H2/H3 and FAQ-style sections when relevant.
- Semantic keywords should improve topical coverage naturally and must never be stuffed.
`.trim();
}

function buildBlogWritingQualityInstruction(mode: 'draft' | 'expand' | 'revise' | 'translate') {
  const articleReference = mode === 'revise'
    ? 'revised article'
    : mode === 'translate'
      ? 'adapted article'
      : 'article';

  return `
WRITING QUALITY:
- Use target keywords naturally across the ${articleReference}. Do not force exact-match repetition into every paragraph.
- If a keyword starts sounding forced, vary the phrasing while preserving the same search intent.
- Avoid repetitive wording, repeated sentence openings, and obvious phrase recycling.
- Keep transitions and sentence rhythms varied so the draft reads like an editor-reviewed publication.
`.trim();
}

function buildSeoImageAccessibilitySummary(imageAccessibility?: SeoImageAccessibilityInput) {
  if (!imageAccessibility) {
    return {
      promptBlock: 'IMAGE ALT TEXT COVERAGE:\n- Image alt text data: not provided',
      missingCount: 0,
    };
  }

  const lines = ['IMAGE ALT TEXT COVERAGE:'];
  let missingCount = 0;
  const coverAltText = normalizeWhitespace(String(imageAccessibility.coverAltText || ''));

  if (coverAltText) {
    lines.push(`- Cover image alt text: ${coverAltText}`);
  } else {
    lines.push('- Cover image alt text: missing');
    missingCount += 1;
  }

  const inlineImages = Array.isArray(imageAccessibility.inlineImages) ? imageAccessibility.inlineImages : [];
  let inlineWithAltCount = 0;

  if (inlineImages.length === 0) {
    lines.push('- Inline images: none');
  } else {
    for (let index = 0; index < inlineImages.length; index += 1) {
      const image = inlineImages[index];
      const slotId = normalizeBlogImageSlotId(image?.slotId) || `image-${index + 1}`;
      const altText = normalizeWhitespace(String(image?.altText || ''));

      if (altText) {
        inlineWithAltCount += 1;
        lines.push(`- ${slotId}: ${altText}`);
      } else {
        missingCount += 1;
        lines.push(`- ${slotId}: missing`);
      }
    }

    lines.push(`- Inline image alt text coverage: ${inlineWithAltCount}/${inlineImages.length}`);
  }

  return {
    promptBlock: lines.join('\n'),
    missingCount,
  };
}

function isAllUppercaseTurkish(value: string) {
  return value === value.toLocaleUpperCase('tr-TR');
}

function isAllLowercaseTurkish(value: string) {
  return value === value.toLocaleLowerCase('tr-TR');
}

function isTitleCaseTurkish(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => {
      const letters = token.replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+|[^A-Za-zÇĞİÖŞÜçğıöşü]+$/gu, '');
      if (!letters) {
        return true;
      }

      const lower = letters.toLocaleLowerCase('tr-TR');
      return letters.charAt(0) === letters.charAt(0).toLocaleUpperCase('tr-TR')
        && letters.slice(1) === lower.slice(1);
    });
}

function toTitleCaseTurkish(value: string) {
  return value.replace(/[A-Za-zÇĞİÖŞÜçğıöşü]+/gu, (word) => {
    const lower = word.toLocaleLowerCase('tr-TR');
    return `${lower.charAt(0).toLocaleUpperCase('tr-TR')}${lower.slice(1)}`;
  });
}

function toSentenceCaseTurkish(value: string) {
  const lower = value.toLocaleLowerCase('tr-TR');
  return lower.replace(/[A-Za-zÇĞİÖŞÜçğıöşü]/u, (char) => char.toLocaleUpperCase('tr-TR'));
}

function applyTurkishCasePattern(source: string, replacement: string) {
  if (isAllUppercaseTurkish(source)) {
    return replacement.toLocaleUpperCase('tr-TR');
  }

  if (isAllLowercaseTurkish(source)) {
    return replacement.toLocaleLowerCase('tr-TR');
  }

  if (source === toSentenceCaseTurkish(source)) {
    return toSentenceCaseTurkish(replacement);
  }

  if (isTitleCaseTurkish(source)) {
    return toTitleCaseTurkish(replacement);
  }

  return replacement;
}

export function cleanGeneratedMarkdownArtifacts(value: string) {
  const lines = stripOuterMarkdownFence(value).replace(/\r\n/g, '\n').split('\n');
  const cleanedLines = lines.filter((line) => !ORPHAN_BRACKET_LINE_REGEX.test(line.trim()));
  const sliced = cleanedLines.join('\n');

  return sliced
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function truncateForPrompt(value: string, maxLength = 180) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildArticleOutlineSnapshot(markdown: string, maxHeadings = 8) {
  const headings = Array.from(
    cleanGeneratedMarkdownArtifacts(markdown)
      .matchAll(/^(##|###)\s+(.+)$/gm)
  )
    .slice(0, maxHeadings)
    .map((match) => `- ${match[1] === '##' ? 'H2' : 'H3'}: ${truncateForPrompt(match[2], 120)}`);

  return headings.length > 0 ? headings.join('\n') : '- No headings extracted';
}

export function buildImagePlanContextSnapshot(content: string, contentEN?: string) {
  const primaryContent = cleanGeneratedMarkdownArtifacts(content);
  const englishContent = cleanGeneratedMarkdownArtifacts(contentEN || '');
  const primaryPlacements = buildInlineImagePlacementSummaries(primaryContent);
  const englishPlacements = englishContent ? buildInlineImagePlacementSummaries(englishContent) : [];

  const sections = [
    `ARTICLE OUTLINE:\n${buildArticleOutlineSnapshot(primaryContent)}`,
  ];

  if (primaryPlacements.length > 0) {
    sections.push(
      `INLINE IMAGE SLOTS:\n${primaryPlacements
        .map(
          (placement) =>
            `- ${placement.slotId} | section: ${truncateForPrompt(placement.heading, 80)} | context: ${truncateForPrompt(placement.context, 180)}`
        )
        .join('\n')}`
    );
  }

  if (englishContent) {
    sections.push(`ENGLISH OUTLINE:\n${buildArticleOutlineSnapshot(englishContent, 6)}`);
  }

  if (englishPlacements.length > 0) {
    sections.push(
      `ENGLISH INLINE SLOTS:\n${englishPlacements
        .map(
          (placement) =>
            `- ${placement.slotId} | section: ${truncateForPrompt(placement.heading, 80)} | context: ${truncateForPrompt(placement.context, 180)}`
        )
        .join('\n')}`
    );
  }

  return sections.join('\n\n');
}

export function enforceTurkishMarketingTerminology(value: string) {
  return preserveUrlTokens(value, (input) => {
    let normalized = input;

    for (const item of TURKISH_MARKETING_TERM_REPLACEMENTS) {
      normalized = normalized.replace(item.pattern, item.replacement);
    }

    return normalized;
  });
}

export function normalizeTurkishTextQuality(value: string) {
  return preserveUrlTokens(value, (input) => {
    let normalized = input;

    for (const item of TURKISH_ASCII_TEXT_REPLACEMENTS) {
      normalized = normalized.replace(
        item.pattern,
        (match) => applyTurkishCasePattern(match, item.replacement)
      );
    }

    return normalized;
  });
}

function normalizeTurkishMarketingText(value: string) {
  return cleanGeneratedMarkdownArtifacts(
    normalizeTurkishTextQuality(enforceTurkishMarketingTerminology(value))
  );
}

const INLINE_IMAGE_AUXILIARY_HEADING_REGEX = /^(s[ıi]k sorulan sorular|frequently asked questions|faq|sonraki ad[ıi]m|next step)\b/i;

function resolveTargetInlineImageCount(lengthKey: 'short' | 'medium' | 'long') {
  return lengthKey === 'long' ? 2 : 1;
}

function selectDistributedIndices(total: number, desiredCount: number) {
  const selected: number[] = [];
  const used = new Set<number>();

  for (let offset = 0; offset < desiredCount; offset += 1) {
    let candidate = Math.floor(((offset + 1) * (total + 1)) / (desiredCount + 1)) - 1;
    candidate = Math.max(0, Math.min(total - 1, candidate));

    while (used.has(candidate) && candidate < total - 1) {
      candidate += 1;
    }
    while (used.has(candidate) && candidate > 0) {
      candidate -= 1;
    }

    if (!used.has(candidate)) {
      used.add(candidate);
      selected.push(candidate);
    }
  }

  return selected.sort((left, right) => left - right);
}

function getNextInlineImageSlotId(slotIds: Set<string>) {
  let counter = 1;
  while (slotIds.has(`image-${counter}`)) {
    counter += 1;
  }

  const slotId = `image-${counter}`;
  slotIds.add(slotId);
  return slotId;
}

function normalizeInlineAltSubject(value: string | null | undefined, fallback: string) {
  const normalized = normalizeWhitespace(
    cleanGeneratedMarkdownArtifacts(String(value || ''))
      .replace(/^##+\s+/, '')
      .replace(/[.!?:;,]+$/g, '')
  );

  return normalized || normalizeWhitespace(cleanGeneratedMarkdownArtifacts(fallback));
}

function buildInlineAltTextForSlot(
  slotId: string,
  title: string,
  content: string,
  contentEN: string | undefined,
  language: 'TR' | 'EN'
) {
  const placements = [
    ...buildInlineImagePlacementSummaries(content),
    ...buildInlineImagePlacementSummaries(contentEN || ''),
  ];
  const placement = placements.find((item) => normalizeBlogImageSlotId(item.slotId) === slotId);
  const subject = normalizeInlineAltSubject(placement?.heading, title || 'Blog image');

  if (language === 'TR') {
    return normalizeTurkishMarketingText(`${subject} için blog görseli`);
  }

  return cleanGeneratedMarkdownArtifacts(`${subject} blog image`);
}

function ensureInlineImageSlotCoverageForLength(
  content: string,
  desiredCount: number
) {
  const cleaned = cleanGeneratedMarkdownArtifacts(content);
  if (!cleaned || desiredCount <= 0) {
    return cleaned;
  }

  const existingSlotIds = new Set(extractBlogImageSlotIds(cleaned));
  if (existingSlotIds.size >= desiredCount) {
    return cleaned;
  }

  const blocks = cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length === 0) {
    return cleaned;
  }

  const headingInsertions = blocks
    .map((block, index) => {
      const normalized = block.trim();
      if (!/^##\s+/.test(normalized)) {
        return null;
      }

      const heading = normalizeInlineAltSubject(normalized, '');
      if (!heading || INLINE_IMAGE_AUXILIARY_HEADING_REGEX.test(heading)) {
        return null;
      }

      let insertionIndex = index + 1;
      while (insertionIndex < blocks.length) {
        const candidate = blocks[insertionIndex]?.trim() || '';
        if (!candidate || candidate.startsWith('<!-- BLOG_IMAGE:')) {
          insertionIndex += 1;
          continue;
        }
        if (/^##+#\s+/.test(candidate)) {
          break;
        }
        insertionIndex += 1;
        break;
      }

      return Math.min(insertionIndex, blocks.length);
    })
    .filter((value): value is number => typeof value === 'number');

  const paragraphInsertions = blocks
    .map((block, index) => {
      const normalized = block.trim();
      if (!normalized || normalized.startsWith('<!-- BLOG_IMAGE:') || /^##+#\s+/.test(normalized)) {
        return null;
      }

      return index + 1;
    })
    .filter((value): value is number => typeof value === 'number');

  const missingCount = desiredCount - existingSlotIds.size;
  const insertionPoints: number[] = [];
  const usedInsertionPoints = new Set<number>();

  const addInsertionPoints = (points: number[], count: number) => {
    if (count <= 0 || points.length === 0) {
      return;
    }

    const selected = selectDistributedIndices(points.length, Math.min(count, points.length));
    for (const selectedIndex of selected) {
      const insertionPoint = points[selectedIndex];
      if (typeof insertionPoint === 'number' && !usedInsertionPoints.has(insertionPoint)) {
        usedInsertionPoints.add(insertionPoint);
        insertionPoints.push(insertionPoint);
      }
    }
  };

  addInsertionPoints(headingInsertions, missingCount);

  if (insertionPoints.length < missingCount) {
    addInsertionPoints(
      paragraphInsertions.filter((insertionPoint) => !usedInsertionPoints.has(insertionPoint)),
      missingCount - insertionPoints.length
    );
  }

  if (insertionPoints.length === 0) {
    insertionPoints.push(blocks.length);
  }

  const nextBlocks = [...blocks];
  for (const insertionPoint of insertionPoints.sort((left, right) => right - left)) {
    nextBlocks.splice(insertionPoint, 0, buildBlogImageSlotMarker(getNextInlineImageSlotId(existingSlotIds)));
  }

  return nextBlocks.join('\n\n').trim();
}

function injectFallbackInternalLink(
  content: string,
  post: SanityPostReference,
  language: 'TR' | 'EN'
) {
  const href = buildInternalBlogUrl(post.slug, language);
  const label = language === 'TR'
    ? normalizeTurkishMarketingText(post.title)
    : cleanGeneratedMarkdownArtifacts(post.title);
  const sentence = language === 'TR'
    ? `Bu konuda daha derin bir cerceve icin [${label}](${href}) yazisina da bakabilirsin.`
    : `For a deeper walkthrough, see [${label}](${href}).`;
  const sections = cleanGeneratedMarkdownArtifacts(content).split(/\n{2,}/);
  const insertionIndex = sections.findIndex((section) => {
    const normalizedSection = section.trim();
    return Boolean(normalizedSection)
      && !normalizedSection.startsWith('#')
      && !normalizedSection.startsWith('<!-- BLOG_IMAGE:');
  });

  if (insertionIndex === -1) {
    return `${cleanGeneratedMarkdownArtifacts(content)}\n\n${sentence}`.trim();
  }

  sections[insertionIndex] = `${sections[insertionIndex].trim()}\n\n${sentence}`.trim();
  return sections.join('\n\n').trim();
}

export function buildSearchIntentTitleGuidance(language: 'TR' | 'EN') {
  const genericTitleExample = language === 'TR' ? '"ürün notu"' : '"product update"';
  const localeRule = language === 'TR'
    ? '- Use natural Turkish characters in every Turkish field. Never write ASCII spellings such as hazir, nasil, urun, icin, gorsel.'
    : '- Keep the wording concrete, specific, and naturally aligned with real search queries.';

  return `
TITLE STRATEGY RULES:
- Prefer titles framed around search intent: problem + solution + use case.
- Avoid vague, generic announcement framing such as ${genericTitleExample} unless the user explicitly asked for release notes.
- Favor concrete query patterns people actually search for: how-to, checklist, comparison, troubleshooting, template, example, and use case angles.
${localeRule}
`.trim();
}

export function buildBlogImagePromptPolicy(imageStyle: string) {
  return `
IMAGE PROMPT POLICY:
- Prompts must be in English.
- Absolutely no visible text, no words, no letters, no numbers, no labels, no logos, no watermarks.
- No screenshots, no product UI mockups, no dashboard panels, no fake app interfaces.
- Prefer elegant editorial concepts: refined still life, abstract spatial metaphor, premium object study, architectural light-and-shadow, tactile material composition.
- Prefer a single focal subject and at most 2-3 supporting objects.
- HOUSE STYLE FOR ALL COVER IMAGES:
${getCoverImageHouseStyleBullets()}
- HOUSE STYLE FOR INLINE ARTICLE IMAGES:
${getInlineImageHouseStyleBullets()}
- Cover images must not use people, teams, meetings, office scenes, or literal workflow scenes.
- Inline images should default to realistic editorial photography. Use an explainer card only when the section is inherently diagrammatic.
- Avoid dense icon clouds, busy scenes, swirling overlays, neon chaos, literal social app logos, and crowded explainer visuals.
- Use negative space, restrained composition, quiet premium lighting, and a controlled palette.
- Avoid childish illustration, cartoon people, playful mascots, busy infographic layouts, sticker-like icons, meme aesthetics, noisy collage scenes, and literal explainer diagrams.
- If people are not necessary, do not include people.
- Aim for a premium editorial feel suitable for an enterprise software publication, not an ad banner or infographic.
- Requested visual direction from user: ${imageStyle}
`;
}

function normalizeInlineImages(
  images: BlogInlineImagePlan[] | undefined,
  content: string,
  contentEN?: string
) {
  const allowedSlotIds = new Set([
    ...extractBlogImageSlotIds(content),
    ...extractBlogImageSlotIds(contentEN || ''),
  ]);
  const bySlotId = new Map<string, BlogInlineImagePlan>();

  for (const image of images || []) {
    const slotId = normalizeBlogImageSlotId(image?.slotId);
    const prompt = sanitizeEditorialPromptText(cleanGeneratedMarkdownArtifacts(String(image?.prompt || '')));
    const altText = cleanGeneratedMarkdownArtifacts(String(image?.altText || ''));

    if (!slotId || !allowedSlotIds.has(slotId) || !prompt) {
      continue;
    }

    if (!bySlotId.has(slotId)) {
      bySlotId.set(slotId, {
        slotId,
        prompt,
        altText: altText || 'Blog image',
      });
    }
  }

  return Array.from(bySlotId.values());
}

function buildFallbackInlineImagePrompt(
  title: string,
  description: string,
  slotId: string,
  imageStyle: string
) {
  const subject = normalizeWhitespace(title || description || 'B2B SaaS article section');
  const visualDirection = normalizeWhitespace(imageStyle || 'minimal editorial business visual');

  return finalizeInlineImagePromptText(
    `Editorial photo: ${subject} ${visualDirection} ${slotId}`
  );
}

function ensureInlineImageCoverage(
  images: BlogInlineImagePlan[],
  content: string,
  contentEN: string | undefined,
  title: string,
  description: string,
  imageStyle: string,
  shouldNormalizeTurkish: boolean
) {
  const requiredSlotIds = [
    ...extractBlogImageSlotIds(content),
    ...extractBlogImageSlotIds(contentEN || ''),
  ];
  const uniqueSlotIds = Array.from(new Set(requiredSlotIds));
  const existingBySlotId = new Map<string, BlogInlineImagePlan>();

  for (const image of images) {
    const slotId = normalizeBlogImageSlotId(image.slotId);
    if (slotId && !existingBySlotId.has(slotId)) {
      existingBySlotId.set(slotId, {
        ...image,
        slotId,
      });
    }
  }

  return uniqueSlotIds.map((slotId) => {
    const existing = existingBySlotId.get(slotId);
    if (existing) {
      return {
        ...existing,
        altText: buildInlineAltTextForSlot(
          slotId,
          title,
          content,
          contentEN,
          shouldNormalizeTurkish ? 'TR' : 'EN'
        ),
      };
    }

    return {
      slotId,
      prompt: buildFallbackInlineImagePrompt(title, description, slotId, imageStyle),
      altText: buildInlineAltTextForSlot(
        slotId,
        title,
        content,
        contentEN,
        shouldNormalizeTurkish ? 'TR' : 'EN'
      ),
    };
  });
}

export function normalizeTopicIdeaCandidate(
  item: Partial<TopicIdeaSuggestion> | null | undefined,
  shouldNormalizeTurkish: boolean,
  sanityCategories: { id: string; name: string }[],
  recentPosts: RecentTopicReference[]
): TopicIdeaSuggestion | null {
  const topic = normalizeWhitespace(String(item?.topic || ''));
  const keywordStrategy = normalizeKeywordStrategyCandidate(
    item?.keywordStrategy,
    String(item?.keywords || ''),
    shouldNormalizeTurkish
  );
  const keywords = keywordStrategy
    ? buildKeywordSummaryList(keywordStrategy).join(', ')
    : normalizeSeoKeywordList(String(item?.keywords || ''), shouldNormalizeTurkish).join(', ');
  const categoryId = resolveCategoryId(item?.categoryId, sanityCategories, recentPosts);

  if (!topic || !keywords) {
    return null;
  }

  const normalizeText = (value: unknown) => {
    const normalized = cleanGeneratedMarkdownArtifacts(String(value || ''));
    return shouldNormalizeTurkish ? normalizeTurkishMarketingText(normalized) : normalized;
  };

  const reason = normalizeText(item?.reason);
  const categoryGap = normalizeText(item?.categoryGap);
  const excludedRecentTitles = Array.isArray(item?.excludedRecentTitles)
    ? item?.excludedRecentTitles
        .map((title) => normalizeWhitespace(String(title || '')))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return {
    topic: shouldNormalizeTurkish ? normalizeTurkishMarketingText(topic) : topic,
    keywords: shouldNormalizeTurkish ? normalizeTurkishMarketingText(keywords) : keywords,
    categoryId,
    keywordStrategy,
    reason: reason || undefined,
    categoryGap: categoryGap || undefined,
    excludedRecentTitles,
  };
}

function slugifyText(value: string) {
  return normalizeWhitespace(value)
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH_SLUG_CHAR_MAP[char] || char)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

function parseDateScore(value?: string) {
  if (!value) {
    return null;
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) {
    return null;
  }

  return dateMs;
}

function formatDateForPrompt(value?: string) {
  if (!value) {
    return 'unknown-date';
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 'unknown-date';
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildRecentPostsInstruction(
  recentPosts: RecentTopicReference[] = [],
  recentPostTitles: string[] = [],
  maxItems = 12
) {
  const normalizedPosts = recentPosts
    .map((post) => ({
      title: normalizeWhitespace(post.title || ''),
      category: normalizeWhitespace(post.category || ''),
      categoryId: normalizeWhitespace(post.categoryId || ''),
      publishedAt: post.publishedAt,
      scoreDate: parseDateScore(post.publishedAt) || 0,
    }))
    .filter((post) => post.title);

  const byTitle = new Map<string, (typeof normalizedPosts)[number]>();
  for (const post of normalizedPosts) {
    const key = post.title.toLowerCase();
    const existing = byTitle.get(key);
    if (!existing || post.scoreDate > existing.scoreDate) {
      byTitle.set(key, post);
    }
  }

  for (const title of recentPostTitles) {
    const normalizedTitle = normalizeWhitespace(title);
    if (!normalizedTitle) {
      continue;
    }

    const key = normalizedTitle.toLowerCase();
    if (!byTitle.has(key)) {
      byTitle.set(key, {
        title: normalizedTitle,
        category: '',
        categoryId: '',
        publishedAt: undefined,
        scoreDate: 0,
      });
    }
  }

  const rows = Array.from(byTitle.values())
    .sort((a, b) => b.scoreDate - a.scoreDate)
    .slice(0, maxItems)
    .map((post) => {
      const bits = [`[${formatDateForPrompt(post.publishedAt)}] ${post.title}`];
      if (post.category) {
        bits.push(`category: ${post.category}`);
      }
      if (post.categoryId) {
        bits.push(`categoryId: ${post.categoryId}`);
      }
      return `- ${bits.join(' | ')}`;
    });

  if (rows.length === 0) {
    return '';
  }

  return `
RECENT SANITY BLOG POSTS:
${rows.join('\n')}

IMPORTANT: Avoid near-duplicate angles with these existing posts.
`;
}

export function buildCategoryDistributionInstruction(
  recentPosts: RecentTopicReference[] = [],
  sanityCategories: { id: string; name: string }[] = []
) {
  const normalizedCategories = sanityCategories
    .map((category) => ({
      id: normalizeWhitespace(category.id || ''),
      name: normalizeWhitespace(category.name || ''),
    }))
    .filter((category) => category.id && category.name);

  if (normalizedCategories.length === 0) {
    return '';
  }

  const countsById = new Map<string, number>();
  const countsByName = new Map<string, number>();
  for (const post of recentPosts) {
    const idKey = normalizeWhitespace(post.categoryId || '').toLowerCase();
    if (idKey) {
      countsById.set(idKey, (countsById.get(idKey) || 0) + 1);
      continue;
    }

    const nameKey = normalizeWhitespace(post.category || '').toLowerCase();
    if (!nameKey) {
      continue;
    }
    countsByName.set(nameKey, (countsByName.get(nameKey) || 0) + 1);
  }

  const countValues = normalizedCategories.map(
    (category) => countsById.get(category.id.toLowerCase()) || countsByName.get(category.name.toLowerCase()) || 0
  );
  const maxCount = countValues.length > 0 ? Math.max(...countValues) : 0;
  const nowMs = Date.now();

  const rows = normalizedCategories
    .map((category) => {
      const count = countsById.get(category.id.toLowerCase()) || countsByName.get(category.name.toLowerCase()) || 0;
      const latestPostMs = recentPosts
        .filter((post) => {
          const postCategoryId = normalizeWhitespace(post.categoryId || '').toLowerCase();
          if (postCategoryId) {
            return postCategoryId === category.id.toLowerCase();
          }

          return normalizeWhitespace(post.category || '').toLowerCase() === category.name.toLowerCase();
        })
        .map((post) => parseDateScore(post.publishedAt) || 0)
        .reduce((max, value) => Math.max(max, value), 0);

      const recencyGapDays = latestPostMs > 0 ? Math.floor((nowMs - latestPostMs) / (1000 * 60 * 60 * 24)) : 999;
      const priorityScore = (maxCount - count) * 30 + recencyGapDays;

      return {
        ...category,
        count,
        recencyGapDays,
        priorityScore,
      };
    })
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      if (a.count !== b.count) {
        return a.count - b.count;
      }
      return a.name.localeCompare(b.name);
    })
    .map(
      (category) =>
        `- ID: ${category.id} | Name: ${category.name} | CurrentPostCount: ${category.count} | RecencyGapDays: ${category.recencyGapDays} | PriorityScore: ${category.priorityScore}`
    );

  return `
SANITY CATEGORY DISTRIBUTION SNAPSHOT:
${rows.join('\n')}

IMPORTANT:
- Use PriorityScore as a tie-breaker when topic fit is reasonable, not a mandate to force every idea into one category.
- PriorityScore blends coverage gap (low count) and recency gap (longer time since latest post).
- For blog generation, return a valid "categoryId" from this list.
`;
}

function resolveCategoryMatch(
  rawCategoryId: string | null | undefined,
  sanityCategories: { id: string; name: string }[],
  recentPosts: RecentTopicReference[]
) {
  const resolved = resolveDraftCategory({
    rawCategoryId,
    sanityCategories: sanityCategories as DraftCategoryOption[],
    recentPosts: recentPosts as DraftRecentCategoryReference[],
  });

  if (!resolved) {
    return null;
  }

  return {
    id: resolved.id,
    resolvedBy: resolved.resolvedBy,
    confidence: resolved.confidence,
    fallbackReason: resolved.fallbackReason,
  };
}

export function resolveCategoryId(
  rawCategoryId: string | null | undefined,
  sanityCategories: { id: string; name: string }[],
  recentPosts: RecentTopicReference[]
) {
  return resolveCategoryMatch(rawCategoryId, sanityCategories, recentPosts)?.id || null;
}

export function resolveCategoryMeta(
  rawCategoryId: string | null | undefined,
  sanityCategories: { id: string; name: string }[],
  recentPosts: RecentTopicReference[]
) {
  const resolved = resolveCategoryMatch(rawCategoryId, sanityCategories, recentPosts);
  if (!resolved?.id) {
    return null;
  }

  const category = sanityCategories.find((item) => normalizeWhitespace(item.id || '') === resolved.id);
  if (!category) {
    return null;
  }

  return {
    id: resolved.id,
    name: normalizeWhitespace(category.name || ''),
    resolvedBy: resolved.resolvedBy,
    confidence: resolved.confidence,
    fallbackReason: resolved.fallbackReason,
  };
}

function buildStrategyContextInstruction() {
  const context = getStrategyContextSnapshot();
  if (!context.available || !context.promptText) {
    return '';
  }

  return `
PRODUCT STRATEGY CONTEXT (from PRD/ROADMAP docs):
${context.promptText}

IMPORTANT: Align all reasoning, topic decisions, and final content with this strategy context and shipped capabilities.
`;
}

function buildVisualStrategyContextInstruction() {
  const context = getStrategyContextSnapshot();
  if (!context.available || !context.promptText) {
    return '';
  }

  return `
PRODUCT STRATEGY CONTEXT (from PRD/ROADMAP docs):
${context.promptText}

IMPORTANT: Align copy concepts, feature emphasis, and value framing with this strategy context and shipped capabilities. Do not imply features or workflows that are not yet shipped.
`;
}

function buildVisualRealityContextInstruction() {
  const context = getVisualRealityContextSnapshot();
  if (!context.available || !context.promptText) {
    return '';
  }

  return `
LOCAL CODEBASE REALITY CONTEXT (derived from nearby product code):
${context.promptText}

IMPORTANT: Treat this local product reality as higher priority than generic SaaS assumptions. Do not invent alternate score scales, channel coverage, or feature framing that conflicts with it.
`;
}

function normalizeVisualCopyContext(
  platformOrCampaignType: string,
  campaignTypeOrTone: string,
  toneOrLanguage: string,
  maybeLanguage?: string
) {
  if (typeof maybeLanguage === 'string') {
    return {
      platform: normalizeWhitespace(platformOrCampaignType) || 'General',
      campaignType: campaignTypeOrTone,
      tone: toneOrLanguage,
      language: maybeLanguage,
    };
  }

  return {
    platform: 'General',
    campaignType: platformOrCampaignType,
    tone: campaignTypeOrTone,
    language: toneOrLanguage,
  };
}

function buildPortfolioStageInstruction(totalPostCount: number) {
  if (totalPostCount <= 0) {
    return `
PORTFOLIO STAGE: BOOTSTRAP (0 posts)
- Prioritize foundational evergreen topics.
- Cover 4 different strategic categories before deep repetition.
- Avoid product changelog-heavy or narrow update topics.
`;
  }

  if (totalPostCount < 6) {
    return `
PORTFOLIO STAGE: EARLY (1-5 posts)
- Build pillar coverage and semantic breadth.
- Prioritize category balance and core search intent coverage.
- Prefer high-intent educational/use-case topics over minor announcements.
`;
  }

  if (totalPostCount < 12) {
    return `
PORTFOLIO STAGE: GROWTH (6-11 posts)
- Expand clusters around existing pillars with adjacent long-tail angles.
- Add stronger internal-link opportunities and comparison/problem-solution content.
`;
  }

  return `
PORTFOLIO STAGE: SCALE (12+ posts)
- Optimize with cluster depth, internal link graph quality, and intent diversification.
- Focus on gaps with highest strategic and SEO upside.
`;
}

async function runOpenAiChat(config: OpenAiChatConfig) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return null;
  }

  const body: Record<string, unknown> = {
    model: process.env.OPENAI_TEXT_MODEL || DEFAULT_OPENAI_MODEL,
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
    messages: [
      {
        role: 'system',
        content: config.system || 'You are an expert SaaS marketing assistant. Follow instructions exactly.',
      },
      {
        role: 'user',
        content: config.prompt,
      },
    ],
  };

  if (config.schema && config.schemaName) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: config.schemaName,
        strict: true,
        schema: config.schema,
      },
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      normalizeWhitespace(String(payload?.error?.message || payload?.message || '')) ||
      `${response.status} ${response.statusText}`;
    throw new Error(`OpenAI request failed: ${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part && typeof part === 'object' ? String((part as { text?: string }).text || '') : ''))
      .join('')
      .trim();
    return text || null;
  }

  return null;
}

function parseJsonSafely<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function runOpenAiJson<T>(config: OpenAiChatConfig): Promise<T | null> {
  const raw = await runOpenAiChat(config);
  return parseJsonSafely<T>(raw);
}

function buildInternalPostsList(posts: SanityPostReference[], language: 'TR' | 'EN') {
  return posts
    .filter((post) => {
      const normalizedLanguage = normalizeWhitespace(post.language).toLowerCase();
      return normalizeWhitespace(post.slug) && (!normalizedLanguage || normalizedLanguage === language.toLowerCase());
    })
    .map((post) => `- Title: "${post.title}", URL: "${buildInternalBlogUrl(post.slug, language)}"`)
    .join('\n');
}

async function ensureTitleWithinLimit(title: string, language: 'TR' | 'EN') {
  const normalized = normalizeWhitespace(title);
  if (!normalized) {
    return normalized;
  }

  if (normalized.length <= MAX_SEO_TITLE_LENGTH) {
    return normalized;
  }

  const rewritten = await runOpenAiChat({
    system: 'You are an expert SEO copywriter.',
    temperature: 0.2,
    prompt: `Rewrite this title in ${language === 'TR' ? 'Turkish' : 'English'}.

${buildSearchIntentTitleGuidance(language)}

Rules:
- Keep meaning.
- Keep SEO intent.
- Keep the title concrete and search-intent driven.
- Must be at most ${MAX_SEO_TITLE_LENGTH} characters.
- Return only the rewritten title, no quotes.

Title:
${normalized}`,
  });

  const candidate = normalizeWhitespace(rewritten || normalized);
  if (candidate.length <= MAX_SEO_TITLE_LENGTH) {
    return candidate;
  }

  return normalized;
}

async function regenerateSingleBlogTitle(input: {
  content: string,
  language: 'TR' | 'EN',
  currentTitle?: string,
  description?: string,
  keywords?: string
}) {
  const targetLanguage = input.language;
  const normalizedContent = cleanGeneratedMarkdownArtifacts(input.content || '');

  if (!normalizedContent) {
    return null;
  }

  const payload = await runOpenAiJson<{ title: string }>({
    schemaName: 'regenerate_blog_title',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
      },
      required: ['title'],
    },
    temperature: 0.4,
    prompt: `
You are a senior SEO editor.
Regenerate the article title based on the finished article below.

Language: ${getLanguageName(targetLanguage)}
Current Title: ${normalizeWhitespace(input.currentTitle || '') || 'Not provided'}
Description: ${normalizeWhitespace(input.description || '') || 'Not provided'}
Additional Keyword Hints: ${normalizeWhitespace(input.keywords || '') || 'Not provided'}
${buildSearchIntentTitleGuidance(targetLanguage)}

Rules:
- Generate one fresh reader-facing SEO title.
- The title must reflect the actual article content.
- Must be at most 70 characters.
- Prefer clear search-intent framing when it matches the article.
- Do not return quotes, bullets, or commentary.

Article Outline:
${buildArticleOutlineSnapshot(normalizedContent, 10)}

Blog Content:
${normalizedContent}
`,
  });

  const normalizedTitle = targetLanguage === 'TR'
    ? normalizeTurkishMarketingText(payload?.title || '')
    : cleanGeneratedMarkdownArtifacts(payload?.title || '');

  if (!normalizedTitle) {
    return null;
  }

  const title = await ensureTitleWithinLimit(normalizedTitle, targetLanguage);

  return {
    title,
    slug: slugifyText(title),
  };
}

export async function regenerateBlogTitles(input: {
  content?: string | null,
  contentEN?: string | null,
  currentTitle?: string,
  currentTitleEN?: string,
  description?: string,
  descriptionEN?: string,
  keywords?: string
}) {
  const regenerationTasks: Array<Promise<{ language: 'TR' | 'EN'; title: string; slug: string } | null>> = [];

  if (normalizeWhitespace(input.content || '')) {
    regenerationTasks.push(
      regenerateSingleBlogTitle({
        content: input.content || '',
        language: 'TR',
        currentTitle: input.currentTitle,
        description: input.description,
        keywords: input.keywords,
      }).then((result) => (result ? { language: 'TR', ...result } : null))
    );
  }

  if (normalizeWhitespace(input.contentEN || '')) {
    regenerationTasks.push(
      regenerateSingleBlogTitle({
        content: input.contentEN || '',
        language: 'EN',
        currentTitle: input.currentTitleEN,
        description: input.descriptionEN,
        keywords: input.keywords,
      }).then((result) => (result ? { language: 'EN', ...result } : null))
    );
  }

  if (regenerationTasks.length === 0) {
    return null;
  }

  const results = await Promise.all(regenerationTasks);
  const payload: RegeneratedBlogTitlesResult = {};

  for (const result of results) {
    if (!result) {
      continue;
    }

    if (result.language === 'TR') {
      payload.title = result.title;
      payload.slug = result.slug;
    } else {
      payload.titleEN = result.title;
      payload.slugEN = result.slug;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

async function translateBlogPostToEnglish(input: {
  productName: string;
  featureName: string;
  targetAudience: string;
  description: string;
  topic: string;
  keywords: string;
  tone: string;
  length: string;
  title: string;
  excerpt: string;
  content: string;
  coverAltText: string;
}) {
  return runOpenAiJson<{
    titleEN: string;
    descriptionEN: string;
    contentEN: string;
    coverAltTextEN: string;
  }>({
    schemaName: 'blog_post_translation_en',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        titleEN: { type: 'string' },
        descriptionEN: { type: 'string' },
        contentEN: { type: 'string' },
        coverAltTextEN: { type: 'string' },
      },
      required: ['titleEN', 'descriptionEN', 'contentEN', 'coverAltTextEN'],
    },
    temperature: 0.3,
    prompt: `
  You are a senior SEO translator and B2B SaaS editor.
  Translate/adapt this Turkish SaaS blog draft into English.

PRODUCT CONTEXT:
Product Name: ${input.productName || 'Our Product'}
Feature/Focus Area: ${input.featureName || 'General'}
Target Audience: ${input.targetAudience || 'General audience'}
Product Description: ${input.description || 'A modern software solution.'}
Topic/Instruction: ${input.topic || 'Not provided'}
Additional Keyword Hints: ${input.keywords || 'Not provided'}
Tone: ${input.tone}
Length: ${input.length}
${QUALY_SITE_GUARDRAILS}

SOURCE TURKISH FIELDS:
Title: ${input.title}
Description: ${input.excerpt}
Cover Alt Text: ${input.coverAltText}

  Content:
  ${input.content}

  ${buildBlogWritingQualityInstruction('translate')}

  Rules:
  - Return fluent English, not literal word-for-word translation.
  - Keep the SEO intent, structure, and meaning intact.
- titleEN must be <= ${MAX_SEO_TITLE_LENGTH} chars.
- descriptionEN must be <= 160 chars.
- Preserve markdown headings, bullets, FAQ structure, and spacing.
- Preserve every <!-- BLOG_IMAGE:image-x --> marker exactly as-is.
- Keep product names and proper nouns unchanged unless an English equivalent already exists.
- Keep site-relative links. If a Turkish internal blog link uses /blog/slug, rewrite it to /en/blog/slug.
- Do not add HTML, code fences, JSON-LD, script tags, or commentary.
`,
  });
}

async function expandBlogPostToMeetLength(input: {
  productName: string;
  featureName: string;
  targetAudience: string;
  description: string;
  topic: string;
  keywords: string;
  tone: string;
  language: 'TR' | 'EN';
  title: string;
  excerpt: string;
  content: string;
  minWords: number;
  maxWords: number;
  targetWords: number;
  recommendedH2Count: string;
}) {
  return runOpenAiJson<{ content: string }>({
    schemaName: 'blog_post_length_expansion',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
    },
    temperature: 0.4,
    prompt: `
  You are a senior SEO content editor.
  Expand this markdown article so it meets the requested depth and word count without losing coherence.

PRODUCT CONTEXT:
Product Name: ${input.productName || 'Our Product'}
Feature/Focus Area: ${input.featureName || 'General'}
Target Audience: ${input.targetAudience || 'General audience'}
Product Description: ${input.description || 'A modern software solution.'}
Topic/Instruction: ${input.topic || 'Not provided'}
Additional Keyword Hints: ${input.keywords || 'Not provided'}
Tone: ${input.tone}
Language: ${getLanguageName(input.language)}
${QUALY_SITE_GUARDRAILS}

ARTICLE METADATA:
Title: ${input.title}
Description: ${input.excerpt}
Current word count: ${countWords(input.content)}
Minimum word count: ${input.minWords}
Target range: ${input.minWords}-${input.maxWords} words
Ideal word count: around ${input.targetWords} words
Recommended H2 sections: ${input.recommendedH2Count}

  CURRENT MARKDOWN:
  ${input.content}

  ${buildBlogWritingQualityInstruction('expand')}

  Rules:
  - Keep the same title promise, topic angle, and overall narrative arc.
  - Preserve every existing H2/H3 heading when it still fits; deepen thin sections before adding new ones.
- Add concrete examples, decision criteria, mini checklists, and operational detail instead of filler.
- Keep paragraphs concise, but make each section more informative.
- Preserve every existing <!-- BLOG_IMAGE:image-x --> marker exactly as-is. Do not add or remove markers.
- Keep the FAQ section near the end and keep the final CTA section at the very end if it already exists.
- Return the full expanded markdown in the content field only.
`,
  });
}

export async function enhanceProductDetails(
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string
) {
  return runOpenAiChat({
    prompt: `
You are an expert SaaS marketing professional.
Rewrite and improve the product description to be clearer and benefit-focused.

Product Name: ${productName || 'Not provided'}
Feature Name: ${featureName || 'Not provided'}
Target Audience: ${targetAudience || 'Not provided'}

Current Description:
${description || 'Not provided'}

Rules:
- Return only the enhanced description text.
- No bullets, no meta commentary.
- Keep it concise and professional.
`,
    temperature: 0.5,
  });
}

export async function generateMarketingCopy(
  productName: string,
  featureName: string,
  description: string,
  platformOrCampaignType: string,
  campaignTypeOrTone: string,
  toneOrLanguage: string,
  maybeLanguage?: string,
  includeCta: boolean = true
) {
  const { platform, campaignType, tone, language } = normalizeVisualCopyContext(
    platformOrCampaignType,
    campaignTypeOrTone,
    toneOrLanguage,
    maybeLanguage
  );
  const outputLanguage = getSingleOutputLanguageName(language);
  const strategyContextInstruction = buildVisualStrategyContextInstruction();
  const realityContextInstruction = buildVisualRealityContextInstruction();
  return runOpenAiJson<{ headline: string; subheadline: string; cta: string }>({
    schemaName: 'marketing_copy',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        cta: { type: 'string' },
      },
      required: ['headline', 'subheadline', 'cta'],
    },
    prompt: `
Generate high-converting copy for a SaaS marketing visual.

Product Name: ${productName || 'Our Product'}
Feature Name: ${featureName || 'General'}
Description: ${description || 'A modern software solution'}
Platform: ${platform}
Campaign Type: ${campaignType}
Tone: ${tone}
Language: ${outputLanguage}
${strategyContextInstruction}
${realityContextInstruction}

Rules:
- headline: max 8 words
- subheadline: max 15 words
- CTA Enabled: ${includeCta ? 'yes' : 'no'}
- ${includeCta ? 'cta: max 4 words' : 'cta: return an empty string'}
- ${includeCta ? 'Keep the CTA crisp and action-oriented.' : 'CTA is disabled for this visual. Do not invent a CTA, button label, or action copy.'}
- avoid generic buzzwords
`,
  });
}

export async function generateCopyIdeas(
  productName: string,
  featureName: string,
  description: string,
  platformOrCampaignType: string,
  campaignTypeOrTone: string,
  toneOrLanguage: string,
  maybeLanguage?: string,
  ideaAngle?: string,
  includeCta: boolean = true
) {
  const { platform, campaignType, tone, language } = normalizeVisualCopyContext(
    platformOrCampaignType,
    campaignTypeOrTone,
    toneOrLanguage,
    maybeLanguage
  );
  const outputLanguage = getSingleOutputLanguageName(language);
  const strategyContextInstruction = buildVisualStrategyContextInstruction();
  const realityContextInstruction = buildVisualRealityContextInstruction();
  const normalizedIdeaAngle = normalizeWhitespace(ideaAngle || '');
  const ideaAngleInstruction = normalizedIdeaAngle
    ? `
USER COPY EMPHASIS:
${normalizedIdeaAngle}

- Use this emphasis to steer the headline, subheadline, and ${includeCta ? 'CTA' : 'overall visual copy'}.
- Treat it as a priority signal, but keep the copy aligned with the campaign type, strategy context, and real product capabilities.
`
    : '';
  return runOpenAiJson<{ headlines: string[]; subheadlines: string[]; ctas: string[] }>({
    schemaName: 'marketing_copy_ideas',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headlines: { type: 'array', items: { type: 'string' } },
        subheadlines: { type: 'array', items: { type: 'string' } },
        ctas: { type: 'array', items: { type: 'string' } },
      },
      required: ['headlines', 'subheadlines', 'ctas'],
    },
    prompt: `
Generate 3 different SaaS marketing copy ideas.

Product Name: ${productName || 'Software'}
Feature Name: ${featureName || 'New Feature'}
Description: ${description || 'Modern software application'}
Platform: ${platform}
Campaign Type: ${campaignType}
Tone: ${tone}
Language: ${outputLanguage}
${ideaAngleInstruction}
${strategyContextInstruction}
${realityContextInstruction}

Return 3 options for each field.
- CTA Enabled: ${includeCta ? 'yes' : 'no'}
- ${includeCta ? 'Return 3 CTA options as short action phrases.' : 'Return ctas as an empty array. CTA is disabled for this visual, so do not invent CTA copy.'}
`,
  });
}

export async function generateVisualPromptPlan(
  input: VisualPromptPlanInput
): Promise<VisualPromptPlanResult | null> {
  const strategyContext = getStrategyContextSnapshot();
  const strategyContextPromptText = strategyContext.available ? strategyContext.promptText : '';
  const realityContext = getVisualRealityContextSnapshot();
  const realityContextPromptText = realityContext.available ? realityContext.promptText : '';
  const brief = buildVisualPromptBrief(
    input.hasScreenshots ? ['screenshot'] : [],
    input.productName,
    input.featureName,
    input.description,
    input.headline,
    input.subheadline,
    input.cta,
    input.brandColor,
    input.platform,
    input.campaignType,
    input.aspectRatio,
    input.tone,
    input.designStyle,
    input.theme || 'mixed',
    input.mode,
    input.language,
    input.customInstruction,
    input.campaignFocus,
    input.variationIndex || 0,
    input.isMagicEdit ? 'previous-image' : undefined,
    input.userComment,
    input.hasReferenceImage ? 'reference-image' : null,
    strategyContextPromptText,
    realityContextPromptText,
    input.includeCta ?? true
  );

  return runOpenAiJson<VisualPromptPlanResult>({
    schemaName: 'visual_prompt_plan',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prompt: { type: 'string' },
        styleName: { type: 'string' },
      },
      required: ['prompt', 'styleName'],
    },
    prompt: `
You are a senior creative director generating one production-ready Gemini image prompt for a SaaS marketing visual.

The final image must stay inside the declared house style, communicate one idea immediately, and remain conversion-focused without becoming noisy.

VISUAL BRIEF:
${brief}

Rules:
- Return one production-ready Gemini render prompt in English.
- Preserve the mandatory text exactly as provided in the brief. Do not add extra labels, captions, badges, or body copy.
- Keep the visual inside the "${VISUAL_HOUSE_STYLE.name}" house style.
- Respect the platform, aspect ratio, campaign type, campaign focus, custom instructions, product strategy context, and local codebase reality context.
- If the campaign type is product promotion, do not drift into feature-announcement framing unless the brief explicitly requires it.
- If screenshots are present, tell Gemini to simplify and redraw rather than reproduce clutter.
- If this is a magic edit, keep the current composition stable and change only what the feedback requires.
- Do not invent product capabilities, workflows, claims, UI states, or score scales that are not supported by the strategy context, local codebase reality context, or explicit brief.
- Avoid generic prompt filler such as "award-winning", "masterpiece", "8k", "ultra detailed", "viral", or "trending on dribbble".
- Keep the composition minimal, scroll-stopping, and legible at a glance.

Return JSON only:
- prompt: final Gemini render prompt
- styleName: "${VISUAL_HOUSE_STYLE.name}"
`,
  });
}

export const analyzeSeoForBlog = async (
  title: string,
  description: string,
  content: string,
  keywords: string,
  imageAccessibility?: SeoImageAccessibilityInput
) => {
  const imageAccessibilitySummary = buildSeoImageAccessibilitySummary(imageAccessibility);

  // Pre-compute content facts so the LLM scores based on reality
  const internalLinkCount = extractMarkdownLinkCount(content);
  const hasCta = hasFinalCallToAction(content, 'TR') || hasFinalCallToAction(content, 'EN');
  const hasFaqSection = /##\s*(FAQ|Sıkça Sorulan Sorular|Frequently Asked Questions)/i.test(content);
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const titleLength = normalizeWhitespace(title).length;
  const descriptionLength = normalizeWhitespace(description).length;
  const hasH2 = /^##\s+/m.test(content);
  const allImagesHaveAlt = imageAccessibilitySummary.missingCount === 0;

  const contentFactsBlock = [
    'CONTENT FACTS (pre-computed from actual content — use as ground truth):',
    `- Title length: ${titleLength} characters (limit: 70)`,
    `- Meta description length: ${descriptionLength} characters (limit: 160)`,
    `- Word count: ~${wordCount}`,
    `- Heading structure (H2/H3): ${hasH2 ? 'present' : 'missing'}`,
    `- Internal blog links found: ${internalLinkCount}`,
    `- Final call-to-action section present: ${hasCta ? 'yes' : 'no'}`,
    `- FAQ section present: ${hasFaqSection ? 'yes' : 'no'}`,
    `- All images have alt text: ${allImagesHaveAlt ? 'yes' : 'no (missing: ' + imageAccessibilitySummary.missingCount + ')'}`,
  ].join('\n');

  const analysis = await runOpenAiJson<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] }>({
    schemaName: 'seo_analysis',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        score: { type: 'number' },
        keywords: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              word: { type: 'string' },
              count: { type: 'number' },
            },
            required: ['word', 'count'],
          },
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['score', 'keywords', 'suggestions'],
    },
    prompt: `
You are an expert SEO analyst.
Analyze this blog post and provide a practical SEO score.

${contentFactsBlock}

${imageAccessibilitySummary.promptBlock}

Target Keywords: ${keywords || 'None provided'}
Title: ${title}
Meta Description: ${description}
Content:
${content}

Scoring rubric (use CONTENT FACTS above to compute each):
- Title within 70 chars: +10
- Meta description within 160 chars: +10
- Target keywords appear naturally (3+ occurrences): +20
- Content length >= 800 words: +10
- Internal links >= 1: +10
- All images have alt text: +10
- FAQ section present: +10
- CTA section present: +10
- Heading structure with H2/H3: +10
Start at 0, add points for each satisfied criterion. Deduct up to 5 for poor keyword density or repetitive writing.

Rules:
- score: 0-100, computed strictly from the rubric above
- keywords: return top 4-6 terms with their exact occurrence count in the content
- suggestions: return 2-3 short, actionable improvement items
- CRITICAL: Only suggest improvements for criteria that are NOT already satisfied according to CONTENT FACTS
- Do NOT suggest adding internal links if internal links already exist (count >= 1)
- Do NOT suggest adding alt text if all images already have alt text
- Do NOT suggest adding a call-to-action if the CTA section is already present
- Do NOT suggest adding a FAQ if a FAQ section is already present
- Focus suggestions on genuinely missing or weak areas
`,
    temperature: 0.3,
  });

  if (!analysis) {
    return analysis;
  }

  // Post-process: filter suggestions that contradict pre-computed facts
  let normalizedSuggestions = Array.isArray(analysis.suggestions)
    ? analysis.suggestions.filter((item) => normalizeWhitespace(String(item || '')).length > 0)
    : [];

  normalizedSuggestions = normalizedSuggestions.filter((suggestion) => {
    const lower = suggestion.toLowerCase();
    // Filter out internal link suggestions when links already exist
    if (internalLinkCount > 0 && /internal\s+link/i.test(lower)) {
      return false;
    }
    // Filter out alt text suggestions when all images have alt text
    if (allImagesHaveAlt && /alt\s*text/i.test(lower)) {
      return false;
    }
    // Filter out CTA suggestions when CTA is present
    if (hasCta && /call[- ]to[- ]action|\bcta\b/i.test(lower)) {
      return false;
    }
    // Filter out FAQ suggestions when FAQ is present
    if (hasFaqSection && /\bfaq\b|frequently\s+asked/i.test(lower)) {
      return false;
    }
    return true;
  });

  if (imageAccessibilitySummary.missingCount > 0 && !normalizedSuggestions.some((item) => /alt text/i.test(item))) {
    normalizedSuggestions.unshift(
      imageAccessibilitySummary.missingCount === 1
        ? 'Add alt text to the missing image before publishing.'
        : `Add alt text to ${imageAccessibilitySummary.missingCount} images before publishing.`
    );
  }

  return {
    ...analysis,
    score: Math.max(
      0,
      Math.min(
        100,
        analysis.score - (
          imageAccessibilitySummary.missingCount > 0
            ? Math.min(12, imageAccessibilitySummary.missingCount * 4)
            : 0
        )
      )
    ),
    suggestions: normalizedSuggestions.slice(0, 3),
  };
};

export const generateBlogPost = async (
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string,
  topic: string,
  keywords: string,
  tone: string,
  length: string,
  language: string,
  imageStyle: string,
  recentPosts: RecentTopicReference[] = [],
  sanityCategories: { id: string; name: string }[] = [],
  keywordStrategy: BlogKeywordStrategy | null = null
): Promise<BlogPostResponse | null> => {
  const normalizedLanguage = normalizeAppLanguage(language, 'TR');
  const isBoth = isDualLanguage(normalizedLanguage);
  const primaryLanguage = getPrimaryLanguage(normalizedLanguage);
  const targetLang = getLanguageName(primaryLanguage);
  const blogLength = resolveBlogLengthRequirements(length);
  const normalizedStructuredKeywordStrategy = normalizeKeywordStrategyCandidate(
    keywordStrategy,
    keywords,
    primaryLanguage === 'TR'
  );
  const normalizedKeywordHints = normalizedStructuredKeywordStrategy
    ? buildKeywordSummaryList(normalizedStructuredKeywordStrategy)
    : normalizeSeoKeywordList(keywords, primaryLanguage === 'TR');
  const keywordStrategyInstruction = buildKeywordStrategyInstruction(primaryLanguage);
  const structuredKeywordStrategyInstruction = buildStructuredKeywordStrategyPromptBlock(
    normalizedStructuredKeywordStrategy,
    primaryLanguage
  );
  const writingQualityInstruction = buildBlogWritingQualityInstruction('draft');
  const strategyContextInstruction = buildStrategyContextInstruction();
  const recentPostsInstruction = buildRecentPostsInstruction(recentPosts, []);
  const categoryDistributionInstruction = buildCategoryDistributionInstruction(recentPosts, sanityCategories);
  const portfolioStageInstruction = buildPortfolioStageInstruction(recentPosts.length);
  const titleGuidanceInstruction = buildSearchIntentTitleGuidance(primaryLanguage);

  const schema: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      slug: { type: 'string' },
      categoryId: { type: ['string', 'null'] },
      content: { type: 'string' },
    },
    required: [
      'title',
      'description',
      'slug',
      'categoryId',
      'content',
    ],
  };

  const postData = await runOpenAiJson<BlogPostResponse>({
    schemaName: 'blog_post_bundle',
    schema,
    temperature: 0.7,
    prompt: `
You are a senior SEO content strategist.
You will handle all reasoning and decisions for topic angle, keyword usage, and final blog structure.

PRODUCT CONTEXT:
Product Name: ${productName || 'Our Product'}
Feature/Focus Area: ${featureName || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Product Description: ${description || 'A modern software solution.'}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}

BLOG INPUT:
Topic/Instruction: ${topic || 'No explicit topic provided. Decide the best topic based on context.'}
Additional Keyword Hints: ${normalizedKeywordHints.length > 0 ? normalizedKeywordHints.join(', ') : 'None provided. Decide and integrate 3-5 strong keywords yourself.'}
Tone: ${tone}
Length: ${blogLength.label}
Language: ${targetLang}
Image Style: ${imageStyle}
${recentPostsInstruction}
${categoryDistributionInstruction}
${portfolioStageInstruction}
${titleGuidanceInstruction}
${keywordStrategyInstruction}
${structuredKeywordStrategyInstruction}
${writingQualityInstruction}

CRITICAL RULES:
1. Every title field must be <= ${MAX_SEO_TITLE_LENGTH} chars.
2. Description fields must be <= 160 chars.
3. Content must be markdown with H2/H3, bullets, and double line breaks.
4. Add a final FAQ section with 3-4 Q&A.
5. NEVER include script tags, JSON-LD, HTML, or code fences in article body.
6. In content, add inline image markers only when truly useful.
   - Short and medium drafts should include at least 1 inline image marker in a strong explanatory section.
   - Long drafts should include 2 inline image markers spaced across different sections when possible.
7. Inline image placement:
   - If an inline visual is necessary, insert a marker on its own line using EXACTLY this format: <!-- BLOG_IMAGE:image-1 -->
   - Use sequential ids: image-1, image-2, image-3
   - Use at most 3 inline image markers in total
   - Do NOT include raw image prompts anywhere inside content
   - Do NOT include square-bracket image tokens like [IMAGE_PROMPT: ...] or [IMAGE_PLACEHOLDER_X]
8. categoryId rules:
   - If SANITY CATEGORY DISTRIBUTION SNAPSHOT exists, choose a valid category ID from that list.
   - Prefer under-covered categories when topic fit is reasonable.
   - If no category snapshot exists, return null.
9. Turkish writing quality (for Turkish output fields):
   - Do not use English marketing words like lead, conversion, engagement, workflow, sales funnel.
   - Use Turkish equivalents (müşteri adayı, dönüşüm, etkileşim, iş akışı, satış hunisi).
10. Content structure:
   - Start with 1-2 short intro paragraphs before the first H2.
   - End the article with a reader-facing call to action section.
   - FAQ must appear before the final CTA section.
11. Writing quality:
   - Do not repeat the title as the first H2.
   - Each H2 section must introduce a clearly different angle.
   - Avoid repeating the same noun phrase across adjacent paragraphs or bullets.
   - Keep paragraphs concise and information-dense.
12. Length planning:
   - Minimum word count: ${blogLength.minWords}
   - Target range: ${blogLength.minWords}-${blogLength.maxWords} words
   - Ideal word count: around ${blogLength.targetWords} words
   - Recommended H2 sections: ${blogLength.recommendedH2Count}
   - Do not return a thin draft that stops below the minimum word count.
13. Title quality:
   - Titles must reflect a clear search intent, not a generic announcement.
   - Prefer specific patterns such as problem/solution, how-to, comparison, checklist, template, or use-case framing.
   - Avoid generic titles like "ürün notu", "product update", or "feature news" unless the user explicitly asked for release notes.
14. If the broader workflow later needs an English version, that translation will happen in a separate call. This step must still return only the primary ${targetLang} fields.
`,
  });

  if (!postData) {
    return null;
  }

  const shouldNormalizeTurkish = primaryLanguage === 'TR';

  if (shouldNormalizeTurkish) {
    postData.title = normalizeTurkishMarketingText(postData.title);
    postData.description = normalizeTurkishMarketingText(postData.description);
    postData.content = normalizeTurkishMarketingText(postData.content);
  } else {
    postData.content = cleanGeneratedMarkdownArtifacts(postData.content);
  }

  for (let pass = 0; pass < 2 && countWords(postData.content) < blogLength.minWords; pass += 1) {
    const expanded = await expandBlogPostToMeetLength({
      productName,
      featureName,
      targetAudience,
      description,
      topic,
      keywords: normalizedKeywordHints.join(', '),
      tone,
      language: primaryLanguage,
      title: postData.title,
      excerpt: postData.description,
      content: postData.content,
      minWords: blogLength.minWords,
      maxWords: blogLength.maxWords,
      targetWords: blogLength.targetWords,
      recommendedH2Count: blogLength.recommendedH2Count,
    });

    const nextContent = shouldNormalizeTurkish
      ? normalizeTurkishMarketingText(expanded?.content || '')
      : cleanGeneratedMarkdownArtifacts(expanded?.content || '');

    if (!nextContent || countWords(nextContent) <= countWords(postData.content)) {
      break;
    }

    postData.content = nextContent;
  }

  postData.title = await ensureTitleWithinLimit(postData.title, primaryLanguage);

  if (!normalizeWhitespace(postData.slug)) {
    postData.slug = slugifyText(postData.title);
  }

  postData.content = sanitizeInternalBlogLinks(postData.content, recentPosts, primaryLanguage);
  postData.content = ensureFinalCallToAction(postData.content, primaryLanguage, productName, featureName);
  postData.content = ensureInlineImageSlotCoverageForLength(
    postData.content,
    resolveTargetInlineImageCount(blogLength.key)
  );

  const imagePlanSchema: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    properties: {
      coverImagePrompt: { type: 'string' },
      coverAltText: { type: 'string' },
      inlineImages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            slotId: { type: 'string' },
            prompt: { type: 'string' },
            altText: { type: 'string' },
          },
          required: ['slotId', 'prompt', 'altText'],
        },
      },
    },
    required: ['coverImagePrompt', 'coverAltText', 'inlineImages'],
  };

  const imagePlan = await runOpenAiJson<{
    coverImagePrompt: string;
    coverAltText: string;
    inlineImages: BlogInlineImagePlan[];
  }>({
    schemaName: 'blog_image_plan',
    schema: imagePlanSchema,
    temperature: 0.4,
    prompt: `
You are a senior editorial image strategist for a B2B SaaS publication.
Generate the image plan for the article below.

Title: ${postData.title}
Description: ${postData.description}
Language: ${isBoth ? 'Turkish source article with separate English translation' : targetLang}
${buildBlogImagePromptPolicy(imageStyle)}

ARTICLE CONTEXT SNAPSHOT:
${buildImagePlanContextSnapshot(postData.content)}

Return:
- coverImagePrompt: one strong cover prompt
- coverAltText: short SEO-friendly alt text
- inlineImages: one item per slot marker found in the markdown

Rules:
- Return SHORT prompt seeds only, not full production prompts. The renderer will add house-style rules later.
- coverImagePrompt must be 6-14 words, in English, semantic, and tied to the article topic.
- coverImagePrompt must describe a meaningful brandless business metaphor, not a blank panel or generic glass rectangle.
- coverImagePrompt must avoid vague filler words like "concept", "visual", "illustration", or "metaphor" unless absolutely necessary.
- Do not include house-style wording like "dark background", "negative space", "minimal composition", or "no text" in the returned prompt.
- inlineImages[].prompt must be 6-18 words, in English, and begin with either "Editorial photo:" or "Explainer card:".
- inlineImages[].prompt must be concise and non-repetitive. No long sentences, no repeated stems, no style-policy language.
- Use the exact slot ids already present in the markdown.
- Do not invent new slot ids.
- If no inline slot exists, return an empty inlineImages array.
- Prompts must be elegant, minimal, editorial, business-relevant, and visually realistic where appropriate.
`,
  });

  postData.coverImagePrompt = finalizeCoverImagePromptText(
    imagePlan?.coverImagePrompt || 'Minimal glassmorphism editorial B2B cover'
  );
  postData.coverAltText = shouldNormalizeTurkish
    ? normalizeTurkishMarketingText(imagePlan?.coverAltText || 'Blog kapak gorseli')
    : cleanGeneratedMarkdownArtifacts(imagePlan?.coverAltText || 'Blog cover image');
  postData.inlineImages = ensureInlineImageCoverage(
    normalizeInlineImages(imagePlan?.inlineImages, postData.content, postData.contentEN).map((image) => ({
      ...image,
      prompt: finalizeInlineImagePromptText(image.prompt),
    })),
    postData.content,
    postData.contentEN,
    postData.title,
    postData.description,
    imageStyle,
    shouldNormalizeTurkish
  );

  if (isBoth) {
    const translated = await translateBlogPostToEnglish({
      productName,
      featureName,
      targetAudience,
      description,
      topic,
      keywords: normalizedKeywordHints.join(', '),
      tone,
      length: blogLength.label,
      title: postData.title,
      excerpt: postData.description,
      content: postData.content,
      coverAltText: postData.coverAltText,
    });

    if (!translated) {
      return null;
    }

    postData.titleEN = await ensureTitleWithinLimit(cleanGeneratedMarkdownArtifacts(translated.titleEN), 'EN');
    postData.descriptionEN = cleanGeneratedMarkdownArtifacts(translated.descriptionEN);
    postData.contentEN = ensureFinalCallToAction(
      sanitizeInternalBlogLinks(cleanGeneratedMarkdownArtifacts(translated.contentEN), recentPosts, 'EN'),
      'EN',
      productName,
      featureName
    );
    postData.slugEN = slugifyText(postData.titleEN);
    postData.coverImagePromptEN = postData.coverImagePrompt;
    postData.coverAltTextEN = cleanGeneratedMarkdownArtifacts(translated.coverAltTextEN);
  }

  postData.category = resolveCategoryMeta(postData.categoryId, sanityCategories, recentPosts);
  postData.categoryId = postData.category?.id || null;
  return postData;
};

export const addInternalLinks = async (
  currentContent: string,
  sanityPosts: SanityPostReference[],
  language: string,
  productName?: string,
  featureName?: string
): Promise<string | null> => {
  const selectedPosts = selectRelevantSanityPosts(sanityPosts, currentContent, 16);
  if (selectedPosts.length === 0) {
    return currentContent;
  }

  const targetLanguage = getPrimaryLanguage(language);
  const postsList = buildInternalPostsList(selectedPosts, targetLanguage);
  if (!postsList.trim()) {
    return currentContent;
  }
  const strategyContextInstruction = buildStrategyContextInstruction();
  const countInternalLinks = (content: string | null | undefined) =>
    extractValidatedUsedInternalBlogLinks([
      {
        content,
        language: targetLanguage,
      },
    ], selectedPosts).length;
  const finalizeLinkedContent = (content: string) => {
    const cleaned = targetLanguage === 'TR'
      ? normalizeTurkishMarketingText(content)
      : cleanGeneratedMarkdownArtifacts(content);

    return ensureFinalCallToAction(
      sanitizeInternalBlogLinks(cleaned, selectedPosts, targetLanguage),
      targetLanguage,
      productName || 'Qualy',
      featureName || ''
    );
  };
  const buildPrompt = (mustAddLink: boolean) => `
You are an expert SEO content editor.
Add natural internal links to this markdown blog post.

Language: ${getLanguageName(targetLanguage)}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}

Available Internal Posts:
${postsList}

Current Content:
${currentContent}

Rules:
- Add 1-3 links only when context is relevant.
- Use markdown links with the exact provided site-relative URLs.
- Never invent a slug, URL, or post that is not listed above.
- Do not rewrite, summarize, or reorder the article. Only add link markup into existing relevant phrasing.
- Keep all formatting and preserve every <!-- BLOG_IMAGE:image-x --> marker exactly as-is.
- If any legacy [IMAGE_PROMPT: ...] token appears, leave it untouched. Do not invent new ones.
- ${mustAddLink
    ? 'You must add at least one exact internal link from the provided list.'
    : 'If the article already has no internal links, prefer adding at least one exact internal link from the provided list when a contextual bridge exists.'}
- Return only the full revised markdown.
`;
  const existingLinkCount = countInternalLinks(currentContent);

  return runOpenAiChat({
    temperature: 0.3,
    prompt: buildPrompt(false),
  }).then(async (result) => {
    if (!result) {
      return result;
    }

    const firstPassContent = finalizeLinkedContent(result);
    const firstPassLinkCount = countInternalLinks(firstPassContent);
    if (firstPassLinkCount > existingLinkCount) {
      return firstPassContent;
    }

    if (existingLinkCount > 0) {
      return currentContent;
    }

    const retryResult = await runOpenAiChat({
      temperature: 0.2,
      prompt: buildPrompt(true),
    });

    if (!retryResult) {
      return currentContent;
    }

    const secondPassContent = finalizeLinkedContent(retryResult);
    const secondPassLinkCount = countInternalLinks(secondPassContent);
    if (secondPassLinkCount > existingLinkCount) {
      return secondPassContent;
    }

    const fallbackPost = selectedPosts[0];
    if (!fallbackPost) {
      return currentContent;
    }

    const fallbackContent = finalizeLinkedContent(
      injectFallbackInternalLink(currentContent, fallbackPost, targetLanguage)
    );
    return countInternalLinks(fallbackContent) > existingLinkCount ? fallbackContent : currentContent;
  });
};

export const editBlogPost = async (
  currentContent: string,
  instruction: string,
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string,
  language: string,
  sanityPosts?: SanityPostReference[]
): Promise<string | null> => {
  const targetLanguage = getPrimaryLanguage(language);
  const selectedPosts = sanityPosts && sanityPosts.length > 0
    ? selectRelevantSanityPosts(
        sanityPosts,
        `${currentContent}\n${instruction}\n${featureName}\n${description}`,
        14
      )
    : [];
  const postsList = selectedPosts.length > 0
    ? buildInternalPostsList(selectedPosts, targetLanguage)
    : '';
  let internalLinksInstruction = '';
  if (postsList.trim()) {
    internalLinksInstruction = `
Optional Internal Linking Targets:
${postsList}
`;
  }

  const strategyContextInstruction = buildStrategyContextInstruction();
  const writingQualityInstruction = buildBlogWritingQualityInstruction('revise');

  return runOpenAiChat({
    temperature: 0.6,
    prompt: `
You are an expert SEO copywriter and editor.
Revise the markdown blog based on the user's instruction.

Language: ${getLanguageName(targetLanguage)}
Product Name: ${productName || 'Our Product'}
Feature: ${featureName || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Description: ${description || 'A modern software solution'}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}
${writingQualityInstruction}

CURRENT BLOG:
${currentContent}

USER INSTRUCTION:
${instruction}

Rules:
- Apply only requested edits, keep the rest unchanged.
- Preserve markdown structure and keep every <!-- BLOG_IMAGE:image-x --> marker exactly as-is.
- If any legacy [IMAGE_PROMPT: ...] token appears, leave it untouched. Do not invent new ones.
- Do NOT include script tags, JSON-LD, HTML, or code fences.
- If internal links are used, they must come only from the provided internal-link targets.
- Return only revised markdown.
${internalLinksInstruction}
`,
  }).then((result) => {
    if (!result) {
      return result;
    }

    const cleaned = targetLanguage === 'TR'
      ? normalizeTurkishMarketingText(result)
      : cleanGeneratedMarkdownArtifacts(result);
    const validated = postsList.trim()
      ? sanitizeInternalBlogLinks(
          cleaned,
          selectedPosts,
          targetLanguage
        )
      : cleaned;
    return ensureFinalCallToAction(validated, targetLanguage, productName, featureName);
  });
};

export const generateSocialPosts = async (
  blogContent: string,
  language: string
): Promise<{ twitter: string; linkedin: string } | null> => {
  return runOpenAiJson<{ twitter: string; linkedin: string }>({
    schemaName: 'social_posts',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        twitter: { type: 'string' },
        linkedin: { type: 'string' },
      },
      required: ['twitter', 'linkedin'],
    },
    prompt: `
Generate promotional social posts for this blog.

Language: ${getSingleOutputLanguageName(language)}
Blog Content (excerpt):
${String(blogContent || '').slice(0, 3500)}

Rules:
- twitter: punchy, under 280 chars, 2-3 hashtags, CTA
- linkedin: professional, hook + 2-3 bullets + CTA + 3-5 hashtags
`,
  });
};

export const generateTopicIdeas = async (
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string,
  language: string,
  existingTopics: string[] = [],
  recentPosts: RecentTopicReference[] = [],
  recentPostTitles: string[] = [],
  sanityCategories: { id: string; name: string }[] = []
): Promise<TopicIdeaSuggestion[] | null> => {
  const strategyContextInstruction = buildStrategyContextInstruction();
  const recencyInstruction = buildRecentPostsInstruction(recentPosts, recentPostTitles, 12);
  const categoryDistributionInstruction = buildCategoryDistributionInstruction(recentPosts, sanityCategories);
  const portfolioStageInstruction = buildPortfolioStageInstruction(recentPosts.length);
  const primaryLanguage = getPrimaryLanguage(language);
  const shouldNormalizeTurkish = primaryLanguage === 'TR';
  const titleGuidanceInstruction = buildSearchIntentTitleGuidance(primaryLanguage);
  const keywordStrategyInstruction = buildKeywordStrategyInstruction(primaryLanguage);

  const payload = await runOpenAiJson<{ items: TopicIdeaSuggestion[] }>({
    schemaName: 'topic_ideas',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              topic: { type: 'string' },
              keywords: { type: 'string' },
              categoryId: { type: ['string', 'null'] },
              keywordStrategy: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  primaryKeyword: { type: 'string' },
                  secondaryKeywords: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  supportKeywords: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  longTailKeywords: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  semanticKeywords: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: [
                  'primaryKeyword',
                  'secondaryKeywords',
                  'supportKeywords',
                  'longTailKeywords',
                  'semanticKeywords',
                ],
              },
              reason: { type: 'string' },
              categoryGap: { type: 'string' },
              excludedRecentTitles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['topic', 'keywords', 'categoryId', 'keywordStrategy', 'reason', 'categoryGap', 'excludedRecentTitles'],
          },
        },
      },
      required: ['items'],
    },
    prompt: `
You are a senior SEO content strategist and B2B SaaS marketing manager.
Decide the best next blog topics and keyword sets.

Product Name: ${productName || 'Not provided'}
Feature Name: ${featureName || 'Not provided'}
Target Audience: ${targetAudience || 'Not provided'}
Description: ${description || 'Not provided'}
Language: ${getSingleOutputLanguageName(language)}
${strategyContextInstruction}
${recencyInstruction}
${categoryDistributionInstruction}
${portfolioStageInstruction}
${titleGuidanceInstruction}
${keywordStrategyInstruction}

BATCH DIVERSITY RULES:
- Diversify the batch across multiple categories and intent types when reasonable.
- Do not put all 5 ideas into the same category just because it has the highest PriorityScore.
- If category snapshot exists, aim for at least 3 distinct categories across the 5 ideas when fit is reasonable.
- Do not default to Vaka Analizi / Case Study framing unless the context clearly includes customer proof, outcomes, or metrics.

Already generated topics (avoid overlap):
${existingTopics.length > 0 ? existingTopics.map((topic) => `- ${topic}`).join('\n') : '- none'}

Return exactly 5 items:
- topic: title/topic suggestion
- keywords: a flat comma-separated summary list for UI display, with the primary keyword first
- categoryId:
  - if SANITY CATEGORY DISTRIBUTION SNAPSHOT exists, choose a valid category ID from it
  - otherwise return null
- keywordStrategy:
  - primaryKeyword: exactly 1 main keyword
  - secondaryKeywords: 3-6 close variants or adjacent phrases
  - supportKeywords: 5-10 coverage terms that deepen the topic
  - longTailKeywords: 4-8 longer user-intent phrases
  - semanticKeywords: 8-15 related terms/entities/concepts
- reason: short explanation of why this topic is timely now
- categoryGap: short explanation of the category coverage gap
- excludedRecentTitles: up to 3 recent titles this idea intentionally avoids overlapping with

Quality rules for Turkish output:
- Do not use English marketing words like lead, conversion, engagement, workflow, sales funnel.
- Use Turkish equivalents (müşteri adayı, dönüşüm, etkileşim, iş akışı, satış hunisi).
- Use natural Turkish characters instead of ASCII spellings such as hazir, nasil, urun, icin.
`,
  });

  if (!Array.isArray(payload?.items)) {
    return null;
  }

  return payload.items
    .map((item) => normalizeTopicIdeaCandidate(item, shouldNormalizeTurkish, sanityCategories, recentPosts))
    .filter((item): item is TopicIdeaSuggestion => Boolean(item));
};
