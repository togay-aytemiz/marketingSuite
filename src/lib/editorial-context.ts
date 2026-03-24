import type { EditorialReferencePost } from '../types';

export interface UsedInternalBlogLink {
  label: string;
  href: string;
  language: 'TR' | 'EN';
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

export function buildEditorialPostUrl(post: Pick<EditorialReferencePost, 'slug' | 'language'>) {
  const slug = normalizeWhitespace(post.slug);
  if (!slug) {
    return null;
  }

  return String(post.language || '').toLowerCase() === 'en'
    ? `/en/blog/${slug}`
    : `/blog/${slug}`;
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
