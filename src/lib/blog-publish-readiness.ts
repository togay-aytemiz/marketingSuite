import { hasFinalCallToAction as hasFinalCallToActionImpl } from './blog-call-to-action';

export type ReadinessTone = 'success' | 'warning' | 'blocked';

export interface ReadinessCategoryMeta {
  id: string;
  name?: string;
  resolvedBy?: string;
  confidence?: 'high' | 'medium' | 'low';
  fallbackReason?: string | null;
}

export interface PublishReadinessInput {
  language: 'TR' | 'EN' | 'BOTH';
  title?: string | null;
  titleEN?: string | null;
  description?: string | null;
  descriptionEN?: string | null;
  content?: string | null;
  contentEN?: string | null;
  category?: ReadinessCategoryMeta | null;
  coverReady: boolean;
  coverReadyEN?: boolean;
  inlineImageCount: number;
  inlineReadyCount: number;
  autoInternalLinks: boolean;
  sanityConfigured: boolean;
}

export interface PublishReadinessItem {
  key:
    | 'title'
    | 'description'
    | 'category'
    | 'category-confidence'
    | 'cover'
    | 'inline-images'
    | 'cta'
    | 'internal-links'
    | 'language-completeness';
  label: string;
  ok: boolean;
  blocking: boolean;
  tone: ReadinessTone;
  message: string;
}

export interface PublishReadinessResult {
  canPublish: boolean;
  blockingCount: number;
  warningCount: number;
  items: PublishReadinessItem[];
}

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function createItem(
  key: PublishReadinessItem['key'],
  label: string,
  ok: boolean,
  blocking: boolean,
  message: string,
  tone?: ReadinessTone
): PublishReadinessItem {
  return {
    key,
    label,
    ok,
    blocking,
    tone: tone || (ok ? 'success' : blocking ? 'blocked' : 'warning'),
    message,
  };
}

export function extractMarkdownLinkCount(content: string | null | undefined) {
  const matches = String(content || '').match(/\[[^\]]+]\((\/blog\/[^)\s]+)\)/g);
  return matches?.length || 0;
}

export function hasFinalCallToAction(content: string | null | undefined, language: 'TR' | 'EN') {
  return hasFinalCallToActionImpl(content, language);
}

export function buildPublishReadiness(input: PublishReadinessInput): PublishReadinessResult {
  const title = normalizeWhitespace(input.title);
  const titleEN = normalizeWhitespace(input.titleEN);
  const description = normalizeWhitespace(input.description);
  const descriptionEN = normalizeWhitespace(input.descriptionEN);
  const content = String(input.content || '');
  const contentEN = String(input.contentEN || '');
  const primaryTitle = input.language === 'EN' ? titleEN || title : title;
  const primaryDescription = input.language === 'EN' ? descriptionEN || description : description;
  const titleOk = Boolean(primaryTitle) && primaryTitle.length <= 70;
  const descriptionOk = Boolean(primaryDescription) && primaryDescription.length <= 160;
  const categoryOk = Boolean(normalizeWhitespace(input.category?.id));
  const categoryConfidence = input.category?.confidence || 'low';
  const ctaOk =
    input.language === 'TR'
      ? hasFinalCallToActionImpl(content, 'TR')
      : input.language === 'EN'
        ? hasFinalCallToActionImpl(contentEN || content, 'EN')
        : hasFinalCallToActionImpl(content, 'TR') && hasFinalCallToActionImpl(contentEN, 'EN');
  const coverOk =
    input.language === 'EN'
      ? Boolean(input.coverReadyEN || input.coverReady)
      : input.coverReady && (input.language !== 'BOTH' || Boolean(input.coverReadyEN));
  const inlineOk = input.inlineReadyCount >= input.inlineImageCount;
  const linkCount =
    input.language === 'EN'
      ? extractMarkdownLinkCount(contentEN || content)
      : extractMarkdownLinkCount(content) + (input.language === 'BOTH' ? extractMarkdownLinkCount(contentEN) : 0);
  const bilingualOk =
    input.language !== 'BOTH' ||
    (Boolean(titleEN) && titleEN.length <= 70 && Boolean(descriptionEN) && descriptionEN.length <= 160 && Boolean(normalizeWhitespace(contentEN)));

  const items: PublishReadinessItem[] = [
    createItem(
      'title',
      'SEO title',
      titleOk && (input.language !== 'BOTH' || Boolean(titleEN) && titleEN.length <= 70),
      true,
      titleOk
        ? input.language === 'BOTH'
          ? 'TR and EN titles are within 70 characters.'
          : 'Title is within the 70 character limit.'
        : 'Title must be at most 70 characters.'
    ),
    createItem(
      'description',
      'Meta description',
      descriptionOk && (input.language !== 'BOTH' || Boolean(descriptionEN) && descriptionEN.length <= 160),
      true,
      descriptionOk
        ? input.language === 'BOTH'
          ? 'TR and EN descriptions are within 160 characters.'
          : 'Description is within the 160 character limit.'
        : 'Add a concise description within 160 characters.'
    ),
    createItem(
      'category',
      'Category resolution',
      categoryOk,
      true,
      categoryOk
        ? `${input.category?.name || 'Category'} selected.`
        : 'Resolve the article category before publishing.'
    ),
    createItem(
      'category-confidence',
      'Category confidence',
      categoryOk && categoryConfidence === 'high',
      false,
      categoryOk
        ? categoryConfidence === 'high'
          ? 'Category matched with high confidence.'
          : input.category?.fallbackReason || 'Category was assigned with fallback logic; review before publish.'
        : 'No category confidence available.',
      categoryOk && categoryConfidence === 'high' ? 'success' : 'warning'
    ),
    createItem(
      'cover',
      'Cover image',
      coverOk,
      true,
      coverOk ? 'Cover image is ready.' : 'Generate or upload the cover image before publishing.'
    ),
    createItem(
      'inline-images',
      'Inline media',
      inlineOk,
      true,
      input.inlineImageCount === 0
        ? 'No inline images are required for this draft.'
        : inlineOk
          ? `${input.inlineReadyCount}/${input.inlineImageCount} inline visuals are ready.`
          : `${input.inlineReadyCount}/${input.inlineImageCount} inline visuals are ready.`
    ),
    createItem(
      'cta',
      'Final CTA',
      ctaOk,
      true,
      ctaOk ? 'The article ends with a CTA section.' : 'Add or restore the final CTA section.'
    ),
    createItem(
      'internal-links',
      'Internal links',
      !input.autoInternalLinks || !input.sanityConfigured || linkCount > 0,
      false,
      !input.autoInternalLinks || !input.sanityConfigured
        ? 'Internal links are optional in the current configuration.'
        : `${linkCount} internal blog link${linkCount === 1 ? '' : 's'} detected.`,
      !input.autoInternalLinks || !input.sanityConfigured || linkCount > 0 ? 'success' : 'warning'
    ),
    createItem(
      'language-completeness',
      'Language completeness',
      bilingualOk,
      true,
      input.language === 'BOTH'
        ? bilingualOk
          ? 'TR and EN variants are complete.'
          : 'Complete both TR and EN fields before publishing.'
        : 'Single-language draft is complete.'
    ),
  ];

  const blockingCount = items.filter((item) => item.blocking && !item.ok).length;
  const warningCount = items.filter((item) => !item.blocking && item.tone === 'warning').length;

  return {
    canPublish: blockingCount === 0,
    blockingCount,
    warningCount,
    items,
  };
}
