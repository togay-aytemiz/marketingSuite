export type AppLanguage = 'TR' | 'EN' | 'BOTH';

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeAppLanguage(value: unknown, fallback: AppLanguage = 'BOTH'): AppLanguage {
  const normalized = normalizeWhitespace(String(value || '')).toUpperCase();

  if (normalized === 'TR' || normalized === 'EN' || normalized === 'BOTH') {
    return normalized;
  }

  return fallback;
}

export function isDualLanguage(value: unknown) {
  return normalizeAppLanguage(value) === 'BOTH';
}

export function getPrimaryLanguage(value: unknown): 'TR' | 'EN' {
  const normalized = normalizeAppLanguage(value, 'TR');
  return normalized === 'EN' ? 'EN' : 'TR';
}

export function getLanguageName(language: 'TR' | 'EN') {
  return language === 'EN' ? 'English' : 'Turkish';
}

export function getSingleOutputLanguageName(value: unknown) {
  return getLanguageName(getPrimaryLanguage(value));
}

export function getDualOutputLanguageName(value: unknown) {
  return isDualLanguage(value) ? 'Turkish and English' : getSingleOutputLanguageName(value);
}

export function getBlogPathPrefix(language: 'TR' | 'EN') {
  return language === 'EN' ? '/en/blog' : '/blog';
}

export function buildInternalBlogUrl(slug: string, language: 'TR' | 'EN') {
  return `${getBlogPathPrefix(language)}/${normalizeWhitespace(slug)}`;
}
