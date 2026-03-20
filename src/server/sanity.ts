import { getSanityToken } from './env';
import { generateBlogImage } from './gemini';

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
  publishedAt?: string;
  updatedAt?: string;
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
  coverImageDataUrl?: string;
  coverImagePrompt?: string;
  inlineImages?: Array<{
    prompt: string;
    dataUrl?: string;
  }>;
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
const MAX_SEO_TITLE_LENGTH = 70;
const MAX_SEO_DESCRIPTION_LENGTH = 160;
const WRITER_TRANSLATION_KEY_REGEX = /^writer-\d+$/i;

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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function trimToMaxLength(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const sliced = lastSpace >= Math.floor(maxLength * 0.6) ? truncated.slice(0, lastSpace) : truncated;

  return normalizeWhitespace(sliced.replace(/[.,;:!?-]+$/g, ''));
}

export function buildSeoTitle(title: string, maxLength = MAX_SEO_TITLE_LENGTH) {
  const normalized = normalizeWhitespace(title);
  if (!normalized) {
    throw new Error('SEO title is required.');
  }

  if (normalized.length > maxLength) {
    throw new Error(`SEO title must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function buildSeoDescription(description: string, maxLength = MAX_SEO_DESCRIPTION_LENGTH) {
  return trimToMaxLength(description, maxLength);
}

export function sanitizeBlogMarkdownForPublish(content: string) {
  let sanitized = String(content || '');

  // Remove JSON-LD script tags copied into the article body.
  sanitized = sanitized.replace(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi, '\n');

  // Remove markdown code blocks that embed FAQ schema markup.
  sanitized = sanitized.replace(/```(?:html|json|javascript)?\s*[\s\S]*?```/gi, (block) => {
    const normalized = block.toLowerCase();
    if (normalized.includes('schema.org') || normalized.includes('faqpage') || normalized.includes('@context')) {
      return '\n';
    }

    return block;
  });

  // Remove internal image prompt tokens from publish content.
  sanitized = sanitized.replace(/\[IMAGE_PROMPT:[^\]]*]/gi, '');
  sanitized = sanitized.replace(/\[IMAGE_PLACEHOLDER_\d+]/gi, '');

  sanitized = sanitized
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return sanitized;
}

function buildInlineImageAltFromPrompt(prompt: string) {
  const cleaned = normalizeWhitespace(
    String(prompt || '')
      .replace(/["'`]/g, '')
      .replace(/\s+/g, ' ')
  );

  if (!cleaned) {
    return 'Blog image';
  }

  return trimToMaxLength(cleaned, 100) || 'Blog image';
}

function extractInlineImagePrompts(content: string) {
  const prompts: string[] = [];
  const regex = /\[IMAGE_PROMPT:\s*([^\]]+?)\s*\]/gi;
  let match = regex.exec(content);

  while (match) {
    prompts.push(normalizeWhitespace(match[1] || ''));
    match = regex.exec(content);
  }

  return prompts.filter(Boolean);
}

interface InlineImageReplacement {
  url: string;
  alt?: string;
}

export function applyInlineImageUrlsToMarkdown(
  content: string,
  replacements: Record<string, InlineImageReplacement>
) {
  const byNormalizedPrompt = new Map<string, InlineImageReplacement>();
  for (const [prompt, data] of Object.entries(replacements)) {
    const normalizedPrompt = normalizeWhitespace(prompt);
    if (normalizedPrompt && data?.url) {
      byNormalizedPrompt.set(normalizedPrompt, data);
    }
  }

  return String(content || '').replace(/\[IMAGE_PROMPT:\s*([^\]]+?)\s*\]/gi, (_whole, rawPrompt) => {
    const normalizedPrompt = normalizeWhitespace(String(rawPrompt || ''));
    const replacement = byNormalizedPrompt.get(normalizedPrompt);
    if (!replacement?.url) {
      return '';
    }

    const alt = normalizeWhitespace(replacement.alt || buildInlineImageAltFromPrompt(normalizedPrompt));
    return `![${alt}](${replacement.url})`;
  });
}

