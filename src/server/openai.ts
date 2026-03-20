import { getOpenAiApiKey } from './env';
import { getStrategyContextSnapshot } from './strategy-context';
import { selectRelevantSanityPosts } from './gemini';
import {
  buildBlogImageSlotMarker,
  extractBlogImageSlotIds,
  normalizeBlogImageSlotId,
  type BlogInlineImagePlan,
} from '../lib/blog-image-slots';
export { buildBlogImageSlotMarker, extractBlogImageSlotIds } from '../lib/blog-image-slots';

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
const DEFAULT_CTA_HEADING: Record<'TR' | 'EN', string> = {
  TR: '## Sonraki Adım',
  EN: '## Next Step',
};

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

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function cleanGeneratedMarkdownArtifacts(value: string) {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
  const cleanedLines = lines.filter((line) => !ORPHAN_BRACKET_LINE_REGEX.test(line.trim()));
  const sliced = cleanedLines.join('\n');

  return sliced
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function enforceTurkishMarketingTerminology(value: string) {
  let normalized = String(value || '');

  for (const item of TURKISH_MARKETING_TERM_REPLACEMENTS) {
    normalized = normalized.replace(item.pattern, item.replacement);
  }

  return normalized;
}

function normalizeTurkishMarketingText(value: string) {
  return cleanGeneratedMarkdownArtifacts(enforceTurkishMarketingTerminology(value));
}

function buildCallToActionBody(language: 'TR' | 'EN', productName: string, featureName: string) {
  const normalizedProduct = normalizeWhitespace(productName || 'Qualy');
  const normalizedFeature = normalizeWhitespace(featureName || 'mesajlaşma ve satış otomasyonu');

  if (language === 'EN') {
    return `${normalizedProduct} can help you turn ${normalizedFeature} into a repeatable growth workflow. If you want to review your current setup and identify the fastest improvements, get in touch with our team.`;
  }

  return `${normalizedProduct}, ${normalizedFeature} sürecini daha ölçülebilir ve tekrar edilebilir hale getirmene yardımcı olabilir. Mevcut yapını birlikte değerlendirmek ve en hızlı iyileştirme alanlarını görmek istersen ekibimizle iletişime geçebilirsin.`;
}

export function ensureFinalCallToAction(
  content: string,
  language: 'TR' | 'EN',
  productName: string,
  featureName: string
) {
  const heading = DEFAULT_CTA_HEADING[language];
  const normalized = cleanGeneratedMarkdownArtifacts(content);
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

function buildBlogImagePromptPolicy(imageStyle: string) {
  return `
IMAGE PROMPT POLICY:
- Prompts must be in English.
- Absolutely no visible text, no words, no letters, no numbers, no labels, no logos, no watermarks.
- No screenshots, no product UI mockups, no dashboard panels, no fake app interfaces.
- Prefer elegant editorial concepts: refined still life, abstract spatial metaphor, premium object study, architectural light-and-shadow, tactile material composition.
- Prefer a single focal subject and at most 2-3 supporting objects.
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
    const prompt = cleanGeneratedMarkdownArtifacts(String(image?.prompt || ''));
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

  return cleanGeneratedMarkdownArtifacts(
    `Elegant editorial visual for "${subject}". Abstract business metaphor, minimal composition, single focal subject, negative space, premium lighting, and restrained palette. Visual direction: ${visualDirection}. Slot reference: ${slotId}.`
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
    return shouldNormalizeTurkish ? enforceTurkishMarketingTerminology(normalized) : normalized;
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
    topic: shouldNormalizeTurkish ? enforceTurkishMarketingTerminology(topic) : topic,
    keywords: shouldNormalizeTurkish ? enforceTurkishMarketingTerminology(keywords) : keywords,
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

export function resolveCategoryId(
  rawCategoryId: string | null | undefined,
  sanityCategories: { id: string; name: string }[],
  recentPosts: RecentTopicReference[]
) {
  const normalizedCategories = sanityCategories
    .map((category) => ({
      id: normalizeWhitespace(category.id || ''),
      name: normalizeWhitespace(category.name || ''),
    }))
    .filter((category) => category.id && category.name);

  if (normalizedCategories.length === 0) {
    return null;
  }

  const candidate = normalizeWhitespace(String(rawCategoryId || ''));
  const exactMatch = normalizedCategories.find((category) => category.id === candidate);
  if (exactMatch) {
    return exactMatch.id;
  }

  const byName = normalizedCategories.find((category) => category.name.toLowerCase() === candidate.toLowerCase());
  if (byName) {
    return byName.id;
  }

  const countsById = new Map<string, number>();
  const countsByName = new Map<string, number>();
  for (const post of recentPosts) {
    const categoryId = normalizeWhitespace(post.categoryId || '').toLowerCase();
    if (categoryId) {
      countsById.set(categoryId, (countsById.get(categoryId) || 0) + 1);
      continue;
    }

    const categoryName = normalizeWhitespace(post.category || '').toLowerCase();
    if (!categoryName) {
      continue;
    }
    countsByName.set(categoryName, (countsByName.get(categoryName) || 0) + 1);
  }

  const fallback = [...normalizedCategories].sort((a, b) => {
    const aCount = countsById.get(a.id.toLowerCase()) || countsByName.get(a.name.toLowerCase()) || 0;
    const bCount = countsById.get(b.id.toLowerCase()) || countsByName.get(b.name.toLowerCase()) || 0;
    if (aCount !== bCount) {
      return aCount - bCount;
    }
    return a.name.localeCompare(b.name);
  })[0];

  return fallback?.id || null;
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

Rules:
- Keep meaning.
- Keep SEO intent.
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
Language: ${language === 'TR' ? 'Turkish' : 'English'}

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
Language: ${language === 'TR' ? 'Turkish' : 'English'}

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
  const isBoth = language === 'BOTH';
  const targetLang = isBoth ? 'Turkish and English' : language === 'TR' ? 'Turkish' : 'English';
  const strategyContextInstruction = buildStrategyContextInstruction();
  const recentPostsInstruction = buildRecentPostsInstruction(recentPosts, []);
  const categoryDistributionInstruction = buildCategoryDistributionInstruction(recentPosts, sanityCategories);
  const portfolioStageInstruction = buildPortfolioStageInstruction(recentPosts.length);

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

  if (isBoth) {
    (schema.properties as Record<string, unknown>).titleEN = { type: 'string' };
    (schema.properties as Record<string, unknown>).descriptionEN = { type: 'string' };
    (schema.properties as Record<string, unknown>).slugEN = { type: 'string' };
    (schema.properties as Record<string, unknown>).contentEN = { type: 'string' };
    (schema.required as string[]).push('titleEN', 'descriptionEN', 'slugEN', 'contentEN');
  }

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
   - End the article with a reader-facing call to action section.
   - FAQ must appear before the final CTA section.
`,
  });

  if (!postData) {
    return null;
  }

  const shouldNormalizeTurkish = language === 'TR' || language === 'BOTH';

  if (shouldNormalizeTurkish) {
    postData.title = normalizeTurkishMarketingText(postData.title);
    postData.description = normalizeTurkishMarketingText(postData.description);
    postData.content = normalizeTurkishMarketingText(postData.content);
  } else {
    postData.content = cleanGeneratedMarkdownArtifacts(postData.content);
  }

  postData.title = await ensureTitleWithinLimit(postData.title, 'TR');
  if (postData.titleEN) {
    postData.titleEN = cleanGeneratedMarkdownArtifacts(postData.titleEN);
    postData.titleEN = await ensureTitleWithinLimit(postData.titleEN, 'EN');
  }
  if (postData.descriptionEN) {
    postData.descriptionEN = cleanGeneratedMarkdownArtifacts(postData.descriptionEN);
  }
  if (postData.contentEN) {
    postData.contentEN = cleanGeneratedMarkdownArtifacts(postData.contentEN);
  }

  if (!normalizeWhitespace(postData.slug)) {
    postData.slug = slugifyText(postData.title);
  }
  if (postData.titleEN && !normalizeWhitespace(String(postData.slugEN || ''))) {
    postData.slugEN = slugifyText(postData.titleEN);
  }

  postData.content = ensureFinalCallToAction(postData.content, 'TR', productName, featureName);
  if (postData.contentEN) {
    postData.contentEN = ensureFinalCallToAction(postData.contentEN, 'EN', productName, featureName);
  }

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
Language: ${targetLang}
${buildBlogImagePromptPolicy(imageStyle)}

ARTICLE MARKDOWN:
${postData.content}

${postData.contentEN ? `ENGLISH MARKDOWN:\n${postData.contentEN}\n` : ''}

Return:
- coverImagePrompt: one strong cover prompt
- coverAltText: short SEO-friendly alt text
- inlineImages: one item per slot marker found in the markdown

Rules:
- Use the exact slot ids already present in the markdown.
- Do not invent new slot ids.
- If no inline slot exists, return an empty inlineImages array.
- Prompts must be elegant, minimal, editorial, and business-relevant.
`,
  });

  postData.coverImagePrompt = cleanGeneratedMarkdownArtifacts(imagePlan?.coverImagePrompt || 'Minimal editorial B2B concept visual');
  postData.coverAltText = shouldNormalizeTurkish
    ? normalizeTurkishMarketingText(imagePlan?.coverAltText || 'Blog kapak gorseli')
    : cleanGeneratedMarkdownArtifacts(imagePlan?.coverAltText || 'Blog cover image');
  postData.inlineImages = ensureInlineImageCoverage(
    normalizeInlineImages(imagePlan?.inlineImages, postData.content, postData.contentEN),
    postData.content,
    postData.contentEN,
    postData.title,
    postData.description,
    imageStyle,
    shouldNormalizeTurkish
  );

  if (isBoth) {
    postData.coverImagePromptEN = postData.coverImagePrompt;
    postData.coverAltTextEN = cleanGeneratedMarkdownArtifacts(imagePlan?.coverAltText || 'Blog cover image');
  }

  postData.categoryId = resolveCategoryId(postData.categoryId, sanityCategories, recentPosts);
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

  const postsList = selectedPosts.map((p) => `- Title: "${p.title}", URL: "/blog/${p.slug}"`).join('\n');
  const strategyContextInstruction = buildStrategyContextInstruction();

  return runOpenAiChat({
    temperature: 0.3,
    prompt: `
You are an expert SEO content editor.
Add natural internal links to this markdown blog post.

Language: ${language === 'TR' ? 'Turkish' : 'English'}
${strategyContextInstruction}

Available Internal Posts:
${postsList}

Current Content:
${currentContent}

Rules:
- Add 1-3 links only when context is relevant.
- Use markdown links: [anchor](/blog/slug).
- Keep all formatting, <!-- BLOG_IMAGE:image-x --> markers, and any legacy image placeholders exactly.
- Return only the full revised markdown.
`,
  }).then((result) => {
    if (!result) {
      return result;
    }

    const cleaned = language === 'TR'
      ? normalizeTurkishMarketingText(result)
      : cleanGeneratedMarkdownArtifacts(result);
    return ensureFinalCallToAction(cleaned, language === 'TR' ? 'TR' : 'EN', productName || 'Qualy', featureName || '');
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
  let internalLinksInstruction = '';
  if (sanityPosts && sanityPosts.length > 0) {
    const selectedPosts = selectRelevantSanityPosts(
      sanityPosts,
      `${currentContent}\n${instruction}\n${featureName}\n${description}`,
      14
    );
    if (selectedPosts.length > 0) {
      const postsList = selectedPosts.map((p) => `- Title: "${p.title}", URL: "/blog/${p.slug}"`).join('\n');
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

Language: ${language === 'TR' ? 'Turkish' : 'English'}
Product Name: ${productName || 'Our Product'}
Feature: ${featureName || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Description: ${description || 'A modern software solution'}
${strategyContextInstruction}

CURRENT BLOG:
${currentContent}

USER INSTRUCTION:
${instruction}

Rules:
- Apply only requested edits, keep the rest unchanged.
- Preserve markdown structure, <!-- BLOG_IMAGE:image-x --> markers, and any legacy image prompt placeholders.
- Do NOT include script tags, JSON-LD, HTML, or code fences.
- Return only revised markdown.
${internalLinksInstruction}
`,
  }).then((result) => {
    if (!result) {
      return result;
    }

    const cleaned = cleanGeneratedMarkdownArtifacts(result);
    return ensureFinalCallToAction(cleaned, language === 'TR' ? 'TR' : 'EN', productName, featureName);
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

Language: ${language === 'TR' ? 'Turkish' : 'English'}
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
  const shouldNormalizeTurkish = language === 'TR' || language === 'BOTH';

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
Language: ${language === 'EN' ? 'English' : 'Turkish'}
${strategyContextInstruction}
${recencyInstruction}
${categoryDistributionInstruction}
${portfolioStageInstruction}

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
`,
  });

  if (!Array.isArray(payload?.items)) {
    return null;
  }

  return payload.items
    .map((item) => normalizeTopicIdeaCandidate(item, shouldNormalizeTurkish, sanityCategories, recentPosts))
    .filter((item): item is TopicIdeaSuggestion => Boolean(item));
};
