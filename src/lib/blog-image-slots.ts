export interface BlogInlineImagePlan {
  slotId?: string;
  prompt: string;
  altText?: string;
  dataUrl?: string;
}

export const BLOG_IMAGE_SLOT_REGEX = /<!--\s*BLOG_IMAGE:\s*([a-zA-Z0-9_-]+)\s*-->/gi;
export const LEGACY_IMAGE_PROMPT_REGEX = /\[IMAGE_PROMPT:\s*([^\]]+?)\s*\]/gi;

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeBlogImageSlotId(slotId: string | null | undefined) {
  const normalized = normalizeWhitespace(String(slotId || ''))
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)+/g, '');

  return normalized;
}

export function buildBlogImageSlotMarker(slotId: string) {
  const normalized = normalizeBlogImageSlotId(slotId) || 'image-1';
  return `<!-- BLOG_IMAGE:${normalized} -->`;
}

export function extractBlogImageSlotIds(content: string | null | undefined) {
  const value = String(content || '');
  const ids: string[] = [];
  let match = BLOG_IMAGE_SLOT_REGEX.exec(value);

  while (match) {
    const slotId = normalizeBlogImageSlotId(match[1]);
    if (slotId) {
      ids.push(slotId);
    }
    match = BLOG_IMAGE_SLOT_REGEX.exec(value);
  }

  BLOG_IMAGE_SLOT_REGEX.lastIndex = 0;
  return Array.from(new Set(ids));
}

export function extractLegacyImagePrompts(content: string | null | undefined) {
  const value = String(content || '');
  const prompts: string[] = [];
  let match = LEGACY_IMAGE_PROMPT_REGEX.exec(value);

  while (match) {
    const prompt = normalizeWhitespace(String(match[1] || ''));
    if (prompt) {
      prompts.push(prompt);
    }
    match = LEGACY_IMAGE_PROMPT_REGEX.exec(value);
  }

  LEGACY_IMAGE_PROMPT_REGEX.lastIndex = 0;
  return Array.from(new Set(prompts));
}

export function getBlogInlineImageKey(image: Pick<BlogInlineImagePlan, 'slotId' | 'prompt'>) {
  const slotId = normalizeBlogImageSlotId(image.slotId);
  if (slotId) {
    return slotId;
  }

  return normalizeWhitespace(String(image.prompt || ''));
}