export function resolveTranslationKeyForPayload(payload: PublishPayload, nowMs = Date.now()) {
  const explicitKey = normalizeWhitespace(String(payload.translationKey || ''));
  const explicitSlugified = slugifyText(explicitKey);

  if (explicitSlugified && !WRITER_TRANSLATION_KEY_REGEX.test(explicitSlugified)) {
    return explicitSlugified;
  }

  const candidates = [
    payload.tr?.slug,
    payload.en?.slug,
    payload.tr?.title,
    payload.en?.title,
    explicitKey,
  ];

  for (const candidate of candidates) {
    const normalized = slugifyText(String(candidate || ''));
    if (normalized && !WRITER_TRANSLATION_KEY_REGEX.test(normalized)) {
      return normalized;
    }
  }

  return `writer-${nowMs}`;
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

interface ParsedImageDataUrl {
  mimeType: string;
  bytes: Buffer;
  extension: string;
}

interface SanityUploadedImageAsset {
  assetRef: string;
  url: string;
}

function parseImageDataUrl(dataUrl?: string): ParsedImageDataUrl | null {
  const value = String(dataUrl || '').trim();
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const base64 = match[2].replace(/\s+/g, '');
  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length === 0) {
    return null;
  }

  const extensionMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return {
    mimeType,
    bytes,
    extension: extensionMap[mimeType] || 'png',
  };
}

async function uploadSanityImageAsset(
  dataUrl: string | undefined,
  filenamePrefix: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const config = getSanityRuntimeConfig(env);
  if (!config) {
    return null;
  }

  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    return null;
  }

  const url = new URL(`https://${config.projectId}.api.sanity.io/v${config.apiVersion}/assets/images/${config.dataset}`);
  url.searchParams.set('filename', `${slugifyText(filenamePrefix) || 'cover-image'}.${parsed.extension}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': parsed.mimeType,
      Accept: 'application/json',
    },
    body: parsed.bytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sanity asset upload failed with ${response.status} ${response.statusText}: ${errorText}`);
  }

  const payload = await response.json();
  const assetId = normalizeWhitespace(String(payload?.document?._id || payload?._id || ''));
  if (!assetId) {
    throw new Error('Sanity asset upload succeeded but no asset id was returned.');
  }

  const imageUrl =
    normalizeWhitespace(String(payload?.document?.url || payload?.url || '')) ||
    buildSanityImageCdnUrl(config, assetId);

  if (!imageUrl) {
    throw new Error('Sanity asset upload succeeded but no image URL was returned.');
  }

  return {
    assetRef: assetId,
    url: imageUrl,
  } as SanityUploadedImageAsset;
}

