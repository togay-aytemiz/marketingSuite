import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiApiKey } from "./env";
import { getStrategyContextSnapshot } from "./strategy-context";
import { sanitizeEditorialPromptText } from "../lib/blog-draft-media";
import { resolveVisualBrandName } from "../lib/visual-brand-profile";
import {
  buildGeminiRenderPrompt,
  buildPrompt as buildSharedVisualPrompt,
} from "../lib/visual-prompt";
import {
  getCoverImageHouseStyleBullets,
  getCoverImageHouseStyleText,
  getInlineImageHouseStyleBullets,
  getInlineImageHouseStyleText,
} from "../lib/editorial-cover-style";
import {
  buildVisualReferenceParts,
  loadVisualBrandReferenceImages,
} from "./visual-image-parts";

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

const RELEVANCE_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "but",
  "for",
  "from",
  "into",
  "its",
  "that",
  "the",
  "their",
  "there",
  "this",
  "with",
  "your",
  "blog",
  "post",
  "guide",
  "tips",
  "update",
  "news",
  "best",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "ve",
  "ile",
  "icin",
  "için",
  "gibi",
  "daha",
  "nasil",
  "nasil",
  "blog",
  "yazi",
  "yazı",
  "rehber",
]);
const OFFICIAL_QUALY_SITE_URL = 'https://www.askqualy.com';
const QUALY_SITE_GUARDRAILS = `
OFFICIAL QUALY WEBSITE RULES:
- The official Qualy website is ${OFFICIAL_QUALY_SITE_URL}.
- Never invent, guess, or substitute another Qualy domain (for example: qualy.ai).
- When the article references the product website or homepage, use ${OFFICIAL_QUALY_SITE_URL}.
- For internal blog links, keep site-relative links like /blog/slug or /en/blog/slug unless the user explicitly asks for absolute URLs.
`;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripImageSeedPrefix(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^editorial photo:\s*/i, "")
      .replace(/^explainer card:\s*/i, "")
  );
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

function tokenizeForRelevance(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !RELEVANCE_STOP_WORDS.has(token));
}

function dedupePostsBySlug(posts: SanityPostReference[]) {
  const bySlug = new Map<string, SanityPostReference>();

  for (const post of posts) {
    const slug = normalizeWhitespace(post.slug || "");
    const title = normalizeWhitespace(post.title || "");
    if (!slug || !title) {
      continue;
    }

    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, { ...post, slug, title });
      continue;
    }

    const existingDate = parseDateScore(existing.publishedAt);
    const incomingDate = parseDateScore(post.publishedAt);

    if (incomingDate !== null && (existingDate === null || incomingDate > existingDate)) {
      bySlug.set(slug, { ...post, slug, title });
    }
  }

  return Array.from(bySlug.values());
}

export function selectRelevantSanityPosts(
  posts: SanityPostReference[],
  seedText: string,
  maxItems = 12
): SanityPostReference[] {
  const dedupedPosts = dedupePostsBySlug(posts);
  if (dedupedPosts.length === 0) {
    return [];
  }

  const seedTokens = new Set(tokenizeForRelevance(seedText));
  const timestamps = dedupedPosts
    .map((post) => parseDateScore(post.publishedAt))
    .filter((value): value is number => value !== null);
  const minTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

  const scored = dedupedPosts.map((post) => {
    const searchable = `${post.title} ${post.excerpt || ""} ${post.category || ""}`;
    const postTokens = new Set(tokenizeForRelevance(searchable));
    let overlapScore = 0;

    for (const token of seedTokens) {
      if (postTokens.has(token)) {
        overlapScore += 1;
      }
    }

    const postDate = parseDateScore(post.publishedAt);
    let recencyBonus = 0;
    if (postDate !== null && minTimestamp !== null && maxTimestamp !== null && maxTimestamp !== minTimestamp) {
      recencyBonus = ((postDate - minTimestamp) / (maxTimestamp - minTimestamp)) * 2;
    }

    const finalScore = overlapScore * 3 + recencyBonus;

    return {
      post,
      finalScore,
      postDate: postDate || 0,
    };
  });

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }

    if (b.postDate !== a.postDate) {
      return b.postDate - a.postDate;
    }

    return a.post.title.localeCompare(b.post.title);
  });

  return scored.slice(0, maxItems).map((item) => item.post);
}

