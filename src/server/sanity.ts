import { getSanityToken } from './env';

export interface NormalizedSanitySlug {
  current: string;
}

export interface NormalizedSanityCategory {
  _id: string;
  title: string;
  description: string;
  slug: NormalizedSanitySlug;
}

export interface NormalizedSanityPost {
  _id: string;
  title: string;
  slug: NormalizedSanitySlug;
  excerpt?: string;
  language?: string;
  translationKey?: string;
  bodyMarkdown?: string;
  category?: {
    _id?: string;
    title?: string;
    slug?: NormalizedSanitySlug;
  };
}

export interface PublishData {
  title: string;
  content: string;
  description?: string;
  slug?: string;
  coverAltText?: string;
}

export interface PublishPayload {
  translationKey?: string;
  categoryId?: string | null;
  tr?: PublishData;
  en?: PublishData;
}

interface SanityRuntimeConfig {
  projectId: string;
  dataset: string;
  token: string;
  apiVersion: string;
}

interface ExistingSanityPostRecord {
  _id: string;
  publishedAt?: string;
  category?: {
    _type: 'reference';
    _ref: string;
  };
  coverImage?: {
    _type?: 'image';
    asset?: {
      _ref: string;
      _type: 'reference';
    };
    alt?: string;
  } | null;
}

const DEFAULT_API_VERSION = '2026-03-01';

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

export function slugifyText(value: string) {
  const transliterated = value.replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH_CHAR_MAP[char] || char);

  return transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

export function buildPostDocumentId(translationKey: string, language: 'tr' | 'en') {
  const normalizedKey = slugifyText(translationKey) || 'post';
  return `post.${normalizedKey}.${language}`;
}

function getSanityRuntimeConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): SanityRuntimeConfig | null {
  const projectId = String(env.SANITY_PROJECT_ID || '').trim();
  const dataset = String(env.SANITY_DATASET || 'production').trim() || 'production';
  const token = String(getSanityToken(env) || '').trim();
  const apiVersion = String(env.SANITY_API_VERSION || DEFAULT_API_VERSION).trim() || DEFAULT_API_VERSION;

  if (!projectId || !token) {
    return null;
  }

  return {
    projectId,
    dataset,
    token,
    apiVersion,
  };
}

function buildSanityUrl(config: SanityRuntimeConfig, endpoint: `query/${string}` | `mutate/${string}`) {
  return `https://${config.projectId}.api.sanity.io/v${config.apiVersion}/data/${endpoint}`;
}

async function querySanity<T>(
  query: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): Promise<T[]> {
  const config = getSanityRuntimeConfig(env);
  if (!config) {
    return [];
  }

  const url = new URL(buildSanityUrl(config, `query/${config.dataset}`));
  url.searchParams.set('query', query);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Sanity query failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.result)) {
    return payload.result as T[];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T[];
  }

  return [];
}

