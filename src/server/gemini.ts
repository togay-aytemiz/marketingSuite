import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiApiKey } from "./env";
import { getStrategyContextSnapshot } from "./strategy-context";
import { getSingleOutputLanguageName } from "../lib/app-language";
import { sanitizeEditorialPromptText } from "../lib/blog-draft-media";
import {
  getCoverImageHouseStyleBullets,
  getCoverImageHouseStyleText,
  getInlineImageHouseStyleBullets,
  getInlineImageHouseStyleText,
} from "../lib/editorial-cover-style";

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

export const buildPrompt = (
  images: string[],
  productName: string,
  featureName: string,
  description: string,
  headline: string,
  subheadline: string,
  cta: string,
  brandColor: string,
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
  referenceImage?: string | null
): string => {
  const outputLanguage = getSingleOutputLanguageName(language);
  const variationStyles = [
    "Clean, professional, and conversion-focused. Minimalist layout with clear hierarchy.",
    "Bold, modern, and energetic. Perfect for social media feeds. High contrast and dynamic composition.",
    "Elegant, premium, and feature-focused. Soft lighting, sophisticated typography, and a high-end feel.",
    "OUT OF THE BOX & HIGHLY CREATIVE. Break the rules. Use abstract concepts, 3D elements, or surreal compositions that still strongly drive the CTA. Make it visually striking and unforgettable."
  ];
  
  const stylePrompt = variationStyles[variationIndex % 4];

  let feedbackInstruction = "";
  if (userComment) {
    feedbackInstruction = `\n\nCRITICAL USER FEEDBACK ON PREVIOUS VERSION:\n"${userComment}"\nYou MUST incorporate this feedback into the new design while maintaining the overall quality.`;
  }

  let campaignTypeInstruction = "";
  if (campaignType.toLowerCase().includes("feature announcement")) {
    campaignTypeInstruction = "CAMPAIGN: FEATURE ANNOUNCEMENT. Focus heavily on the 'NEW' aspect. Highlight the specific new feature as the absolute center of attention. Use subtle visual cues like glowing edges, a spotlight effect, or a tasteful 'New' badge to draw the eye directly to the feature.";
  } else if (campaignType.toLowerCase().includes("product promotion")) {
    campaignTypeInstruction = "CAMPAIGN: PRODUCT PROMOTION. Grand, cinematic, and celebratory. The product should look like a highly anticipated blockbuster release. Use premium studio lighting, a strong sense of scale, and a composition that makes the product look incredibly valuable.";
  } else if (campaignType.toLowerCase().includes("update release")) {
    campaignTypeInstruction = "CAMPAIGN: UPDATE RELEASE. Show progress, speed, and improvement. Clean, iterative, and focused on the 'upgrade' feeling. You may use subtle visual metaphors for speed or enhancement (e.g., sleek motion lines or glowing success indicators).";
  } else if (campaignType.toLowerCase().includes("tutorial")) {
    campaignTypeInstruction = "CAMPAIGN: TUTORIAL. Clear, step-by-step, and highly informative. Use subtle, elegant arrows, numbered badges, or simple flow indicators. The layout must guide the user's eye logically from one step to the next without feeling cluttered.";
  } else if (campaignType.toLowerCase().includes("landing page")) {
    campaignTypeInstruction = "CAMPAIGN: LANDING PAGE HERO. Massive visual impact, ultra-clean, designed to sit at the very top of a website. The composition must leave ample room for the headline text. The Call to Action (CTA) must be the most prominent and clickable-looking element in the entire image.";
  } else if (campaignType.toLowerCase().includes("customer success")) {
    campaignTypeInstruction = "CAMPAIGN: CUSTOMER SUCCESS. Focus on results, metrics, and human impact. Include subtle elements that suggest growth, trust, and partnership (e.g., upward charts, 5-star motifs).";
  } else if (campaignType.toLowerCase().includes("event invite") || campaignType.toLowerCase().includes("webinar")) {
    campaignTypeInstruction = "CAMPAIGN: EVENT INVITE. Create anticipation and urgency. The design should feel like an exclusive ticket or a live stage preview. Highlight the date/time or 'Join us' vibe.";
  } else if (campaignType.toLowerCase().includes("special offer") || campaignType.toLowerCase().includes("discount")) {
    campaignTypeInstruction = "CAMPAIGN: SPECIAL OFFER. High conversion focus. Use visual cues for value, pricing, or limited-time urgency. Make the offer irresistible without looking cheap.";
  } else if (campaignType.toLowerCase().includes("teaser") || campaignType.toLowerCase().includes("behind the scenes")) {
    campaignTypeInstruction = "CAMPAIGN: TEASER. Mysterious, intriguing, 'coming soon' vibe. Partially obscured UI, dramatic lighting, building hype for an upcoming release.";
  } else {
    campaignTypeInstruction = `Optimize the composition for a ${campaignType}.`;
  }

  let toneInstruction = "";
  if (tone.toLowerCase().includes("professional")) {
    toneInstruction = "TONE: PROFESSIONAL. Corporate, trustworthy, and serious B2B aesthetic. Absolutely no gimmicks, no cartoons, no messy stickers, and no playful 3D emojis. Use straight lines, structured grids, and an authoritative but modern layout.";
  } else if (tone.toLowerCase().includes("playful")) {
    toneInstruction = "TONE: PLAYFUL. Fun, approachable, and friendly. Use rounded, bubbly shapes, warm and inviting colors. You may include a single, tasteful 3D mascot or soft emoji-like element, but DO NOT make it chaotic or cluttered. Keep it organized but lighthearted.";
  } else if (tone.toLowerCase().includes("minimal")) {
    toneInstruction = "TONE: MINIMAL. RUTHLESSLY REDUCTIVE. Strip away absolutely everything that is not essential. Focus purely on typography, massive amounts of negative space, and a single focal point. Zero clutter, zero unnecessary decorative elements.";
  } else if (tone.toLowerCase().includes("premium")) {
    toneInstruction = "TONE: PREMIUM. High-end luxury aesthetic. Sophisticated, expensive-looking, and exclusive. Use elegant, generous spacing, highly refined typography (consider sleek serifs or very clean sans-serifs), and subtle, high-quality textures like frosted glass or brushed dark metal.";
  } else if (tone.toLowerCase().includes("urgent")) {
    toneInstruction = "TONE: URGENT. High energy, compelling, and direct. Use bold colors (like red or orange accents) and dynamic angles to drive immediate action.";
  } else if (tone.toLowerCase().includes("empathetic")) {
    toneInstruction = "TONE: EMPATHETIC. Warm, supportive, and user-centric. Focus on solving pain points. Soft lighting, approachable visuals, and a feeling of relief.";
  } else if (tone.toLowerCase().includes("disruptive")) {
    toneInstruction = "TONE: DISRUPTIVE. Edgy, unconventional, challenging the status quo. Break the grid, use unexpected color combinations, stand out from boring corporate competitors.";
  } else if (tone.toLowerCase().includes("academic")) {
    toneInstruction = "TONE: ACADEMIC. Serious, analytical, and precise. Emphasize charts, data points, and logic. Clean, structured, and highly credible.";
  } else {
    toneInstruction = `Apply a ${tone} tone.`;
  }

  let designStyleInstruction = "";
  if (designStyle.toLowerCase().includes("apple")) {
    designStyleInstruction = "EXTREME APPLE MINIMALISM. Think Apple website. Massive amounts of white/negative space. San Francisco-style typography. Monochromatic or very subtle silver/gray/white tones. NO 3D clutter, NO floating emojis, NO chaotic background elements. A single, perfectly lit, ultra-premium focal point. Less is more. If there is UI, it must be flat, glass-like, and hyper-simplified.";
  } else if (designStyle.toLowerCase().includes("clean")) {
    designStyleInstruction = "Modern B2B SaaS aesthetic. Crisp white backgrounds, subtle drop shadows, rounded corners (border-radius: 12px). High contrast text. Very structured and grid-like. Professional and trustworthy. Zero clutter.";
  } else if (designStyle.toLowerCase().includes("gradient")) {
    designStyleInstruction = "Vibrant Web3/Stripe-inspired startup look. Smooth, glowing mesh gradients in the background. Glassmorphism UI cards floating. Bright, optimistic, and energetic, but keep the layout clean.";
  } else if (designStyle.toLowerCase().includes("dark")) {
    designStyleInstruction = "Premium dark mode aesthetic. Deep charcoal or pure black background (#000000 to #111111). Neon or glowing accent colors. Subtle inner shadows and glowing borders. High-end developer tool vibe.";
  } else if (designStyle.toLowerCase().includes("brutalism")) {
    designStyleInstruction = "NEO-BRUTALISM. Bold, high-contrast, thick black borders, flat vibrant colors (like Figma or Gumroad). Hard shadows, raw typography, unapologetic and trendy.";
  } else if (designStyle.toLowerCase().includes("glassmorphism")) {
    designStyleInstruction = "GLASSMORPHISM. Frosted glass effects, translucent panels, soft multi-colored blurred backgrounds. High-end, futuristic, and elegant UI presentation.";
  } else if (designStyle.toLowerCase().includes("cyberpunk")) {
    designStyleInstruction = "CYBERPUNK. Neon lights, dark gritty background, glowing UI elements, futuristic HUD style, high-tech hacker aesthetic.";
  } else if (designStyle.toLowerCase().includes("organic")) {
    designStyleInstruction = "ORGANIC. Warm earth tones, soft rounded shapes, natural textures, calming and human-centric design. Avoid harsh lines.";
  } else {
    designStyleInstruction = `Apply a ${designStyle} design style.`;
  }

  let modeInstruction = "";
  if (mode.toLowerCase().includes("clean screenshot")) {
    modeInstruction = "MODE: CLEAN SCREENSHOT HIGHLIGHT. ABSOLUTELY NO DEVICE MOCKUPS (no laptops, no phones, no monitors). Show the UI panels directly. The UI must look like a floating, perfectly rendered digital card. Use soft, elegant drop shadows. The background must be a clean, solid color or an extremely subtle, barely noticeable gradient. No real-world environments.";
  } else if (mode.toLowerCase().includes("device mockup")) {
    modeInstruction = "MODE: DEVICE MOCKUP. Place the UI inside a photorealistic, ultra-premium device mockup (e.g., the latest iPhone, iPad, or MacBook Pro). The device should be the absolute hero of the image. Place the device on a clean, minimal, studio-lit surface. Do not clutter the background with random objects.";
  } else if (mode.toLowerCase().includes("feature spotlight")) {
    modeInstruction = "MODE: FEATURE SPOTLIGHT. Macro photography style. Extreme close-up on one specific UI element, button, or graph. Use a strong depth of field (bokeh) effect, heavily blurring out the rest of the interface in the background. Highly detailed, crisp focus on the central feature.";
  } else if (mode.toLowerCase().includes("social media")) {
    modeInstruction = "MODE: SOCIAL MEDIA PROMO. Optimized for Instagram/LinkedIn feeds. Bold, punchy, and highly legible composition. The headline text must be large and instantly readable. Use dynamic angles or perspective to make the UI pop out of the feed. DO NOT make it messy. Keep the sticker/badge usage to an absolute minimum (max 1 or 2).";
  } else if (mode.toLowerCase().includes("ai generated")) {
    modeInstruction = "MODE: AI GENERATED BACKGROUND. Surreal, highly conceptual 3D environment. The UI or product should be seamlessly integrated into a beautiful, abstract 3D world (e.g., floating over a serene, stylized landscape, or surrounded by elegant, floating geometric shapes). The background must complement, not overpower, the UI.";
  } else if (mode.toLowerCase().includes("isometric")) {
    modeInstruction = "MODE: ISOMETRIC 3D. Present the UI or product in a 3D isometric perspective. Floating layers, exploded views, showing depth and architecture of the interface.";
  } else if (mode.toLowerCase().includes("bento")) {
    modeInstruction = "MODE: BENTO BOX. Arrange the features and UI elements in a clean, modern grid layout (like an Apple feature summary). Distinct compartments, highly organized, visually satisfying.";
  } else if (mode.toLowerCase().includes("billboard")) {
    modeInstruction = "MODE: BILLBOARD. Design this as if it's a massive physical billboard in a city. Extremely bold, minimal text, readable from a distance, high impact.";
  } else if (mode.toLowerCase().includes("magazine")) {
    modeInstruction = "MODE: MAGAZINE EDITORIAL. High-fashion or premium editorial layout. Elegant typography, asymmetrical balance, sophisticated and artistic presentation.";
  } else {
    modeInstruction = `Apply a ${mode} presentation mode.`;
  }

  let imageInstructions = "";
  if (previousImage) {
    imageInstructions = `
  MAGIC EDIT INSTRUCTIONS:
  1. You are editing the provided generated image.
  2. Maintain the overall composition, text, and style of the provided image as much as possible.
  3. Apply the user's feedback precisely.`;
  } else if (images.length > 0) {
    imageInstructions = `
  UI ENHANCEMENT & REDRAW INSTRUCTIONS:
  1. Use the provided screenshot(s) ONLY as a loose layout and content reference.
  2. REDRAW and RE-IMAGINE the UI. DO NOT just copy-paste the raw screenshot. Make it look like a Dribbble-quality, ultra-premium SaaS interface.
  3. EXTREME SIMPLIFICATION: The original screenshot has too much text and is too complex. Abstract it heavily. Remove unnecessary details, sidebars, or dense text blocks. Focus ONLY on the core feature. Use simple shapes, icons, or very short, punchy dummy text. Less reading, more visual impact. The UI should look clean and spacious.
  4. LANGUAGE ENFORCEMENT: ALL text visible inside the reimagined UI mockups MUST be in ${outputLanguage}. Translate any English text from the original screenshot into ${outputLanguage}.
  5. The primary goal is to drive clicks to the CTA button. Make the CTA prominent.
  6. MAKE IT PUNCHY: The overall visual should be striking and immediately understandable. Don't clutter the canvas. Focus on a single strong message and a beautiful, simplified UI representation.`;
  } else {
    imageInstructions = `
  VISUAL CREATION INSTRUCTIONS (NO SCREENSHOT PROVIDED):
  1. Since no screenshot is provided, you MUST CREATE a stunning, conceptual visual representation of the product and feature from scratch.
  2. Use beautiful, modern abstract shapes, 3D elements, or custom high-quality icons that perfectly represent the feature: "${featureName}".
  3. Create a clean, minimal, and highly engaging composition. It must be a "scroll-stopper" that immediately grabs attention.
  4. Use soft, premium backgrounds (e.g., smooth, subtle gradients that match the brand color or clean light/dark themes).
  5. Do NOT clutter the visual. Keep it extremely spacious, elegant, and focused on the core message.
  6. LANGUAGE ENFORCEMENT: ALL text visible inside the visual MUST be in ${outputLanguage}.
  7. The primary goal is to drive clicks to the CTA button. Make the CTA prominent.`;
  }

  let referenceInstruction = "";
  if (referenceImage) {
    referenceInstruction = `\n\nSTYLE REFERENCE IMAGE PROVIDED:\nThe user has uploaded a specific image to serve as a stylistic and layout reference. You MUST heavily analyze this reference image and mimic its overall aesthetic, layout structure, typography placement, color balance, and visual vibe. Do not copy the exact text or product from the reference, but DO copy the *feel* and *composition*.`;
  }

  let basePrompt = previousImage 
    ? `Edit the provided image based on the user's feedback.`
    : `Create a highly polished, conversion-focused marketing visual for a SaaS product.`;

  return `${basePrompt}
  
  Product Name: ${productName || 'Software'}
  Feature: ${featureName || 'New Feature'}
  Description: ${description || 'Modern software application'}
  Brand Color: ${brandColor}
  Language for ALL text (including UI elements): ${outputLanguage}
  Campaign Focus / Theme: ${campaignFocus || 'General product promotion'}
  Custom Instructions: ${customInstruction || 'None'}
  
  MANDATORY TEXT TO INCLUDE IN THE IMAGE:
  Headline: "${headline || '[Auto-generated headline]'}"
  Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
  Call to Action (CTA) Button: "${cta || '[Auto-generated CTA]'}"
  
  CRITICAL RULES FOR THIS GENERATION:
  1. CAMPAIGN TYPE (${campaignType}): ${campaignTypeInstruction}
  2. TONE (${tone}): ${toneInstruction}
  3. DESIGN STYLE (${designStyle}): ${designStyleInstruction}
  4. MODE (${mode}): ${modeInstruction}
  
  - OVERRIDING RULE: DO NOT CLUTTER THE IMAGE. The user specifically complained about generated images being too complex, messy, and having too many random icons/stickers. You MUST adhere strictly to the minimalism requested. Less is more.
  
  ${imageInstructions}
  ${referenceInstruction}
  
  7. Specific Style for this variation: ${stylePrompt}
  8. Typography: Select a maximum of 2 highly compatible fonts that perfectly match the requested Design Style, Mode, and Tone. Ensure the text is highly legible and creates a strong visual hierarchy.${feedbackInstruction}`;
};

export const generateFinalVisual = async (
  images: string[],
  productName: string,
  featureName: string,
  description: string,
  headline: string,
  subheadline: string,
  cta: string,
  brandColor: string,
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
  referenceImage?: string | null
) => {
  const ai = getAiInstance();
  if (!ai) return null;

  const parts: any[] = [];

  // If we are doing a magic edit, ONLY pass the previous image to avoid confusing the model
  if (previousImage) {
    const match = previousImage.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        }
      });
    }
  } else {
    // Otherwise, pass screenshots and reference image
    for (const img of images) {
      const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          }
        });
      }
    }

    if (referenceImage) {
      const match = referenceImage.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          }
        });
      }
    }
  }

  const prompt = buildPrompt(
    images, productName, featureName, description, headline, subheadline, cta,
    brandColor, campaignType, aspectRatio, tone, designStyle, mode, language,
    customInstruction, campaignFocus, variationIndex, previousImage, userComment, referenceImage
  );

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