function formatDateForPrompt(value?: string) {
  if (!value) {
    return "unknown-date";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "unknown-date";
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildRecentPostsInstruction(recentPosts: RecentTopicReference[], fallbackTitles: string[], maxItems = 12) {
  const enriched = recentPosts
    .map((post) => ({
      title: normalizeWhitespace(post.title || ""),
      excerpt: normalizeWhitespace(post.excerpt || ""),
      category: normalizeWhitespace(post.category || ""),
      publishedAt: post.publishedAt,
      scoreDate: parseDateScore(post.publishedAt) || 0,
    }))
    .filter((post) => post.title);

  const deduped = new Map<string, (typeof enriched)[number]>();
  for (const post of enriched) {
    const existing = deduped.get(post.title.toLowerCase());
    if (!existing || post.scoreDate > existing.scoreDate) {
      deduped.set(post.title.toLowerCase(), post);
    }
  }

  const normalizedTitles = fallbackTitles
    .map((title) => normalizeWhitespace(title))
    .filter(Boolean)
    .map((title) => ({
      title,
      excerpt: "",
      category: "",
      publishedAt: undefined,
      scoreDate: 0,
    }));

  for (const titlePost of normalizedTitles) {
    if (!deduped.has(titlePost.title.toLowerCase())) {
      deduped.set(titlePost.title.toLowerCase(), titlePost);
    }
  }

  const sorted = Array.from(deduped.values())
    .sort((a, b) => b.scoreDate - a.scoreDate)
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return "";
  }

  const lines = sorted.map((post) => {
    const bits = [`[${formatDateForPrompt(post.publishedAt)}] ${post.title}`];
    if (post.category) {
      bits.push(`category: ${post.category}`);
    }
    if (post.excerpt) {
      bits.push(`summary: ${post.excerpt.slice(0, 140)}`);
    }
    return `- ${bits.join(" | ")}`;
  });

  return `
RECENT SANITY BLOG TOPICS (latest first):
${lines.join("\n")}

IMPORTANT: Suggest adjacent or next-step angles that are clearly different from the recent topics above.
`;
}

function buildStrategyContextInstruction() {
  const context = getStrategyContextSnapshot();
  if (!context.available || !context.promptText) {
    return "";
  }

  return `
PRODUCT STRATEGY CONTEXT (from PRD/ROADMAP docs):
${context.promptText}

IMPORTANT: Align suggestions/content with this strategy context and current shipped capabilities.
`;
}

function buildInternalLinksInstruction(posts: SanityPostReference[]) {
  if (posts.length === 0) {
    return "";
  }

  const lines = posts.map((post) => `- Title: "${post.title}", URL: "/blog/${post.slug}"`).join("\n");

  return `
9. Internal Linking: You MUST naturally integrate 1-3 internal links to the following available blog posts. Use markdown link syntax: [anchor text](/blog/slug-of-the-post). Do NOT force links, only add them if the context is highly relevant.
Available Internal Blog Posts:
${lines}
`;
}

export function getAiInstance() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

export function buildEditorialBlogImagePrompt(prompt: string, isCover: boolean = false) {
  const rawPrompt = normalizeWhitespace(prompt || "Professional B2B SaaS editorial visual");
  const explicitExplainer = /^explainer card:\s*/i.test(rawPrompt);
  const explicitEditorialPhoto = /^editorial photo:\s*/i.test(rawPrompt);
  const normalizedPrompt = sanitizeEditorialPromptText(
    stripImageSeedPrefix(rawPrompt) || "Professional B2B SaaS editorial visual"
  );
  const shotDirection = isCover
    ? "Create a refined editorial hero image with strong composition for a blog cover."
    : "Create an elegant inline editorial image that supports one section without overwhelming the article.";

  const compositionDirection = isCover
    ? "Use one dominant focal subject with subtle supporting forms, generous breathing room, and premium art direction."
    : "Use a single focal subject, negative space, and a restrained supporting composition.";

  const materialDirection = isCover
    ? "Use subtle glassmorphism, frosted translucent materials, and soft studio lighting."
    : explicitExplainer
      ? "Create a clean simplified explainer card with restrained blue accents, sparse iconography, quiet depth, and a brandless editorial finish."
      : "Prefer realistic editorial photography, believable professional environments, and calm natural lighting.";

  const densityDirection = isCover
    ? "Limit the scene to one hero object and at most 1-2 small supporting glass icons or cards. Avoid dense icon fields, busy overlays, neon chaos, brand logos, and recognizable platform marks."
    : "Keep supporting details sparse and avoid noisy icon clusters, glossy 3D fantasy scenes, holographic interfaces, and infographic density.";

  const houseStyleDirection = isCover
    ? getCoverImageHouseStyleText()
    : getInlineImageHouseStyleText();

  const peopleDirection = isCover
    ? "No people."
    : explicitExplainer
      ? "No people."
      : "Default to no people unless the section truly needs a believable professional or customer scene.";

  const subjectDirection = isCover
    ? `The hero subject must clearly express this idea: ${normalizedPrompt}. Avoid empty generic glass tiles or meaningless abstract shapes. Use one brandless business metaphor or signal object that makes the topic legible at a glance.`
    : explicitExplainer
      ? `Turn this concept into a concise brandless explainer visual: ${normalizedPrompt}. Show 2-4 simple objects or modules only, with no text labels.`
      : `Show this scene as believable publication-grade business photography: ${normalizedPrompt}. Use a real environment and natural physical details, not a fantasy tech scene.`;

  const realismDirection = isCover
    ? "Keep the visual premium, minimal, and enterprise-ready."
    : explicitEditorialPhoto || !explicitExplainer
      ? "Keep the result realistic, editorial, and professionally art-directed."
      : "Keep the result minimal, diagrammatic, and visually calm.";

  return `${normalizedPrompt}. ${shotDirection} ${compositionDirection} ${materialDirection} ${densityDirection} ${houseStyleDirection} ${peopleDirection} ${realismDirection} ${subjectDirection} Use a controlled palette, balanced depth, generous negative space, and publication-grade realism. Absolutely no visible text, no text, no words, no letters, no numbers, no labels, no logos, no watermarks, and no brand marks. Do not render official app logos, social platform glyphs, messaging app icons, or branded interface chrome. Do not show Instagram, WhatsApp, Facebook, Messenger, or other recognizable platform branding. No screenshots, no UI mockups, no dashboard panels, no speech-bubble overlays, and no interface overlays. Avoid cartoon characters, childish illustration, playful mascots, emoji-like icons, toy-like 3D objects, noisy infographic layouts, collage scenes, stock-photo clichés, and cluttered compositions.`;
}

function parseGeneratedImageDataUrl(imageDataUrl: string) {
  const match = String(imageDataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

async function reviewGeneratedBlogImage(imageDataUrl: string, isCover: boolean) {
  const ai = getAiInstance();
  if (!ai) {
    return null;
  }

  const parsed = parseGeneratedImageDataUrl(imageDataUrl);
  if (!parsed) {
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: parsed.data, mimeType: parsed.mimeType } },
          {
            text: `Review this generated ${isCover ? 'cover' : 'inline'} blog image for a professional B2B SaaS editorial article.

Acceptable only if ALL of these are true:
- no visible text, letters, numbers, labels, logos, or watermarks
- no recognizable platform logos, social app marks, or messaging brand icons
- no screenshot, no UI mockup, no dashboard panel
- elegant, minimal, editorial, and professional
- not cluttered, not noisy, not infographic-like
- not childish, cartoonish, or toy-like
- for cover images: one dominant subject with at most 1-2 small supporting accents, not a crowded scene
- for cover images: dark graphite or deep navy base, cobalt-indigo glow, frosted glass tile/panel language, and no people
- for inline images: either realistic editorial photography or a clean simplified explainer card, never a childish or fantastical 3D scene

Return JSON only. Set "acceptable" to false if any rule is violated.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            acceptable: { type: Type.BOOLEAN },
            issues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["acceptable", "issues"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return null;
    }

    return JSON.parse(text) as { acceptable: boolean; issues: string[] };
  } catch (error) {
    console.error("Error reviewing generated blog image:", error);
    return null;
  }
}

export async function enhanceProductDetails(
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string
) {
  const ai = getAiInstance();
  if (!ai) return null;

  const prompt = `
    You are an expert SaaS marketing professional.
    Your task is to enhance the provided product description to make it more compelling, clear, and benefit-driven.
    This information will be used later to generate high-converting marketing copy and visuals.

    Context:
    Product Name: ${productName || 'Not provided'}
    Feature Name: ${featureName || 'Not provided'}
    Target Audience: ${targetAudience || 'Not provided'}
    
    Current Description to Enhance:
    ${description || 'Not provided'}

    Guidelines:
    - Improve the description to focus on user benefits and value proposition. Make it punchy and professional.
    - Do not include any meta-commentary, just return the enhanced description text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const text = response.text;
    if (text) {
      return text.trim();
    }
  } catch (error) {
    console.error("Error enhancing product details:", error);
  }
  
  return null;
}

export async function generateMarketingCopy(
  productName: string,
  featureName: string,
  description: string,
  campaignType: string,
  tone: string,
  language: string
) {
  const ai = getAiInstance();
  if (!ai) return null;
  
  const focus = featureName 
    ? `the feature "${featureName}" of the product "${productName || 'Our Product'}"` 
    : `the core product "${productName || 'Our Product'}"`;

  const prompt = `
    You are an expert SaaS marketing copywriter.
    Generate a headline, subheadline, and CTA for a marketing visual.
    
    Focus: We are promoting ${focus}.
    Description: ${description || 'A powerful software solution.'}
    Campaign Type: ${campaignType}
    Tone: ${tone}
    Language: ${language === 'TR' ? 'Turkish' : 'English'}
    
    Guidelines:
    - Write the copy in ${language === 'TR' ? 'Turkish' : 'English'}.
    - Tone should be ${tone}, clean, modern, product-focused, startup-style.
    - Avoid generic buzzwords.
    - Headline: Short, punchy, attention-grabbing (max 8 words).
    - Subheadline: Explains the value clearly (max 15 words).
    - CTA: Action-oriented, short (max 4 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: {
              type: Type.STRING,
              description: "The main headline for the visual.",
            },
            subheadline: {
              type: Type.STRING,
              description: "The supporting subheadline.",
            },
            cta: {
              type: Type.STRING,
              description: "The Call to Action text.",
            },
          },
          required: ["headline", "subheadline", "cta"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Error generating copy:", error);
  }
  
  return null;
}

export async function generateCopyIdeas(
  productName: string,
  featureName: string,
  description: string,
  campaignType: string,
  tone: string,
  language: string
) {
  const ai = getAiInstance();
  if (!ai) return null;
  
  const prompt = `Generate 3 different marketing copy ideas for a SaaS product visual.
  Product Name: ${productName || 'Software'}
  Feature: ${featureName || 'New Feature'}
  Description: ${description || 'Modern software application'}
  Campaign Type: ${campaignType}
  Tone: ${tone}
  Language: ${language === 'TR' ? 'Turkish' : 'English'}
  
  Return a JSON object with 3 arrays: 'headlines', 'subheadlines', and 'ctas'. Each array must contain exactly 3 strings. Keep them punchy and conversion-focused.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headlines: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 headline ideas",
            },
            subheadlines: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 subheadline ideas",
            },
            ctas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 CTA ideas",
            },
          },
          required: ["headlines", "subheadlines", "ctas"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Error generating copy ideas:", error);
  }
  
  return null;
}

