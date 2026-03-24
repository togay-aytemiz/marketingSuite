export type BlogLengthOption =
  | 'Short (800 - 1100 words)'
  | 'Medium (1200 - 1700 words)'
  | 'Long (1800 - 2600 words)';

type BlogLengthKey = 'short' | 'medium' | 'long';

export interface BlogLengthRequirements {
  key: BlogLengthKey;
  label: BlogLengthOption;
  minWords: number;
  targetWords: number;
  maxWords: number;
  recommendedH2Count: '4-5' | '5-6' | '6-8';
}

const BLOG_LENGTH_REQUIREMENTS_BY_KEY: Record<BlogLengthKey, BlogLengthRequirements> = {
  short: {
    key: 'short',
    label: 'Short (800 - 1100 words)',
    minWords: 800,
    targetWords: 950,
    maxWords: 1100,
    recommendedH2Count: '4-5',
  },
  medium: {
    key: 'medium',
    label: 'Medium (1200 - 1700 words)',
    minWords: 1200,
    targetWords: 1450,
    maxWords: 1700,
    recommendedH2Count: '5-6',
  },
  long: {
    key: 'long',
    label: 'Long (1800 - 2600 words)',
    minWords: 1800,
    targetWords: 2200,
    maxWords: 2600,
    recommendedH2Count: '6-8',
  },
};

export const BLOG_LENGTH_OPTIONS = Object.values(BLOG_LENGTH_REQUIREMENTS_BY_KEY)
  .map((item) => item.label) as BlogLengthOption[];

export const DEFAULT_BLOG_LENGTH: BlogLengthOption = BLOG_LENGTH_REQUIREMENTS_BY_KEY.medium.label;

function detectBlogLengthKey(value: string): BlogLengthKey {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.includes('short') || normalized.includes('kisa') || normalized.includes('kısa')) {
    return 'short';
  }

  if (normalized.includes('long') || normalized.includes('uzun')) {
    return 'long';
  }

  return 'medium';
}

export function normalizeBlogLength(value: string | null | undefined): BlogLengthOption {
  return BLOG_LENGTH_REQUIREMENTS_BY_KEY[detectBlogLengthKey(String(value || ''))].label;
}

export function resolveBlogLengthRequirements(value: string | null | undefined): BlogLengthRequirements {
  return BLOG_LENGTH_REQUIREMENTS_BY_KEY[detectBlogLengthKey(String(value || ''))];
}

export function countWords(value: string | null | undefined) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}
