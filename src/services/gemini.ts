import { buildPrompt } from '../lib/visual-prompt';
import type { BlogInlineImagePlan } from '../lib/blog-image-slots';
import {
  SOCIAL_POST_STYLE_NAME,
  getSocialPostCategoryLabel,
  type SocialPostCategory,
  type SocialPostLanguage,
  type SocialPostPlatform,
  type SocialPostTheme,
} from '../lib/social-post-prompt';
import type { VisualTheme } from '../lib/visual-house-style';
import type { BlogKeywordStrategy, ResolvedBlogCategory } from '../types';

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

export interface TopicIdeaSuggestion {
  topic: string;
  keywords: string;
  categoryId: string | null;
  keywordStrategy?: BlogKeywordStrategy | null;
  reason?: string;
  categoryGap?: string;
  excludedRecentTitles?: string[];
}

export interface SeoImageAccessibilityInput {
  coverAltText?: string;
  inlineImages?: Array<Pick<BlogInlineImagePlan, 'slotId' | 'altText'>>;
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
  theme: VisualTheme;
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

export interface SocialPostPromptPlanInput {
  productName: string;
  featureName: string;
  description: string;
  platform: SocialPostPlatform;
  theme: SocialPostTheme;
  category: SocialPostCategory;
  language: SocialPostLanguage;
  focus: string;
  blogContent: string;
  extraInstruction: string;
  variationIndex?: number;
  hasReferenceImage?: boolean;
}

export interface SocialPostPromptPlanResult {
  prompt: string;
  headline: string;
  subheadline: string;
  styleName: string;
}

export interface SocialPostVisualInput {
  productName: string;
  featureName: string;
  description: string;
  platform: SocialPostPlatform;
  aspectRatio: string;
  theme: SocialPostTheme;
  language: SocialPostLanguage;
  plannedPrompt: string;
  headline: string;
  subheadline: string;
  variationIndex?: number;
  category?: SocialPostCategory;
  focus?: string;
  referenceImage?: string | null;
  previousImage?: string;
  userComment?: string;
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
  platform: string,
  campaignType: string,
  tone: string,
  language: string,
  includeCta: boolean = true
) {
  return postAiAction<{ headline: string; subheadline: string; cta: string }>('generate-marketing-copy', {
    productName,
    featureName,
    description,
    platform,
    campaignType,
    tone,
    language,
    includeCta,
  });
}

export async function generateCopyIdeas(
  productName: string,
  featureName: string,
  description: string,
  platform: string,
  campaignType: string,
  tone: string,
  language: string,
  ideaAngle?: string,
  includeCta: boolean = true
) {
  return postAiAction<{ headlines: string[]; subheadlines: string[]; ctas: string[] }>('generate-copy-ideas', {
    productName,
    featureName,
    description,
    platform,
    campaignType,
    tone,
    language,
    ideaAngle,
    includeCta,
  });
}

export async function planVisualPrompt(input: VisualPromptPlanInput) {
  return postAiAction<VisualPromptPlanResult>('plan-visual-prompt', { ...input });
}

export async function planSocialPostPrompt(input: SocialPostPromptPlanInput) {
  return postAiAction<SocialPostPromptPlanResult>('plan-social-post-prompt', { ...input });
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
  includeCta: boolean,
  brandColor: string,
  platform: string,
  campaignType: string,
  aspectRatio: string,
  tone: string,
  designStyle: string,
  theme: VisualTheme,
  mode: string,
  language: string,
  customInstruction: string,
  campaignFocus: string,
  variationIndex: number = 0,
  previousImage?: string,
  userComment?: string,
  referenceImage?: string | null,
  plannedPrompt?: string | null
) =>
  postAiAction<string>('generate-final-visual', {
    images,
    productName,
    featureName,
    description,
    headline,
    subheadline,
    cta,
    includeCta,
    brandColor,
    platform,
    campaignType,
    aspectRatio,
    tone,
    designStyle,
    theme,
    mode,
    language,
    customInstruction,
    campaignFocus,
    variationIndex,
    previousImage,
    userComment,
    referenceImage,
    plannedPrompt,
  });

export async function generateSocialPostVisual(input: SocialPostVisualInput) {
  return postAiAction<string>('generate-final-visual', {
    images: [],
    productName: input.productName,
    featureName: input.featureName,
    description: input.description,
    headline: input.headline,
    subheadline: input.subheadline,
    cta: '',
    includeCta: false,
    brandColor: '#4F7CFF',
    platform: input.platform,
    campaignType: input.category ? getSocialPostCategoryLabel(input.category) : 'Product overview',
    aspectRatio: input.aspectRatio,
    tone: 'Premium',
    designStyle: SOCIAL_POST_STYLE_NAME,
    theme: input.theme,
    mode: 'Social Page Post',
    language: input.language,
    customInstruction: input.focus || '',
    campaignFocus: input.focus || '',
    variationIndex: input.variationIndex ?? 0,
    referenceImage: input.referenceImage,
    previousImage: input.previousImage,
    userComment: input.userComment,
    plannedPrompt: input.plannedPrompt,
    renderText: false,
    attachBrandReferences: true,
    brandReferenceTheme: input.theme,
    brandReferenceKind: 'logo',
    requireBrandPlacement: false,
  });
}

export const analyzeSeoForBlog = async (
  title: string,
  description: string,
  content: string,
  keywords: string,
  imageAccessibility?: SeoImageAccessibilityInput
) =>
  postAiAction<{ score: number; keywords: { word: string; count: number }[]; suggestions: string[] }>('analyze-seo-for-blog', {
    title,
    description,
    content,
    keywords,
    coverAltText: imageAccessibility?.coverAltText,
    inlineImages: imageAccessibility?.inlineImages,
  });

export const regenerateBlogTitles = async (input: {
  content?: string | null;
  contentEN?: string | null;
  currentTitle?: string;
  currentTitleEN?: string;
  description?: string;
  descriptionEN?: string;
  keywords?: string;
}
) =>
  postAiAction<RegeneratedBlogTitlesResult>('regenerate-blog-title', input);

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
  sanityCategories?: { id: string; name: string }[],
  keywordStrategy?: BlogKeywordStrategy | null
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
    keywordStrategy,
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
