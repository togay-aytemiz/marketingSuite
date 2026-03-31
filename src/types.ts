import type { BlogInlineImagePlan } from './lib/blog-image-slots';
import { DEFAULT_BLOG_LENGTH, type BlogLengthOption } from './lib/blog-length';
import type { AppLanguage } from './lib/app-language';
import type { VisualTheme } from './lib/visual-house-style';
import { VISUAL_CREATOR_DEFAULTS } from './lib/visual-house-style';

export interface SeoAnalysis {
  score: number;
  keywords: { word: string; count: number }[];
  suggestions: string[];
}

export interface ResolvedBlogCategory {
  id: string;
  name: string;
  resolvedBy?: 'exact-id' | 'exact-name' | 'slug-match' | 'fallback-balance' | 'strategy-suggestion';
  confidence?: 'high' | 'medium' | 'low';
  fallbackReason?: string | null;
}

export interface BlogTopicIdeaRationale {
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

export interface EditorialReferencePost {
  title: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  categoryId?: string;
  language?: string;
  publishedAt?: string;
}

export interface BlogTopicDecision extends BlogTopicIdeaRationale {
  topic: string;
  keywords: string;
  categoryId: string | null;
  keywordStrategy?: BlogKeywordStrategy | null;
}

export interface AppState {
  // Global Product Context
  productName: string;
  featureName: string;
  targetAudience: string;
  description: string;
  brandColor: string;
  colorPalette: string[];
  autoBrandColor: boolean;

  // App Navigation
  activeModule: 'visuals' | 'blog';

  // Visual Creator State
  images: string[];
  referenceImage: string | null;
  headline: string;
  subheadline: string;
  cta: string;
  includeCta: boolean;
  campaignFocus: string; // New field for specific theme/focus
  activePreset: string | null;
  platform: 'LinkedIn' | 'Instagram' | 'X' | 'Website';
  aspectRatio: '1:1' | '4:5' | '16:9';
  variations: number;
  campaignType: string;
  tone: string;
  designStyle: string;
  theme: VisualTheme;
  mode: string;
  language: AppLanguage;
  customInstruction: string;
  finalVisuals: (string | null)[];

  // Blog Writer State
  blogTopic: string;
  blogKeywords: string;
  blogKeywordStrategy: BlogKeywordStrategy;
  blogTone: string;
  blogLength: BlogLengthOption;
  blogImageStyle: string;
  
  // TR (Primary) Content
  blogContent: string | null;
  blogTitle: string | null;
  blogDescription: string | null;
  blogSlug: string | null;
  blogCoverPrompt: string | null;
  blogCoverUrl: string | null;
  blogCoverAltText: string | null;
  blogInlineImages: BlogInlineImagePlan[];
  
  // EN (Secondary) Content
  blogContentEN?: string | null;
  blogTitleEN?: string | null;
  blogDescriptionEN?: string | null;
  blogSlugEN?: string | null;
  blogCoverPromptEN?: string | null;
  blogCoverUrlEN?: string | null;
  blogCoverAltTextEN?: string | null;

  blogResearchPosts: EditorialReferencePost[];
  blogTopicDecision: BlogTopicDecision | null;
  blogCategory: ResolvedBlogCategory | null;
  seoAnalysis: SeoAnalysis | null;
  seoAnalysisEN: SeoAnalysis | null;

  // Sanity Settings
  autoInternalLinks: boolean;
}

export const defaultState: AppState = {
  // Global Product Context
  productName: '',
  featureName: '',
  targetAudience: '',
  description: '',
  brandColor: '#C7FF41',
  colorPalette: [],
  autoBrandColor: true,

  // App Navigation
  activeModule: 'visuals',

  // Visual Creator State
  images: [],
  referenceImage: null,
  headline: '',
  subheadline: '',
  cta: '',
  includeCta: true,
  campaignFocus: '',
  activePreset: VISUAL_CREATOR_DEFAULTS.activePreset,
  platform: VISUAL_CREATOR_DEFAULTS.platform,
  aspectRatio: VISUAL_CREATOR_DEFAULTS.aspectRatio,
  variations: 4,
  campaignType: VISUAL_CREATOR_DEFAULTS.campaignType,
  tone: VISUAL_CREATOR_DEFAULTS.tone,
  designStyle: VISUAL_CREATOR_DEFAULTS.designStyle,
  theme: VISUAL_CREATOR_DEFAULTS.theme,
  mode: VISUAL_CREATOR_DEFAULTS.mode,
  language: 'BOTH',
  customInstruction: '',
  finalVisuals: [null, null, null, null],

  // Blog Writer State
  blogTopic: '',
  blogKeywords: '',
  blogKeywordStrategy: {
    primaryKeyword: '',
    secondaryKeywords: [],
    supportKeywords: [],
    longTailKeywords: [],
    semanticKeywords: [],
  },
  blogTone: 'Professional & Informative',
  blogLength: DEFAULT_BLOG_LENGTH,
  blogImageStyle: 'Editorial B2B (minimal cover, realistic inline, brandless)',
  blogContent: null,
  blogTitle: null,
  blogDescription: null,
  blogSlug: null,
  blogCoverPrompt: null,
  blogCoverUrl: null,
  blogCoverAltText: null,
  blogInlineImages: [],
  
  blogContentEN: null,
  blogTitleEN: null,
  blogDescriptionEN: null,
  blogSlugEN: null,
  blogCoverPromptEN: null,
  blogCoverUrlEN: null,
  blogCoverAltTextEN: null,

  blogResearchPosts: [],
  blogTopicDecision: null,
  blogCategory: null,
  seoAnalysis: null,
  seoAnalysisEN: null,

  // Sanity Settings
  autoInternalLinks: true,
};
