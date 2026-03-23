import { getOpenAiApiKey } from './env';
import { getStrategyContextSnapshot } from './strategy-context';
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
  ensureFinalCallToAction,
} from '../lib/blog-call-to-action';
import {
  resolveDraftCategory,
  type DraftCategoryOption,
  type DraftRecentCategoryReference,
} from '../lib/blog-category-resolution';
import {
  finalizeCoverImagePromptText,
  finalizeInlineImagePromptText,
  getCoverImageHouseStyleBullets,
  getInlineImageHouseStyleBullets,
} from '../lib/editorial-cover-style';
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
  publishedAt?: string;
}

export interface RecentTopicReference {
  title: string;
  excerpt?: string;
  category?: string;
  categoryId?: string;
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
  reason?: string;
  categoryGap?: string;
  excludedRecentTitles?: string[];
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

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  let normalized = String(value || '');

  for (const item of TURKISH_MARKETING_TERM_REPLACEMENTS) {
    normalized = normalized.replace(item.pattern, item.replacement);
  }

  return normalized;
}

export function normalizeTurkishTextQuality(value: string) {
  let normalized = String(value || '');

  for (const item of TURKISH_ASCII_TEXT_REPLACEMENTS) {
    normalized = normalized.replace(
      item.pattern,
      (match) => applyTurkishCasePattern(match, item.replacement)
    );
  }

  return normalized;
}

function normalizeTurkishMarketingText(value: string) {
  return cleanGeneratedMarkdownArtifacts(
    normalizeTurkishTextQuality(enforceTurkishMarketingTerminology(value))
  );
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
      return existing;
    }

    const altText = shouldNormalizeTurkish
      ? normalizeTurkishMarketingText(`${title} icin blog gorseli`)
      : cleanGeneratedMarkdownArtifacts(`${title} blog image`);

    return {
      slotId,
      prompt: buildFallbackInlineImagePrompt(title, description, slotId, imageStyle),
      altText,
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
  const keywords = normalizeWhitespace(String(item?.keywords || ''));
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
    reason: reason || undefined,
    categoryGap: categoryGap || undefined,
    excludedRecentTitles,
  };
}

function slugifyText(value: string) {
  return normalizeWhitespace(value)
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
- Prefer categories with higher PriorityScore when topic fit is reasonable.
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
Keywords Input: ${input.keywords || 'Not provided'}
Tone: ${input.tone}
Length: ${input.length}
${QUALY_SITE_GUARDRAILS}

SOURCE TURKISH FIELDS:
Title: ${input.title}
Description: ${input.excerpt}
Cover Alt Text: ${input.coverAltText}

Content:
${input.content}

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
  campaignType: string,
  tone: string,
  language: string
) {
  const outputLanguage = getSingleOutputLanguageName(language);
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
Campaign Type: ${campaignType}
Tone: ${tone}
Language: ${outputLanguage}

Rules:
- headline: max 8 words
- subheadline: max 15 words
- cta: max 4 words
- avoid generic buzzwords
`,
  });
}

export async function generateCopyIdeas(
  productName: string,
  featureName: string,
  description: string,
  campaignType: string,
  tone: string,
  language: string
) {
  const outputLanguage = getSingleOutputLanguageName(language);
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
Campaign Type: ${campaignType}
Tone: ${tone}
Language: ${outputLanguage}

Return 3 options for each field.
`,
  });
}

