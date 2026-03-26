import type { EditorialReferencePost } from '../types';
import { buildInternalBlogUrl, type AppLanguage } from './app-language';

export interface UsedInternalBlogLink {
  label: string;
  href: string;
  language: 'TR' | 'EN';
}

export interface InternalLinkAudit {
  reviewedCounts: Record<'TR' | 'EN', number>;
  usedCounts: Record<'TR' | 'EN', number>;
  targetLanguages: Array<'TR' | 'EN'>;
  missingLanguages: Array<'TR' | 'EN'>;
  usedInTargetLanguagesCount: number;
  shouldWarn: boolean;
  status: 'ok' | 'warning' | 'disabled' | 'unavailable';
  message: string;
}

const INTERNAL_BLOG_LINK_REGEX = /\[([^\]]+)]\(((?:\/en)?\/blog\/[^)\s]+)\)/g;

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseDateScore(value?: string) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getEditorialPostLanguage(post: Pick<EditorialReferencePost, 'language' | 'slug'>): 'TR' | 'EN' {
  const normalizedLanguage = normalizeWhitespace(post.language).toLowerCase();
  const normalizedSlug = normalizeWhitespace(post.slug);

  if (normalizedLanguage === 'en' || normalizedSlug.startsWith('en/') || normalizedSlug.startsWith('/en/')) {
    return 'EN';
  }

  return 'TR';
}

function normalizeEditorialTargetLanguage(value: string | null | undefined, fallback: 'TR' | 'EN'): 'TR' | 'EN' {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === 'en') {
    return 'EN';
  }
  if (normalized === 'tr') {
    return 'TR';
  }
  return fallback;
}

function getTargetLanguages(appLanguage: AppLanguage): Array<'TR' | 'EN'> {
  return appLanguage === 'BOTH' ? ['TR', 'EN'] : [appLanguage];
}

function formatAuditLanguages(languages: Array<'TR' | 'EN'>) {
  if (languages.length === 0) {
    return '';
  }

  const labels = languages.map((language) => language === 'EN' ? 'English' : 'Turkish');
  return labels.length === 2 ? `${labels[0]} and ${labels[1]}` : labels[0];
}

export function buildEditorialPostUrl(post: Pick<EditorialReferencePost, 'slug' | 'language'>) {
  const slug = normalizeWhitespace(post.slug);
  if (!slug) {
    return null;
  }

  return buildInternalBlogUrl(slug, normalizeEditorialTargetLanguage(post.language, 'TR'));
}

export function buildEditorialResearchSummaryPosts(
  posts: EditorialReferencePost[],
  maxItems = 12
): EditorialReferencePost[] {
  const byTitle = new Map<string, EditorialReferencePost & { scoreDate: number }>();

  for (const post of posts || []) {
    const title = normalizeWhitespace(post.title);
    if (!title) {
      continue;
    }

    const normalizedPost = {
      ...post,
      title,
      slug: normalizeWhitespace(post.slug) || undefined,
      excerpt: normalizeWhitespace(post.excerpt) || undefined,
      category: normalizeWhitespace(post.category) || undefined,
      categoryId: normalizeWhitespace(post.categoryId) || undefined,
      language: normalizeWhitespace(post.language) || undefined,
      publishedAt: normalizeWhitespace(post.publishedAt) || undefined,
      scoreDate: parseDateScore(post.publishedAt),
    };
    const key = title.toLowerCase();
    const existing = byTitle.get(key);

    if (!existing || normalizedPost.scoreDate >= existing.scoreDate) {
      byTitle.set(key, normalizedPost);
    }
  }

  return Array.from(byTitle.values())
    .sort((left, right) => right.scoreDate - left.scoreDate)
    .slice(0, maxItems)
    .map(({ scoreDate: _scoreDate, ...post }) => post);
}

export function extractUsedInternalBlogLinks(
  entries: Array<{ content: string | null | undefined; language: 'TR' | 'EN' }>
): UsedInternalBlogLink[] {
  const links: UsedInternalBlogLink[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const content = String(entry.content || '');
    let match = INTERNAL_BLOG_LINK_REGEX.exec(content);

    while (match) {
      const label = normalizeWhitespace(match[1]);
      const href = normalizeWhitespace(match[2]);
      const key = `${entry.language}:${href}`;

      if (label && href && !seen.has(key)) {
        seen.add(key);
        links.push({
          label,
          href,
          language: entry.language,
        });
      }

      match = INTERNAL_BLOG_LINK_REGEX.exec(content);
    }

    INTERNAL_BLOG_LINK_REGEX.lastIndex = 0;
  }

  return links;
}