export async function extractColorPalette(imageBase64: string): Promise<string[]> {
  const ai = getAiInstance();
  if (!ai) return [];
  
  // Extract base64 data and mime type
  const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) return [];
  
  const mimeType = match[1];
  const data = match[2];

  const prompt = "Analyze this UI screenshot and extract the 4 most prominent and harmonious colors to form a brand color palette. Return ONLY a JSON array of 4 hex color codes (e.g., [\"#FFFFFF\", \"#000000\", \"#FF0000\", \"#00FF00\"]). Do not include markdown formatting.";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (text) {
      const colors = JSON.parse(text);
      if (Array.isArray(colors) && colors.length > 0) {
        return colors;
      }
    }
  } catch (error) {
    console.error("Error extracting color palette:", error);
  }
  
  return [];
}

export const buildPrompt = buildSharedVisualPrompt;

export const generateFinalVisual = async (
  images: string[],
  productName: string,
  featureName: string,
  description: string,
  headline: string,
  subheadline: string,
  cta: string,
  brandColor: string,
  platform: string,
  campaignType: string,
  aspectRatio: string,
  tone: string,
  designStyle: string,
  mode: string,
  language: string,
  customInstruction: string,
  campaignFocus: string,
  variationIndex: number = 0,
  previousImage?: string,
  userComment?: string,
  referenceImage?: string | null,
  plannedPrompt?: string | null
) => {
  const ai = getAiInstance();
  if (!ai) return null;

  const brandName = resolveVisualBrandName(productName);
  const brandReferenceImages = previousImage ? [] : await loadVisualBrandReferenceImages();
  const parts: any[] = buildVisualReferenceParts({
    images,
    previousImage,
    referenceImage,
    brandReferenceImages,
  });

  const prompt = buildGeminiRenderPrompt({
    plannedPrompt: String(plannedPrompt || '').trim()
      || `Quiet Signal editorial poster for ${featureName || brandName || 'the product'}.`,
    headline,
    subheadline,
    cta,
    language,
    images,
    featureName,
    brandName,
    hasBrandReferences: brandReferenceImages.length > 0,
    campaignType,
    campaignFocus,
    customInstruction,
    previousImage,
    userComment,
    referenceImage,
  });

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error(`Error generating final visual ${variationIndex}:`, e);
  }
  return null;
}