export const analyzeSeoForBlog = async (
  title: string,
  description: string,
  content: string,
  keywords: string
) => {
  return runOpenAiJson<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] }>({
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

Target Keywords: ${keywords || 'None provided'}
Title: ${title}
Meta Description: ${description}
Content:
${content}

Rules:
- score: 0-100
- keywords: return top 4-6 terms with exact count
- suggestions: 2-3 short actionable items
`,
    temperature: 0.3,
  });
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
  sanityCategories: { id: string; name: string }[] = []
): Promise<BlogPostResponse | null> => {
  const normalizedLanguage = normalizeAppLanguage(language, 'TR');
  const isBoth = isDualLanguage(normalizedLanguage);
  const primaryLanguage = getPrimaryLanguage(normalizedLanguage);
  const targetLang = getLanguageName(primaryLanguage);
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
Keywords Input: ${keywords || 'No keywords provided. Decide and integrate 3-5 strong keywords yourself.'}
Tone: ${tone}
Length: ${length}
Language: ${targetLang}
Image Style: ${imageStyle}
${recentPostsInstruction}
${categoryDistributionInstruction}
${portfolioStageInstruction}
${titleGuidanceInstruction}

CRITICAL RULES:
1. Every title field must be <= ${MAX_SEO_TITLE_LENGTH} chars.
2. Description fields must be <= 160 chars.
3. Content must be markdown with H2/H3, bullets, and double line breaks.
4. Add a final FAQ section with 3-4 Q&A.
5. NEVER include script tags, JSON-LD, HTML, or code fences in article body.
6. In content, add inline image markers only when truly useful.
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
12. Title quality:
   - Titles must reflect a clear search intent, not a generic announcement.
   - Prefer specific patterns such as problem/solution, how-to, comparison, checklist, template, or use-case framing.
   - Avoid generic titles like "ürün notu", "product update", or "feature news" unless the user explicitly asked for release notes.
13. If the broader workflow later needs an English version, that translation will happen in a separate call. This step must still return only the primary ${targetLang} fields.
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

  postData.title = await ensureTitleWithinLimit(postData.title, primaryLanguage);

  if (!normalizeWhitespace(postData.slug)) {
    postData.slug = slugifyText(postData.title);
  }

  postData.content = ensureFinalCallToAction(postData.content, primaryLanguage, productName, featureName);

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
      keywords,
      tone,
      length,
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
      cleanGeneratedMarkdownArtifacts(translated.contentEN),
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
  const strategyContextInstruction = buildStrategyContextInstruction();

  return runOpenAiChat({
    temperature: 0.3,
    prompt: `
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
- Keep all formatting and preserve every <!-- BLOG_IMAGE:image-x --> marker exactly as-is.
- If any legacy [IMAGE_PROMPT: ...] token appears, leave it untouched. Do not invent new ones.
- Return only the full revised markdown.
`,
  }).then((result) => {
    if (!result) {
      return result;
    }

    const cleaned = targetLanguage === 'TR'
      ? normalizeTurkishMarketingText(result)
      : cleanGeneratedMarkdownArtifacts(result);
    return ensureFinalCallToAction(cleaned, targetLanguage, productName || 'Qualy', featureName || '');
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
  let internalLinksInstruction = '';
  if (sanityPosts && sanityPosts.length > 0) {
    const selectedPosts = selectRelevantSanityPosts(
      sanityPosts,
      `${currentContent}\n${instruction}\n${featureName}\n${description}`,
      14
    );
    if (selectedPosts.length > 0) {
      const postsList = buildInternalPostsList(selectedPosts, targetLanguage);
      internalLinksInstruction = `
Optional Internal Linking Targets:
${postsList}
`;
    }
  }

  const strategyContextInstruction = buildStrategyContextInstruction();

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

CURRENT BLOG:
${currentContent}

USER INSTRUCTION:
${instruction}

Rules:
- Apply only requested edits, keep the rest unchanged.
- Preserve markdown structure and keep every <!-- BLOG_IMAGE:image-x --> marker exactly as-is.
- If any legacy [IMAGE_PROMPT: ...] token appears, leave it untouched. Do not invent new ones.
- Do NOT include script tags, JSON-LD, HTML, or code fences.
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
    return ensureFinalCallToAction(cleaned, targetLanguage, productName, featureName);
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
              reason: { type: 'string' },
              categoryGap: { type: 'string' },
              excludedRecentTitles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['topic', 'keywords', 'categoryId', 'reason', 'categoryGap', 'excludedRecentTitles'],
          },
        },
      },
      required: ['items'],
    },
    prompt: `
You are a senior content strategist.
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

Already generated topics (avoid overlap):
${existingTopics.length > 0 ? existingTopics.map((topic) => `- ${topic}`).join('\n') : '- none'}

Return exactly 5 items:
- topic: title/topic suggestion
- keywords: 3-5 comma separated SEO keywords
- categoryId:
  - if SANITY CATEGORY DISTRIBUTION SNAPSHOT exists, choose a valid category ID from it
  - otherwise return null
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
