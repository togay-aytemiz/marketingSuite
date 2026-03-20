import { getOpenAiApiKey } from './env';
import { getStrategyContextSnapshot } from './strategy-context';
import { selectRelevantSanityPosts } from './gemini';

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
  inlineImages?: Array<{
    placeholder: string;
    prompt: string;
  }>;
  titleEN?: string;
  descriptionEN?: string;
  slugEN?: string;
  coverImagePromptEN?: string;
  coverAltTextEN?: string;
  contentEN?: string;
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

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  _sanityPosts?: SanityPostReference[],
  _sanityCategories?: { id: string; name: string }[]
): Promise<BlogPostResponse | null> => {
  const isBoth = language === 'BOTH';
  const targetLang = isBoth ? 'Turkish and English' : language === 'TR' ? 'Turkish' : 'English';
  const strategyContextInstruction = buildStrategyContextInstruction();

  const schema: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      slug: { type: 'string' },
      categoryId: { type: ['string', 'null'] },
      content: { type: 'string' },
      coverImagePrompt: { type: 'string' },
      coverAltText: { type: 'string' },
      inlineImages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            placeholder: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['placeholder', 'prompt'],
        },
      },
    },
    required: [
      'title',
      'description',
      'slug',
      'categoryId',
      'content',
      'coverImagePrompt',
      'coverAltText',
      'inlineImages',
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

CRITICAL RULES:
1. Every title field must be <= ${MAX_SEO_TITLE_LENGTH} chars.
2. Description fields must be <= 160 chars.
3. Content must be markdown with H2/H3, bullets, and double line breaks.
4. Add a final FAQ section with 3-4 Q&A.
5. NEVER include script tags, JSON-LD, HTML, or code fences in article body.
6. In content, add image placeholders exactly as [IMAGE_PLACEHOLDER_X].
7. Also return:
   - coverImagePrompt (English, detailed visual prompt)
   - coverAltText (short, SEO-friendly, 5-10 words)
   - inlineImages array with { placeholder, prompt } for each placeholder
8. categoryId must be null.
`,
  });

  if (!postData) {
    return null;
  }

  postData.title = await ensureTitleWithinLimit(postData.title, 'TR');
  if (postData.titleEN) {
    postData.titleEN = await ensureTitleWithinLimit(postData.titleEN, 'EN');
  }

  if (!normalizeWhitespace(postData.slug)) {
    postData.slug = slugifyText(postData.title);
  }
  if (postData.titleEN && !normalizeWhitespace(String(postData.slugEN || ''))) {
    postData.slugEN = slugifyText(postData.titleEN);
  }

  for (const img of postData.inlineImages || []) {
    postData.content = postData.content.replace(img.placeholder, `[IMAGE_PROMPT: ${img.prompt}]`);
    if (postData.contentEN) {
      postData.contentEN = postData.contentEN.replace(img.placeholder, `[IMAGE_PROMPT: ${img.prompt}]`);
    }
  }

  postData.content = postData.content.replace(
    /\[IMAGE_PLACEHOLDER_\d+\]/g,
    `[IMAGE_PROMPT: A relevant image for this section in the style of ${imageStyle}]`
  );
  if (postData.contentEN) {
    postData.contentEN = postData.contentEN.replace(
      /\[IMAGE_PLACEHOLDER_\d+\]/g,
      `[IMAGE_PROMPT: A relevant image for this section in the style of ${imageStyle}]`
    );
  }

  if (isBoth) {
    postData.coverImagePromptEN = postData.coverImagePrompt;
    postData.coverAltTextEN = postData.coverAltText;
  }

  postData.categoryId = null;
  return postData;
};

export const addInternalLinks = async (
  currentContent: string,
  sanityPosts: SanityPostReference[],
  language: string
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
- Keep all formatting and image placeholders exactly.
- Return only the full revised markdown.
`,
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
- Preserve markdown structure and image prompt placeholders.
- Do NOT include script tags, JSON-LD, HTML, or code fences.
- Return only revised markdown.
${internalLinksInstruction}
`,
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
  recentPostTitles: string[] = []
): Promise<{ topic: string; keywords: string }[] | null> => {
  const strategyContextInstruction = buildStrategyContextInstruction();

  const recencyRows = [...recentPosts]
    .sort((a, b) => (parseDateScore(b.publishedAt) || 0) - (parseDateScore(a.publishedAt) || 0))
    .slice(0, 10)
    .map((post) => `- [${formatDateForPrompt(post.publishedAt)}] ${post.title}`);

  const fallbackRecencyRows = recentPostTitles.slice(0, 10).map((title) => `- ${title}`);
  const recencyInstruction = [...recencyRows, ...fallbackRecencyRows].slice(0, 10).join('\n');

  const payload = await runOpenAiJson<{ items: { topic: string; keywords: string }[] }>({
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
            },
            required: ['topic', 'keywords'],
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
Language: ${language === 'TR' ? 'Turkish' : 'English'}
${strategyContextInstruction}

Already generated topics (avoid overlap):
${existingTopics.length > 0 ? existingTopics.map((topic) => `- ${topic}`).join('\n') : '- none'}

Recent topic references (if available):
${recencyInstruction || '- none'}

Return exactly 5 items:
- topic: title/topic suggestion
- keywords: 3-5 comma separated SEO keywords
`,
  });

  return Array.isArray(payload?.items) ? payload.items : null;
};
