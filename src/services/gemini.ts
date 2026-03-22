import { buildPrompt } from '../lib/visual-prompt';
import type { BlogInlineImagePlan } from '../lib/blog-image-slots';
import type { ResolvedBlogCategory } from '../types';

export { buildPrompt };

export interface BlogPostResponse {
  title: string;
  description: string;
  slug: string;
  coverImagePrompt: string;
  coverAltText: string;
  categoryId: string | null;
  category?: ResolvedBlogCategory | null;
  content: string;
  inlineImages: BlogInlineImagePlan[];
  titleEN?: string;
  descriptionEN?: string;
  slugEN?: string;
  coverImagePromptEN?: string;
  coverAltTextEN?: string;
  contentEN?: string;
}

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

export interface TopicIdeaSuggestion {
  topic: string;
  keywords: string;
  categoryId: string | null;
  reason?: string;
  categoryGap?: string;
  excludedRecentTitles?: string[];
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse failures and fall back to status text.
  }

  return response.statusText || 'Request failed.';
}

async function postAiAction<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`/api/ai/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const data = await response.json();
    return (data.result ?? null) as T | null;
  } catch (error) {
    console.error(`Error calling AI action "${action}":`, error);
    return null;
  }
}

export async function enhanceProductDetails(
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string
) {
  return postAiAction<string>('enhance-product-details', {
    productName,
    featureName,
    targetAudience,
    description,
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
  return postAiAction<{ headline: string; subheadline: string; cta: string }>('generate-marketing-copy', {
    productName,
    featureName,
    description,
    campaignType,
    tone,
    language,
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
  return postAiAction<{ headlines: string[]; subheadlines: string[]; ctas: string[] }>('generate-copy-ideas', {
    productName,
    featureName,
    description,
    campaignType,
    tone,
    language,
  });
}

export async function extractColorPalette(imageBase64: string): Promise<string[]> {
  const colors = await postAiAction<string[]>('extract-color-palette', {
    imageBase64,
  });

  return Array.isArray(colors) ? colors : [];
}

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
) =>
  postAiAction<string>('generate-final-visual', {
    images,
    productName,
    featureName,
    description,
    headline,
    subheadline,
    cta,
    brandColor,
    campaignType,
    aspectRatio,
    tone,
    designStyle,
    mode,
    language,
    customInstruction,
    campaignFocus,
    variationIndex,
    previousImage,
    userComment,
    referenceImage,
  });

export const analyzeSeoForBlog = async (
  title: string,
  description: string,
  content: string,
  keywords: string
) =>
  postAiAction<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] }>('analyze-seo-for-blog', {
    title,
    description,
    content,
    keywords,
  });

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
  sanityPosts?: SanityPostReference[],
  sanityCategories?: { id: string; name: string }[]
): Promise<BlogPostResponse | null> =>
  postAiAction<BlogPostResponse>('generate-blog-post', {
    productName,
    featureName,
    targetAudience,
    description,
    topic,
    keywords,
    tone,
    length,
    language,
    imageStyle,
    sanityPosts,
    sanityCategories,
  });

export const generateBlogImage = async (prompt: string, isCover: boolean = false): Promise<string | null> =>
  postAiAction<string>('generate-blog-image', {
    prompt,
    isCover,
  });

export const addInternalLinks = async (
  currentContent: string,
  sanityPosts: SanityPostReference[],
  language: string,
  productName?: string,
  featureName?: string
): Promise<string | null> =>
  postAiAction<string>('add-internal-links', {
    currentContent,
    sanityPosts,
    language,
    productName,
    featureName,
  });

export const editBlogPost = async (
  currentContent: string,
  instruction: string,
  productName: string,
  featureName: string,
  targetAudience: string,
  description: string,
  language: string,
  sanityPosts?: SanityPostReference[]
): Promise<string | null> =>
  postAiAction<string>('edit-blog-post', {
    currentContent,
    instruction,
    productName,
    featureName,
    targetAudience,
    description,
    language,
    sanityPosts,
  });

export const generateSocialPosts = async (
  blogContent: string,
  language: string
): Promise<{ twitter: string; linkedin: string } | null> =>
  postAiAction<{ twitter: string; linkedin: string }>('generate-social-posts', {
    blogContent,
    language,
  });

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
): Promise<TopicIdeaSuggestion[] | null> =>
  postAiAction<TopicIdeaSuggestion[]>('generate-topic-ideas', {
    productName,
    featureName,
    targetAudience,
    description,
    language,
    existingTopics,
    recentPosts,
    recentPostTitles,
    sanityCategories,
  });