function buildSanityImageCdnUrl(config: SanityRuntimeConfig, assetRef: string) {
  const normalizedAssetRef = normalizeWhitespace(assetRef);
  const match = normalizedAssetRef.match(/^image-([a-zA-Z0-9]+)-(\d+x\d+)-([a-zA-Z0-9]+)$/);

  if (!match) {
    return '';
  }

  const [, assetHash, dimensions, extension] = match;
  return `https://cdn.sanity.io/images/${config.projectId}/${config.dataset}/${assetHash}-${dimensions}.${extension.toLowerCase()}`;
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
    publishedAt: doc.publishedAt ? String(doc.publishedAt) : undefined,
    updatedAt: doc._updatedAt ? String(doc._updatedAt) : undefined,
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
    publishedAt,
    _updatedAt,
    "category": category->{
      _id,
      title,
      titleTr,
      titleEn,
      slug
    }
  }`;
}

function buildPostDocument(
  language: 'tr' | 'en',
  translationKey: string,
  data: PublishData,
  categoryId: string | null | undefined,
  existingRecord?: ExistingSanityPostRecord,
  coverImageAssetRef?: string | null
) {
  const title = normalizeWhitespace(String(data.title || ''));
  const description = buildSeoDescription(String(data.description || ''));
  const content = sanitizeBlogMarkdownForPublish(String(data.content || ''));
  const slug = slugifyText(String(data.slug || title || translationKey));
  const resolvedCategory = categoryId
    ? {
        _type: 'reference' as const,
        _ref: categoryId,
      }
    : existingRecord?.category;
  const coverAltText = normalizeWhitespace(
    String(data.coverAltText || buildInlineImageAltFromPrompt(String(data.coverImagePrompt || '')))
  );

  if (!title || !content) {
    throw new Error(`Missing required ${language.toUpperCase()} post content.`);
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
    seoTitle: buildSeoTitle(title),
    seoDescription: description,
    publishedAt: existingRecord?.publishedAt || new Date().toISOString(),
    bodyMarkdown: content,
  };

  if (resolvedCategory?._ref) {
    document.category = resolvedCategory;
  }

  if (coverImageAssetRef) {
    document.coverImage = {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: coverImageAssetRef,
      },
      alt: coverAltText,
    };
  } else if (existingRecord?.coverImage?.asset?._ref) {
    document.coverImage = {
      ...existingRecord.coverImage,
      alt: normalizeWhitespace(String(coverAltText || existingRecord.coverImage.alt || '')),
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
  const translationKey = resolveTranslationKeyForPayload(payload);
  const existingRecords = await fetchExistingPostRecords(translationKey, env);
  const mutations: Array<{ createOrReplace: Record<string, unknown> }> = [];
  const ids: string[] = [];
  const uploadedAssetByDataUrl = new Map<string, SanityUploadedImageAsset>();

  const uploadOrReuseImageAsset = async (dataUrl: string, filenamePrefix: string) => {
    const rawDataUrl = String(dataUrl || '').trim();
    if (!rawDataUrl) {
      return null;
    }

    if (uploadedAssetByDataUrl.has(rawDataUrl)) {
      return uploadedAssetByDataUrl.get(rawDataUrl) || null;
    }

    const uploadedRef = await uploadSanityImageAsset(
      rawDataUrl,
      filenamePrefix,
      env
    );

    if (uploadedRef) {
      uploadedAssetByDataUrl.set(rawDataUrl, uploadedRef);
    }

    return uploadedRef;
  };

  const resolveCoverAssetRef = async (language: 'tr' | 'en', data?: PublishData) => {
    const coverFilename = `${translationKey}-${language}-cover`;
    const uploadedFromPayload = await uploadOrReuseImageAsset(String(data?.coverImageDataUrl || ''), coverFilename);
    if (uploadedFromPayload?.assetRef) {
      return uploadedFromPayload.assetRef;
    }

    const coverPrompt = normalizeWhitespace(String(data?.coverImagePrompt || ''));
    if (!coverPrompt) {
      return null;
    }

    const generatedCoverDataUrl = await generateBlogImage(coverPrompt, true);
    const uploadedFromPrompt = await uploadOrReuseImageAsset(String(generatedCoverDataUrl || ''), coverFilename);
    return uploadedFromPrompt?.assetRef || null;
  };

  const buildInlinePayloadMap = (data?: PublishData) => {
    const map = new Map<string, string>();
    for (const item of data?.inlineImages || []) {
      const prompt = normalizeWhitespace(String(item?.prompt || ''));
      const dataUrl = String(item?.dataUrl || '').trim();
      if (prompt && dataUrl && !map.has(prompt)) {
        map.set(prompt, dataUrl);
      }
    }
    return map;
  };

  const resolveInlineReplacements = async (language: 'tr' | 'en', data?: PublishData) => {
    const content = String(data?.content || '');
    const prompts = Array.from(new Set(extractInlineImagePrompts(content)));
    if (prompts.length === 0) {
      return {} as Record<string, InlineImageReplacement>;
    }

    const inlinePayloadMap = buildInlinePayloadMap(data);
    const replacements: Record<string, InlineImageReplacement> = {};

    for (let index = 0; index < prompts.length; index += 1) {
      const prompt = prompts[index];
      const filenamePrefix = `${translationKey}-${language}-inline-${index + 1}`;
      const payloadDataUrl = inlinePayloadMap.get(prompt) || '';

      let uploaded = await uploadOrReuseImageAsset(payloadDataUrl, filenamePrefix);
      if (!uploaded) {
        const generatedDataUrl = await generateBlogImage(prompt, false);
        uploaded = await uploadOrReuseImageAsset(String(generatedDataUrl || ''), filenamePrefix);
      }

      if (uploaded?.url) {
        replacements[prompt] = {
          url: uploaded.url,
          alt: buildInlineImageAltFromPrompt(prompt),
        };
      }
    }

    return replacements;
  };

  const preparePublishData = async (language: 'tr' | 'en', data?: PublishData) => {
    if (!data) {
      return null;
    }

    const inlineReplacements = await resolveInlineReplacements(language, data);
    const preparedContent = applyInlineImageUrlsToMarkdown(String(data.content || ''), inlineReplacements);
    const coverAssetRef = await resolveCoverAssetRef(language, data);

    return {
      prepared: {
        ...data,
        content: preparedContent,
      } as PublishData,
      coverAssetRef,
    };
  };

  const preparedTr = await preparePublishData('tr', payload.tr);
  if (preparedTr) {
    const trId = buildPostDocumentId(translationKey, 'tr');
    ids.push(trId);
    mutations.push({
      createOrReplace: buildPostDocument(
        'tr',
        translationKey,
        preparedTr.prepared,
        payload.categoryId,
        existingRecords.get(trId),
        preparedTr.coverAssetRef
      ),
    });
  }

  const preparedEn = await preparePublishData('en', payload.en);
  if (preparedEn) {
    const enId = buildPostDocumentId(translationKey, 'en');
    ids.push(enId);
    mutations.push({
      createOrReplace: buildPostDocument(
        'en',
        translationKey,
        preparedEn.prepared,
        payload.categoryId,
        existingRecords.get(enId),
        preparedEn.coverAssetRef
      ),
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