export const analyzeSeoForBlog = async (
  title: string,
  description: string,
  content: string,
  keywords: string
) => {
  const ai = getAiInstance();
  if (!ai) return null;

  const prompt = `
    You are an expert SEO analyst. Analyze the following blog post.
    Target/Additional Keywords provided by user: ${keywords || 'None'}
    
    Identify the top 4-6 SEO keywords actually used in the text (including title and description). Count their exact occurrences.
    Evaluate the overall SEO strength out of 100.
    Provide 2-3 short, actionable suggestions to improve the SEO. Do not suggest adding a meta description or title if they are already present.

    Blog Title: ${title}
    Meta Description: ${description}
    
    Blog Content:
    ${content}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "SEO score out of 100" },
            keywords: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  count: { type: Type.NUMBER }
                },
              }
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (e) {
    console.error("Error analyzing SEO:", e);
  }
  return null;
};

export interface BlogPostResponse {
  title: string;
  description: string;
  slug: string;
  coverImagePrompt: string;
  coverAltText: string;
  categoryId: string | null;
  content: string;
  // EN fields for BOTH option
  titleEN?: string;
  descriptionEN?: string;
  slugEN?: string;
  coverImagePromptEN?: string;
  coverAltTextEN?: string;
  contentEN?: string;
}

// Deprecated legacy path. OpenAI owns blog planning/writing; Gemini is used for image generation.
const generateBlogPostLegacyDeprecated = async (
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
  sanityPosts?: SanityPostReference[],
  sanityCategories?: { id: string; name: string }[]
): Promise<BlogPostResponse | null> => {
  const ai = getAiInstance();
  if (!ai) return null;

  const isBoth = language === 'BOTH';
  const targetLang = isBoth ? 'Turkish (Primary) and English (Secondary)' : (language === 'TR' ? 'Turkish' : 'English');
  const strategyContextInstruction = buildStrategyContextInstruction();

  const recentTopicRows = (sanityPosts || [])
    .filter((post) => normalizeWhitespace(post.title || '') && normalizeWhitespace(post.slug || ''))
    .sort((a, b) => {
      const bDate = parseDateScore(b.publishedAt) || 0;
      const aDate = parseDateScore(a.publishedAt) || 0;
      return bDate - aDate;
    })
    .slice(0, 12)
    .map((post) => `- [${formatDateForPrompt(post.publishedAt)}] ${post.title}`);

  const recentTopicsInstruction = recentTopicRows.length > 0
    ? `
LATEST SANITY BLOG TOPICS (avoid repeating the same angle):
${recentTopicRows.join('\n')}
`
    : '';

  let internalLinksInstruction = '';
  if (sanityPosts && sanityPosts.length > 0) {
    const rankedPosts = selectRelevantSanityPosts(
      sanityPosts,
      `${topic} ${keywords} ${featureName} ${targetAudience} ${description}`,
      14
    );
    internalLinksInstruction = buildInternalLinksInstruction(rankedPosts);
  }

  let categoriesInstruction = '';
  if (sanityCategories && sanityCategories.length > 0) {
    const catsList = sanityCategories.map(c => `- ID: ${c.id}, Name: "${c.name}"`).join('\n');
    categoriesInstruction = `
10. Categorization: You MUST select the most appropriate category ID from the list below based on the blog content. Do NOT invent new categories. If none fit perfectly, pick the closest one.
Available Categories:
${catsList}
`;
  }

  const prompt1 = `You are an expert SEO copywriter and content marketer. Write a highly engaging, professional blog post based on the following context.

PRODUCT CONTEXT:
Product Name: ${productName || 'Our Product'}
Feature/Focus Area: ${featureName || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Product Description: ${description || 'A modern software solution.'}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}
${recentTopicsInstruction}

BLOG POST REQUIREMENTS:
Topic/Instruction: ${topic || 'The user did not provide a specific topic. Please invent a highly relevant and engaging topic based on the Product Context.'}
Additional Keywords: ${keywords || 'None provided. Please extract 3-5 highly relevant SEO keywords based on the Product Context and organically integrate them.'}
Tone of Voice: ${tone}
Target Length: ${length}
Language: ${targetLang}
${language === 'TR' ? 'CRITICAL: You MUST use ONLY Turkish terminology in the content, title, and description. Do NOT use English marketing jargon like "lead", "lead scoring", "conversion", "engagement", etc. Use their exact Turkish equivalents (e.g., "Müşteri Adayı", "Müşteri Adayı Puanlama", "Dönüşüm", "Etkileşim").' : ''}

INSTRUCTIONS:
1. ${isBoth ? "CRITICAL: You MUST generate the blog post in BOTH Turkish and English. Return a JSON object containing both the Turkish and English metadata and content." : "You must return a JSON object containing the blog metadata and the full markdown content."}
   TITLE LENGTH RULE: Every returned title field (title and titleEN when present) MUST be at most 70 characters.
2. "title": Write a compelling, click-worthy H1 title that is highly SEO-optimized. CRITICAL: it MUST be at most 70 characters. If your first draft exceeds 70, rewrite it before returning JSON.
3. "description": Write an SEO meta description. CRITICAL: It MUST be a maximum of 160 characters (ideally around 150) to improve SERP click-through rates.
4. "slug": Generate a URL-friendly slug based on the title (e.g., "how-to-use-feature-x").
5. "content": Write the full blog post in proper markdown format. Use H2 and H3 for subheadings. Use bullet points for lists. Add double line breaks between paragraphs. Naturally integrate the target/extracted keywords throughout the text.
6. Quotes & External Links: Occasionally (but not excessively), include 1-2 external links to authoritative industry sources (e.g., Gartner, Forrester, or well-known industry blogs) to back up statistics or claims. You can format these as markdown links or blockquotes (>) for important quotes or key takeaways to enhance credibility and SEO. Format blockquotes exactly like this:
   > "This is a profound quote."
   > - Author Name
7. FAQ Section: At the very end of the content, add a "Frequently Asked Questions" (or its Turkish equivalent if the language is Turkish) section formatted with an H2. Include 3-4 relevant questions and concise answers that naturally incorporate the SEO keywords.
   CRITICAL: Do NOT include script tags, JSON-LD, HTML, or code blocks in the article body.
8. Image Placeholders: Inside the "content" markdown, whenever an image would be beneficial to illustrate a point, insert a placeholder on a new line using EXACTLY this format: [IMAGE_PLACEHOLDER_X] (where X is an incrementing number starting from 1). Do NOT write the actual image prompt yet.
Structure: Hook/Introduction, Main Body (with clear subheadings), Conclusion with a Call to Action (CTA), and finally the FAQ Section.
${internalLinksInstruction}
${categoriesInstruction}
`;

  const baseProperties1 = {
    title: { type: Type.STRING, description: "The SEO-optimized H1 title of the blog post." },
    description: { type: Type.STRING, description: "The SEO meta description. MUST be max 160 characters." },
    slug: { type: Type.STRING, description: "URL-friendly slug (e.g., my-blog-post)." },
    categoryId: { type: Type.STRING, description: "The ID of the selected category, or null if no categories were provided.", nullable: true },
    content: { type: Type.STRING, description: "The full markdown content of the blog post." }
  };

  const responseSchema1 = isBoth ? {
    type: Type.OBJECT,
    properties: {
      ...baseProperties1,
      titleEN: { type: Type.STRING, description: "The SEO-optimized H1 title of the blog post in English." },
      descriptionEN: { type: Type.STRING, description: "The SEO meta description in English. MUST be max 160 characters." },
      slugEN: { type: Type.STRING, description: "URL-friendly slug in English." },
      contentEN: { type: Type.STRING, description: "The full markdown content of the blog post in English." }
    },
    required: ["title", "description", "slug", "content", "titleEN", "descriptionEN", "slugEN", "contentEN"]
  } : {
    type: Type.OBJECT,
    properties: baseProperties1,
    required: ["title", "description", "slug", "content"]
  };

  let postData: any = null;
  try {
    const response1 = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt1,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: responseSchema1
      }
    });

    const text1 = response1.text;
    if (text1) {
      postData = JSON.parse(text1);
    }
  } catch (e) {
    console.error("Error generating blog post content:", e);
    return null;
  }

  if (!postData) return null;

  const prompt2 = `You are an expert AI image prompt engineer. I have generated a blog post. I need you to create a cover image prompt, cover alt text, and specific image prompts for each placeholder in the content.

BLOG TITLE: ${postData.title}
BLOG DESCRIPTION: ${postData.description}
BLOG CONTENT:
${postData.content}

INSTRUCTIONS:
1. "coverImagePrompt": Write a highly detailed, descriptive image generation prompt in English for the blog's main cover image. CRITICAL: The image MUST visually represent the "title" and "description" without using literal app logos or brand marks. IMPORTANT: Every cover image MUST follow this exact house style and stay in the same visual family:
${getCoverImageHouseStyleBullets()}
Do not show text, screenshots, UI mockups, dashboard panels, speech bubbles, or recognizable platform logos.
2. "coverAltText": Write a concise, SEO-optimized alt text for the cover image in the target language (${isBoth ? 'Turkish' : targetLang}). CRITICAL: Keep it very short, maximum 5-10 words. Do not write full sentences or long descriptions.
3. "inlineImages": For each [IMAGE_PLACEHOLDER_X] found in the content, write a highly detailed, descriptive image generation prompt in English. Prefer realistic editorial photography for industry, people, customer, or workflow sections. Use a clean simplified explainer card only for framework, requirements, or comparison sections. IMPORTANT: Inline images must follow this house style:
${getInlineImageHouseStyleBullets()}
The prompt MUST also respect this user-requested direction: "${imageStyle}". Do not show screenshots or UI mockups directly.

Return a JSON object with "coverImagePrompt", "coverAltText", and an array "inlineImages" containing objects with "placeholder" (e.g., "[IMAGE_PLACEHOLDER_1]") and "prompt".
`;

  try {
    const response2 = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt2,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coverImagePrompt: { type: Type.STRING },
            coverAltText: { type: Type.STRING },
            inlineImages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  placeholder: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                }
              }
            }
          },
          required: ["coverImagePrompt", "coverAltText", "inlineImages"]
        }
      }
    });

    const text2 = response2.text;
    if (text2) {
      const promptsData = JSON.parse(text2);
      
      postData.coverImagePrompt = promptsData.coverImagePrompt;
      postData.coverAltText = promptsData.coverAltText;
      
      if (promptsData.inlineImages && Array.isArray(promptsData.inlineImages)) {
        for (const img of promptsData.inlineImages) {
          postData.content = postData.content.replace(img.placeholder, `[IMAGE_PROMPT: ${img.prompt}]`);
          if (isBoth && postData.contentEN) {
            postData.contentEN = postData.contentEN.replace(img.placeholder, `[IMAGE_PROMPT: ${img.prompt}]`);
          }
        }
      }
      
      postData.content = postData.content.replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, `[IMAGE_PROMPT: A relevant image for this section in the style of ${imageStyle}]`);
      if (isBoth && postData.contentEN) {
        postData.contentEN = postData.contentEN.replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, `[IMAGE_PROMPT: A relevant image for this section in the style of ${imageStyle}]`);
      }

      if (isBoth) {
        postData.coverImagePromptEN = promptsData.coverImagePrompt;
        postData.coverAltTextEN = promptsData.coverAltText;
      }

      return postData as BlogPostResponse;
    }
  } catch (e) {
    console.error("Error generating blog image prompts:", e);
  }

  postData.coverImagePrompt = "A modern SaaS illustration";
  postData.coverAltText = "Blog cover image";
  if (isBoth) {
    postData.coverImagePromptEN = "A modern SaaS illustration";
    postData.coverAltTextEN = "Blog cover image";
  }
  return postData as BlogPostResponse;
};

export const generateBlogImage = async (prompt: string, isCover: boolean = false): Promise<string | null> => {
  const ai = getAiInstance();
  if (!ai) return null;
  const basePrompt = buildEditorialBlogImagePrompt(prompt, isCover);
  let attemptPrompt = basePrompt;
  let lastImageDataUrl: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: attemptPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (!part.inlineData) {
          continue;
        }

        lastImageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        const review = await reviewGeneratedBlogImage(lastImageDataUrl, isCover);
        if (!review || review.acceptable) {
          return lastImageDataUrl;
        }

        attemptPrompt = `${basePrompt} CRITICAL CORRECTION FOR NEXT ATTEMPT: ${review.issues.join('; ')}. Remove any text-like marks or symbols entirely. Simplify the composition further. Use fewer elements, more negative space, and a calmer enterprise editorial aesthetic.`;
      }
    } catch (error) {
      console.error("Error generating blog image:", error);
    }
  }

  return lastImageDataUrl;
};

export const addInternalLinks = async (
  currentContent: string,
  sanityPosts: SanityPostReference[],
  language: string
): Promise<string | null> => {
  const ai = getAiInstance();
  if (!ai) return null;

  const strategyContextInstruction = buildStrategyContextInstruction();
  const selectedPosts = selectRelevantSanityPosts(sanityPosts, currentContent, 16);
  if (selectedPosts.length === 0) {
    return currentContent;
  }

  const postsList = selectedPosts.map((p) => `- Title: "${p.title}", URL: "/blog/${p.slug}"`).join('\n');

  const prompt = `
You are an expert SEO content editor. Your task is to naturally integrate internal links into the following blog post.

Language: ${language === 'TR' ? 'Turkish' : 'English'}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}

