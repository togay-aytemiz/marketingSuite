import type { BlogInlineImagePlan } from './lib/blog-image-slots';
import type { AppLanguage } from './lib/app-language';

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
  campaignFocus: string; // New field for specific theme/focus
  activePreset: string | null;
  platform: 'LinkedIn' | 'Instagram' | 'X' | 'Website';
  aspectRatio: '1:1' | '4:5' | '16:9';
  variations: number;
  campaignType: string;
  tone: string;
  designStyle: string;
  mode: string;
  language: AppLanguage;
  customInstruction: string;
  finalVisuals: (string | null)[];

  // Blog Writer State
  blogTopic: string;
  blogKeywords: string;
  blogTone: string;
  blogLength: 'Short (1000 - 1500 tokens)' | 'Medium (1500 - 2500 tokens)' | 'Long (2500 - 4000 tokens)';
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
  brandColor: '#4F46E5',
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
  campaignFocus: '',
  activePreset: 'linkedin',
  platform: 'LinkedIn',
  aspectRatio: '1:1',
  variations: 4,
  campaignType: 'Feature announcement',
  tone: 'Professional',
  designStyle: 'Clean SaaS',
  mode: 'Clean Screenshot Highlight',
  language: 'BOTH',
  customInstruction: '',
  finalVisuals: [null, null, null, null],

  // Blog Writer State
  blogTopic: '',
  blogKeywords: '',
  blogTone: 'Professional & Informative',
  blogLength: 'Medium (1500 - 2500 tokens)',
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
