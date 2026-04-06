import { defaultState, type AppState } from '../types';
import { getPrimaryLanguage, normalizeAppLanguage } from './app-language';
import { normalizeBlogKeywordStrategy, buildKeywordSummaryText } from './blog-keyword-strategy';
import { normalizeBlogLength } from './blog-length';
import { SOCIAL_POST_IMAGE_SLOT_COUNT } from './social-post-prompt';

export const APP_STATE_VERSION = 3;

export function hydrateAppState(saved: string | null): AppState {
  if (!saved) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AppState> & { stateVersion?: number };
    const storedVersion = Number(parsed?.stateVersion || 0);
    const normalizedLanguage = normalizeAppLanguage(parsed?.language, defaultState.language);
    const blogLength = normalizeBlogLength(parsed?.blogLength);
    const blogKeywordStrategy = normalizeBlogKeywordStrategy(
      parsed?.blogKeywordStrategy || parsed?.blogTopicDecision?.keywordStrategy,
      parsed?.blogKeywords
    );
    const language = storedVersion < APP_STATE_VERSION && normalizedLanguage === 'TR'
      ? 'BOTH'
      : normalizedLanguage;
    const socialPostLanguage = getPrimaryLanguage(parsed?.socialPostLanguage || defaultState.socialPostLanguage);
    const legacySocialPostInstructions = Array.isArray((parsed as { socialPostImageInstructions?: unknown }).socialPostImageInstructions)
      ? ((parsed as { socialPostImageInstructions?: unknown[] }).socialPostImageInstructions || []).filter((item): item is string => typeof item === 'string')
      : [];
    const socialPostFocus = String(
      parsed?.socialPostFocus
      || legacySocialPostInstructions.find((item) => String(item || '').trim())
      || defaultState.socialPostFocus
    ).trim();
    const socialPostBlogContent = String(
      parsed?.socialPostBlogContent || defaultState.socialPostBlogContent
    ).trim();

    return {
      ...defaultState,
      ...parsed,
      language,
      socialPostLanguage,
      socialPostFocus,
      socialPostBlogContent,
      socialPostReferenceImage: null,
      blogLength,
      blogKeywordStrategy,
      blogKeywords: buildKeywordSummaryText(blogKeywordStrategy),
      images: [],
      finalVisuals: [null, null, null, null],
      socialPostHeadlinePlans: Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null),
      socialPostSubheadlinePlans: Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null),
      socialPostPromptPlans: Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null),
      socialPostFinalVisuals: Array.from({ length: SOCIAL_POST_IMAGE_SLOT_COUNT }, () => null),
      blogContent: null,
      seoAnalysis: null,
      referenceImage: null,
    };
  } catch {
    return defaultState;
  }
}

export function buildPersistedAppState(state: AppState) {
  return {
    stateVersion: APP_STATE_VERSION,
    productName: state.productName,
    featureName: state.featureName,
    targetAudience: state.targetAudience,
    description: state.description,
    brandColor: state.brandColor,
    autoBrandColor: state.autoBrandColor,
    autoInternalLinks: state.autoInternalLinks,
    language: normalizeAppLanguage(state.language, defaultState.language),
    tone: state.tone,
    blogTone: state.blogTone,
    blogLength: state.blogLength,
    blogKeywords: buildKeywordSummaryText(state.blogKeywordStrategy || null),
    blogKeywordStrategy: state.blogKeywordStrategy,
    blogTopic: state.blogTopic,
    blogTopicDecision: state.blogTopicDecision,
    blogCategory: state.blogCategory,
    activeModule: state.activeModule,
    aspectRatio: state.aspectRatio,
    mode: state.mode,
    designStyle: state.designStyle,
    theme: state.theme,
    campaignType: state.campaignType,
    headline: state.headline,
    subheadline: state.subheadline,
    cta: state.cta,
    includeCta: state.includeCta,
    socialPostPlatform: state.socialPostPlatform,
    socialPostTheme: state.socialPostTheme,
    socialPostCategory: state.socialPostCategory,
    socialPostLanguage: state.socialPostLanguage,
    socialPostFocus: state.socialPostFocus,
    socialPostBlogContent: state.socialPostBlogContent,
  };
}