Available Internal Blog Posts:
${postsList}

Current Blog Post:
${currentContent}

INSTRUCTIONS:
1. Review the "Current Blog Post" and the "Available Internal Blog Posts".
2. Find natural opportunities within the text to link to the available internal posts.
3. Use markdown link syntax: [anchor text](/blog/slug-of-the-post).
4. Do NOT force links. Only add a link if the context is highly relevant.
5. Try to add 1-3 internal links if possible.
6. Return the FULL revised markdown content, keeping all existing formatting, headings, and image placeholders exactly as they are.
7. Do not include any meta-commentary.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.4,
      }
    });

    return response.text || null;
  } catch (e) {
    console.error("Error adding internal links:", e);
    return null;
  }
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
  const ai = getAiInstance();
  if (!ai) return null;
  const strategyContextInstruction = buildStrategyContextInstruction();

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
8. Internal Linking: If your edits involve adding new sections or rewriting, try to naturally integrate internal links to the following available blog posts. Use markdown link syntax: [anchor text](/blog/slug-of-the-post).
Available Internal Blog Posts:
${postsList}
`;
    }
  }

  const prompt = `You are an expert SEO copywriter and editor. Your task is to revise an existing blog post based on the user's specific instructions.

PRODUCT CONTEXT:
Product Name: ${productName || 'Our Product'}
Feature/Focus Area: ${featureName || 'General'}
Target Audience: ${targetAudience || 'General audience'}
Product Description: ${description || 'A modern software solution.'}
Language: ${language === 'TR' ? 'Turkish' : 'English'}
${QUALY_SITE_GUARDRAILS}
${strategyContextInstruction}

