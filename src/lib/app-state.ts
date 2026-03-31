import { defaultState, type AppState } from '../types';
import { normalizeAppLanguage } from './app-language';
import { normalizeBlogKeywordStrategy, buildKeywordSummaryText } from './blog-keyword-strategy';
import { normalizeBlogLength } from './blog-length';

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

    return {
      ...defaultState,
      ...parsed,
      language,
      blogLength,
      blogKeywordStrategy,
      blogKeywords: buildKeywordSummaryText(blogKeywordStrategy),
      images: [],
      finalVisuals: [null, null, null, null],
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
  };
}