async function mutateSanity(
  mutations: unknown[],
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const config = getSanityRuntimeConfig(env);
  if (!config) {
    throw new Error('Sanity is not configured.');
  }

  const response = await fetch(buildSanityUrl(config, `mutate/${config.dataset}`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      mutations,
      returnIds: true,
      returnDocuments: false,
      visibility: 'sync',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sanity mutation failed with ${response.status} ${response.statusText}: ${errorText}`);
  }

  return response.json();
}

export function normalizeSanitySlug(slug: unknown): NormalizedSanitySlug {
  if (typeof slug === 'string') {
    return { current: slug };
  }

  if (
    slug &&
    typeof slug === 'object' &&
    'current' in slug &&
    typeof (slug as { current?: unknown }).current === 'string'
  ) {
    return { current: (slug as { current: string }).current };
  }

  return { current: '' };
}

export function normalizeSanityCategory(
  doc: Record<string, unknown>,
  preferredLanguage: 'tr' | 'en' = 'en'
): NormalizedSanityCategory {
  const title =
    preferredLanguage === 'tr'
      ? String(doc.titleTr || doc.title || doc.titleEn || 'Untitled category')
      : String(doc.titleEn || doc.title || doc.titleTr || 'Untitled category');

  const description =
    preferredLanguage === 'tr'
      ? String(doc.descriptionTr || doc.description || doc.descriptionEn || '')
      : String(doc.descriptionEn || doc.description || doc.descriptionTr || '');

  return {
    _id: String(doc._id || ''),
    title,
    description,
    slug: normalizeSanitySlug(doc.slug),
  };
}

export function normalizeSanityPost(doc: Record<string, unknown>): NormalizedSanityPost {
  const category = doc.category && typeof doc.category === 'object' ? (doc.category as Record<string, unknown>) : null;

  return {
    _id: String(doc._id || ''),
    title: String(doc.title || ''),
    slug: normalizeSanitySlug(doc.slug),
    excerpt: doc.excerpt ? String(doc.excerpt) : undefined,
    language: doc.language ? String(doc.language) : undefined,
    translationKey: doc.translationKey ? String(doc.translationKey) : undefined,
    bodyMarkdown: doc.bodyMarkdown ? String(doc.bodyMarkdown) : undefined,
    category: category
      ? {
          _id: category._id ? String(category._id) : undefined,
          title: String(category.title || category.titleEn || category.titleTr || ''),
          slug: category.slug ? normalizeSanitySlug(category.slug) : undefined,
        }
      : undefined,
  };
}

function buildCategoryQuery() {
  return `*[_type == "category" && defined(slug.current) && !(_id in path("drafts.**"))] | order(coalesce(titleEn, titleTr, title) asc) {
    _id,
    title,
    titleTr,
    titleEn,
    description,
    descriptionTr,
    descriptionEn,
    slug
  }`;
}

function buildPostQuery() {
  return `*[_type == "post" && defined(title) && defined(slug.current) && !(_id in path("drafts.**"))] | order(coalesce(publishedAt, _updatedAt) desc) {
    _id,
    title,
    slug,
    excerpt,
    language,
    translationKey,
    bodyMarkdown,
    "category": category->{
      _id,
      title,
      titleTr,
      titleEn,
      slug
    }
  }`;
}

function normalizeTranslationKey(value?: string) {
  return slugifyText(String(value || '').trim()) || `writer-${Date.now()}`;
}

function buildPostDocument(
  language: 'tr' | 'en',
  translationKey: string,
  data: PublishData,
  categoryId: string | null | undefined,
  existingRecord?: ExistingSanityPostRecord
) {
  const title = String(data.title || '').trim();
  const description = String(data.description || '').trim();
  const content = String(data.content || '').trim();
  const slug = slugifyText(String(data.slug || title || translationKey));
  const resolvedCategory = categoryId
    ? {
        _type: 'reference' as const,
        _ref: categoryId,
      }
    : existingRecord?.category;

  if (!title || !content) {
    throw new Error(`Missing required ${language.toUpperCase()} post content.`);
  }

  if (!resolvedCategory?._ref) {
    throw new Error('A Sanity category is required to publish a blog post.');
  }

  const document: Record<string, unknown> = {
    _id: buildPostDocumentId(translationKey, language),
    _type: 'post',
    language,
    translationKey,
    title,
    slug: {
      _type: 'slug',
      current: slug || translationKey,
    },
    excerpt: description,
    seoTitle: title,
    seoDescription: description,
    publishedAt: existingRecord?.publishedAt || new Date().toISOString(),
    bodyMarkdown: content,
    category: resolvedCategory,
  };

  if (existingRecord?.coverImage?.asset?._ref) {
    document.coverImage = {
      ...existingRecord.coverImage,
      alt: data.coverAltText || existingRecord.coverImage.alt || '',
    };
  }

  return document;
}

async function fetchExistingPostRecords(
  translationKey: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const ids = [buildPostDocumentId(translationKey, 'tr'), buildPostDocumentId(translationKey, 'en')];
  const query = `*[_id in ${JSON.stringify(ids)}]{
    _id,
    publishedAt,
    category,
    coverImage{
      _type,
      alt,
      asset
    }
  }`;

  const records = await querySanity<ExistingSanityPostRecord>(query, env);
  return new Map(records.map((record) => [record._id, record]));
}

export async function fetchSanityCategories(
  preferredLanguage: 'tr' | 'en' = 'tr',
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const docs = await querySanity<Record<string, unknown>>(buildCategoryQuery(), env);
  return docs.map((doc) => normalizeSanityCategory(doc, preferredLanguage));
}

export async function fetchSanityPosts(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const docs = await querySanity<Record<string, unknown>>(buildPostQuery(), env);
  return docs.map((doc) => normalizeSanityPost(doc));
}

export async function publishToSanity(
  payload: PublishPayload,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const translationKey = normalizeTranslationKey(payload.translationKey);
  const existingRecords = await fetchExistingPostRecords(translationKey, env);
  const mutations = [];
  const ids: string[] = [];

  if (payload.tr) {
    const trId = buildPostDocumentId(translationKey, 'tr');
    ids.push(trId);
    mutations.push({
      createOrReplace: buildPostDocument('tr', translationKey, payload.tr, payload.categoryId, existingRecords.get(trId)),
    });
  }

  if (payload.en) {
    const enId = buildPostDocumentId(translationKey, 'en');
    ids.push(enId);
    mutations.push({
      createOrReplace: buildPostDocument('en', translationKey, payload.en, payload.categoryId, existingRecords.get(enId)),
    });
  }

  if (mutations.length === 0) {
    throw new Error('Nothing to publish. Provide at least one language entry.');
  }

  const result = await mutateSanity(mutations, env);

  return {
    success: true,
    translationKey,
    ids,
    result,
  };
}