CURRENT BLOG POST:
"""
${currentContent}
"""

USER'S EDIT INSTRUCTION (COMMENT):
"${instruction}"

INSTRUCTIONS FOR REVISION:
1. First, analyze the CURRENT BLOG POST.
2. Then, analyze the USER'S EDIT INSTRUCTION.
3. ONLY apply the changes requested by the user. Do NOT rewrite the entire article from scratch. Keep the rest of the article exactly as it is in the CURRENT BLOG POST.
4. Maintain the overall SEO structure (Meta Title, Meta Description) unless instructed otherwise.
5. Keep the exact image placeholder format: [IMAGE_PROMPT: Write a highly detailed, descriptive image generation prompt here in English]
   IMPORTANT: The image prompt MUST specify NOT to show software interfaces, UI mockups, or screenshots directly. It is acceptable to show people working on physical computers or screens, but the screen content itself should not be the focus. Focus on the people, the conceptual UI, or abstract representations.
6. Ensure proper markdown formatting (H2, H3, bullet points) with double line breaks between paragraphs.
7. Ensure any existing FAQ section or external links/quotes are preserved unless the user explicitly asks to remove them.
8. Do NOT include script tags, JSON-LD snippets, HTML blocks, or code fences in the final article body.
9. Return ONLY the revised markdown content, with no meta-commentary.
${internalLinksInstruction}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || null;
  } catch (e) {
    console.error("Error editing blog post:", e);
    return null;
  }
};