export function extractValidatedUsedInternalBlogLinks(
  entries: Array<{ content: string | null | undefined; language: 'TR' | 'EN' }>,
  posts: Array<Pick<EditorialReferencePost, 'slug' | 'language'>>
): UsedInternalBlogLink[] {
  return extractUsedInternalBlogLinks(
    entries.map((entry) => ({
      language: entry.language,
      content: sanitizeInternalBlogLinks(entry.content, posts, entry.language),
    }))
  );
}

export function sanitizeInternalBlogLinks(
  content: string | null | undefined,
  posts: Array<Pick<EditorialReferencePost, 'slug' | 'language'>>,
  targetLanguage: 'TR' | 'EN'
) {
  const allowedUrls = new Set<string>();
  const allowedUrlsBySlug = new Map<string, string[]>();

  for (const post of posts || []) {
    const slug = normalizeWhitespace(post.slug);
    if (!slug) {
      continue;
    }

    const postLanguage = normalizeEditorialTargetLanguage(post.language, targetLanguage);
    if (normalizeWhitespace(post.language) && postLanguage !== targetLanguage) {
      continue;
    }

    const href = buildInternalBlogUrl(slug, targetLanguage);
    allowedUrls.add(href);
    allowedUrlsBySlug.set(slug, [...(allowedUrlsBySlug.get(slug) || []), href]);
  }

  return String(content || '').replace(INTERNAL_BLOG_LINK_REGEX, (fullMatch, rawLabel, rawHref) => {
    const label = normalizeWhitespace(rawLabel);
    const href = normalizeWhitespace(rawHref);

    if (!label || !href) {
      return fullMatch;
    }

    if (allowedUrls.has(href)) {
      return `[${label}](${href})`;
    }

    const slugMatch = href.match(/\/blog\/([^)\s]+)$/);
    const slug = normalizeWhitespace(slugMatch?.[1]);
    const candidateUrls = slug ? allowedUrlsBySlug.get(slug) || [] : [];

    if (candidateUrls.length === 1) {
      return `[${label}](${candidateUrls[0]})`;
    }

    return label;
  });
}

export function buildInternalLinkAudit(input: {
  appLanguage: AppLanguage;
  autoInternalLinks: boolean;
  reviewedPosts: EditorialReferencePost[];
  usedLinks: UsedInternalBlogLink[];
}): InternalLinkAudit {
  const reviewedCounts: Record<'TR' | 'EN', number> = { TR: 0, EN: 0 };
  const usedCounts: Record<'TR' | 'EN', number> = { TR: 0, EN: 0 };
  const targetLanguages = getTargetLanguages(input.appLanguage);

  for (const post of input.reviewedPosts || []) {
    reviewedCounts[getEditorialPostLanguage(post)] += 1;
  }

  for (const link of input.usedLinks || []) {
    usedCounts[link.language] += 1;
  }

  const reviewedInTargetLanguagesCount = targetLanguages.reduce((count, language) => count + reviewedCounts[language], 0);
  const usedInTargetLanguagesCount = targetLanguages.reduce((count, language) => count + usedCounts[language], 0);
  const missingLanguages = input.autoInternalLinks
    ? targetLanguages.filter((language) => reviewedCounts[language] > 0 && usedCounts[language] === 0)
    : [];

  if (!input.autoInternalLinks) {
    return {
      reviewedCounts,
      usedCounts,
      targetLanguages,
      missingLanguages: [],
      usedInTargetLanguagesCount,
      shouldWarn: false,
      status: 'disabled',
      message: 'Auto internal linking is disabled.',
    };
  }

  if (reviewedInTargetLanguagesCount === 0) {
    return {
      reviewedCounts,
      usedCounts,
      targetLanguages,
      missingLanguages: [],
      usedInTargetLanguagesCount,
      shouldWarn: false,
      status: 'unavailable',
      message: 'No reviewed posts are available yet for internal linking.',
    };
  }

  if (missingLanguages.length > 0) {
    return {
      reviewedCounts,
      usedCounts,
      targetLanguages,
      missingLanguages,
      usedInTargetLanguagesCount,
      shouldWarn: true,
      status: 'warning',
      message: `Reviewed posts are available, but no ${formatAuditLanguages(missingLanguages)} internal links are used yet.`,
    };
  }

  return {
    reviewedCounts,
    usedCounts,
    targetLanguages,
    missingLanguages: [],
    usedInTargetLanguagesCount,
    shouldWarn: false,
    status: 'ok',
    message: 'Internal links are present for the active draft language.',
  };
}
