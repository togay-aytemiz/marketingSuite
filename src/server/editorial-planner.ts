import { fetchSanityCategories, fetchSanityPosts } from './sanity';

type CategoryShape = {
  _id: string;
  title: string;
};

type PostShape = {
  _id: string;
  title: string;
  excerpt?: string;
  language?: string;
  translationKey?: string;
  publishedAt?: string;
  updatedAt?: string;
  slug?: {
    current?: string;
  };
  category?: {
    _id?: string;
    title?: string;
  };
};

export type PlanningLanguage = 'TR' | 'EN' | 'BOTH';

export interface PlanningRecentPost {
  title: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  categoryId?: string;
  language?: string;
  publishedAt?: string;
}

export interface EditorialPlanningSnapshot {
  recentPosts: PlanningRecentPost[];
  recentPostTitles: string[];
  sanityCategories: Array<{ id: string; name: string }>;
}

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

function normalizePostLanguage(value?: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === 'tr') {
    return 'TR';
  }
  if (normalized === 'en') {
    return 'EN';
  }
  return null;
}

function buildPlanningGroupKey(post: PostShape) {
  const translationKey = normalizeWhitespace(post.translationKey);
  if (translationKey) {
    return `translation:${translationKey.toLowerCase()}`;
  }

  const slug = normalizeWhitespace(post.slug?.current);
  if (slug) {
    return `slug:${slug.toLowerCase()}`;
  }

  return `id:${normalizeWhitespace(post._id).toLowerCase()}`;
}

export function normalizePlanningLanguage(value: unknown): PlanningLanguage {
  const normalized = normalizeWhitespace(String(value || '')).toUpperCase();
  if (normalized === 'EN') {
    return 'EN';
  }
  if (normalized === 'BOTH') {
    return 'BOTH';
  }
  return 'TR';
}

export function buildEditorialPlanningSnapshot(
  posts: PostShape[],
  categories: CategoryShape[],
  language: PlanningLanguage
): EditorialPlanningSnapshot {
  const filteredPosts = posts.filter((post) => {
    const postLanguage = normalizePostLanguage(post.language);
    if (!postLanguage) {
      return true;
    }

    if (language === 'BOTH') {
      return true;
    }

    return postLanguage === language;
  });

  const dedupedPosts = new Map<string, PostShape>();
  for (const post of filteredPosts) {
    const key = buildPlanningGroupKey(post);
    const existing = dedupedPosts.get(key);
    const postScore = parseDateScore(post.publishedAt || post.updatedAt);
    const existingScore = existing ? parseDateScore(existing.publishedAt || existing.updatedAt) : -1;

    if (!existing || postScore > existingScore) {
      dedupedPosts.set(key, post);
    }
  }

  const recentPosts = Array.from(dedupedPosts.values())
    .sort((a, b) => parseDateScore(b.publishedAt || b.updatedAt) - parseDateScore(a.publishedAt || a.updatedAt))
    .map((post) => ({
      title: normalizeWhitespace(post.title),
      slug: normalizeWhitespace(post.slug?.current) || undefined,
      excerpt: normalizeWhitespace(post.excerpt),
      category: normalizeWhitespace(post.category?.title),
      categoryId: normalizeWhitespace(post.category?._id) || undefined,
      language: normalizeWhitespace(post.language) || undefined,
      publishedAt: normalizeWhitespace(post.publishedAt || post.updatedAt) || undefined,
    }))
    .filter((post) => post.title);

  return {
    recentPosts,
    recentPostTitles: recentPosts.map((post) => post.title),
    sanityCategories: categories
      .map((category) => ({
        id: normalizeWhitespace(category._id),
        name: normalizeWhitespace(category.title),
      }))
      .filter((category) => category.id && category.name),
  };
}

export async function fetchEditorialPlanningSnapshot(language: unknown): Promise<EditorialPlanningSnapshot> {
  const normalizedLanguage = normalizePlanningLanguage(language);
  const categoryLanguage = normalizedLanguage === 'EN' ? 'en' : 'tr';
  const [posts, categories] = await Promise.all([
    fetchSanityPosts(),
    fetchSanityCategories(categoryLanguage),
  ]);

  return buildEditorialPlanningSnapshot(posts, categories, normalizedLanguage);
}