export const generateSocialPosts = async (
  blogContent: string,
  language: string
): Promise<{ twitter: string; linkedin: string } | null> => {
  const ai = getAiInstance();
  if (!ai) return null;

  const prompt = `You are an expert social media manager. I have just written a new blog post. 
Please generate two highly engaging, click-worthy social media promotional posts for it.

BLOG POST CONTENT:
"""
${blogContent.substring(0, 3000)}...
"""

LANGUAGE: ${language === 'TR' ? 'Turkish' : 'English'}

INSTRUCTIONS:
1. Generate one Twitter (X) post. It should be punchy, use 1-2 relevant emojis, include 2-3 hashtags, and end with a call-to-action to read the blog post (e.g., "Read the full post here: [LINK]"). Keep it under 280 characters.
2. Generate one LinkedIn post. It should be more professional but still engaging. Use a hook, summarize the main value proposition in 2-3 bullet points, use appropriate emojis, and end with a call-to-action to read the article. Include 3-5 hashtags.
3. Return the result strictly as a JSON object with "twitter" and "linkedin" keys. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            twitter: { type: Type.STRING },
            linkedin: { type: Type.STRING }
          },
          required: ["twitter", "linkedin"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (e) {
    console.error("Error generating social posts:", e);
  }
  return null;
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
  const ai = getAiInstance();
  if (!ai) return null;
  const strategyContextInstruction = buildStrategyContextInstruction();
  const recentPostsInstruction = buildRecentPostsInstruction(recentPosts, recentPostTitles, 15);

  const existingTopicsInstruction = [
    existingTopics.length > 0
      ? `ALSO IMPORTANT: Do NOT suggest topics that are too similar to these already generated ideas:\n${existingTopics.map((topic) => `- ${topic}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const prompt = `
    You are an expert content strategist. Based on the following product context, generate 5 highly engaging blog post topics.
    For each topic, provide 3-5 highly relevant SEO keywords.

    Product Name: ${productName || 'Not provided'}
    Feature Name: ${featureName || 'Not provided'}
    Target Audience: ${targetAudience || 'Not provided'}
    Description: ${description || 'Not provided'}
    Language: ${language === 'TR' ? 'Turkish' : 'English'}
    ${strategyContextInstruction}
    ${recentPostsInstruction}
    ${existingTopicsInstruction}

    ${language === 'TR' ? 'CRITICAL: You MUST use ONLY Turkish terminology. Do NOT use English marketing jargon like "lead", "lead scoring", "conversion", "engagement", etc. Use their exact Turkish equivalents (e.g., "Müşteri Adayı", "Müşteri Adayı Puanlama", "Dönüşüm", "Etkileşim").' : ''}

    Return a JSON array of objects, where each object has:
    - "topic": The blog post title/topic (in ${language === 'TR' ? 'Turkish' : 'English'})
    - "keywords": A comma-separated string of 3-5 SEO keywords (in ${language === 'TR' ? 'Turkish' : 'English'})
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              keywords: { type: Type.STRING }
            },
            required: ["topic", "keywords"]
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Error generating topics:", error);
  }

  return null;
};
