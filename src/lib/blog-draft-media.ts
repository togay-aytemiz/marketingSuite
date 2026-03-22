import {
  BLOG_IMAGE_SLOT_REGEX,
  LEGACY_IMAGE_PROMPT_REGEX,
  buildBlogImageSlotMarker,
  extractBlogImageSlotIds,
  getBlogInlineImageKey,
  normalizeBlogImageSlotId,
  type BlogInlineImagePlan,
} from './blog-image-slots';

const ORPHAN_BRACKET_LINE_REGEX = /^[\[\]\(\)\{\}]+$/;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\((?:[^()\n]|\([^)\n]*\))*\)/g;
const HTML_IMAGE_REGEX = /<img\b[^>]*>/gi;
const OUTER_MARKDOWN_FENCE_REGEX = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n?```\s*$/i;
const UNICODE_MARKDOWN_SPACE_REGEX = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const ZERO_WIDTH_MARKDOWN_CHAR_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;

function normalizeWhitespace(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMarkdownWhitespace(value: string | null | undefined) {
  return String(value || '')
    .replace(ZERO_WIDTH_MARKDOWN_CHAR_REGEX, '')
    .replace(UNICODE_MARKDOWN_SPACE_REGEX, ' ');
}

function dedentSharedMarkdownIndentation(value: string) {
  const lines = String(value || '').split('\n');
  const indentationLevels = lines
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^[ \t]+/);
      if (!match) {
        return 0;
      }

      return match[0].replace(/\t/g, '  ').length;
    })
    .filter((indentation) => indentation > 0);

  if (indentationLevels.length === 0) {
    return String(value || '');
  }

  const sharedIndentation = Math.min(...indentationLevels);
  if (sharedIndentation < 2) {
    return String(value || '');
  }

  return lines
    .map((line) => {
      if (!line.trim()) {
        return '';
      }

      let remaining = sharedIndentation;
      let index = 0;
      while (remaining > 0 && index < line.length) {
        if (line[index] === '\t') {
          remaining -= 2;
        } else if (line[index] === ' ') {
          remaining -= 1;
        } else {
          break;
        }
        index += 1;
      }

      return line.slice(index);
    })
    .join('\n');
}

function normalizeStructuralMarkdownIndentation(value: string) {
  return String(value || '')
    .split('\n')
    .map((line) => {
      if (!line.trim()) {
        return '';
      }

      if (/^[ \t]+(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)/.test(line)) {
        return line.trimStart();
      }

      return line;
    })
    .join('\n');
}

export function stripOuterMarkdownFence(value: string | null | undefined) {
  let normalized = String(value || '').trim();

  while (true) {
    let changed = false;
    const match = normalized.match(OUTER_MARKDOWN_FENCE_REGEX);
    if (match) {
      normalized = String(match[1] || '').trim();
      changed = true;
    }

    const lines = normalized.replace(/\r\n/g, '\n').split('\n');
    const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
    if (
      firstContentIndex >= 0 &&
      /^```(?:markdown|md)?\s*$/i.test(lines[firstContentIndex]!.trim())
    ) {
      lines.splice(firstContentIndex, 1);
      normalized = lines.join('\n').trim();
      changed = true;
    }

    const trailingLines = normalized.replace(/\r\n/g, '\n').split('\n');
    for (let index = trailingLines.length - 1; index >= 0; index -= 1) {
      const line = trailingLines[index]!.trim();
      if (!line) {
        continue;
      }
      if (/^```\s*$/.test(line)) {
        trailingLines.splice(index, 1);
        normalized = trailingLines.join('\n').trim();
        changed = true;
      }
      break;
    }

    if (!changed) {
      return normalized;
    }
  }
}

export function normalizeEditorialMarkdown(value: string | null | undefined) {
  return normalizeStructuralMarkdownIndentation(
    dedentSharedMarkdownIndentation(normalizeMarkdownWhitespace(stripOuterMarkdownFence(value)))
  );
}

function stripMarkdownFormatting(value: string) {
  return normalizeWhitespace(
    String(value || '')
      .replace(/[#>*_`[\]()!-]/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function buildInlineAltText(prompt: string) {
  const normalized = normalizeWhitespace(prompt).replace(/["'`]/g, '');
  return normalized || 'Blog image';
}

function getNextSlotId(usedSlotIds: Set<string>) {
  let counter = 1;
  while (usedSlotIds.has(`image-${counter}`)) {
    counter += 1;
  }
  return `image-${counter}`;
}

export function cleanDraftMarkdownArtifacts(value: string | null | undefined) {
  return normalizeEditorialMarkdown(value)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !ORPHAN_BRACKET_LINE_REGEX.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function buildArticlePreviewMarkdown(value: string | null | undefined) {
  return cleanDraftMarkdownArtifacts(
    String(value || '')
      .replace(BLOG_IMAGE_SLOT_REGEX, '\n')
      .replace(LEGACY_IMAGE_PROMPT_REGEX, '\n')
      .replace(MARKDOWN_IMAGE_REGEX, '\n')
      .replace(HTML_IMAGE_REGEX, '\n')
  );
}

export function sanitizeEditorialPromptText(prompt: string | null | undefined) {
  let sanitized = normalizeWhitespace(String(prompt || ''));

  sanitized = sanitized
    .replace(/\bwith\s+[^.]*?\blogos?\b/gi, '')
    .replace(/\bfeaturing\s+[^.]*?\blogos?\b/gi, '')
    .replace(/\blogos?\b/gi, 'brandless motifs')
    .replace(/\bapp icons?\b/gi, 'abstract platform motifs')
    .replace(/\bicons?\b/gi, 'abstract motifs')
    .replace(/\bvibrant colors?\b/gi, 'controlled premium palette')
    .replace(/\bglowing ui cards?\b/gi, 'subtle spatial layers')
    .replace(/\bui mockups?\b/gi, 'abstract interface metaphors')
    .replace(/\bscreenshots?\b/gi, 'abstract editorial composition');

  sanitized = sanitized
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s+\./g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();

  return sanitized || 'Minimal editorial B2B concept visual';
}

export function migrateLegacyImagePromptsToSlots(
  content: string | null | undefined,
  inlineImages: BlogInlineImagePlan[]
) {
  const usedSlotIds = new Set<string>([
    ...extractBlogImageSlotIds(content),
    ...inlineImages
      .map((image) => normalizeBlogImageSlotId(image.slotId))
      .filter(Boolean) as string[],
  ]);

  const nextInlineImages: BlogInlineImagePlan[] = inlineImages.map((image) => ({
    ...image,
    slotId: normalizeBlogImageSlotId(image.slotId) || image.slotId,
    prompt: sanitizeEditorialPromptText(image.prompt),
    altText: normalizeWhitespace(image.altText || buildInlineAltText(image.prompt)),
  }));

  const normalizedByKey = new Map<string, BlogInlineImagePlan>();
  for (const image of nextInlineImages) {
    const key = getBlogInlineImageKey(image);
    if (key && !normalizedByKey.has(key)) {
      normalizedByKey.set(key, image);
    }
  }

  let normalizedContent = cleanDraftMarkdownArtifacts(content);
  normalizedContent = normalizedContent.replace(LEGACY_IMAGE_PROMPT_REGEX, (_whole, rawPrompt) => {
    const sanitizedPrompt = sanitizeEditorialPromptText(rawPrompt);
    const existingImage =
      normalizedByKey.get(sanitizedPrompt) ||
      nextInlineImages.find((image) => normalizeWhitespace(image.prompt) === normalizeWhitespace(rawPrompt));

    const slotId = normalizeBlogImageSlotId(existingImage?.slotId) || getNextSlotId(usedSlotIds);
    usedSlotIds.add(slotId);

    const mergedImage: BlogInlineImagePlan = {
      slotId,
      prompt: sanitizedPrompt,
      altText: normalizeWhitespace(existingImage?.altText || buildInlineAltText(sanitizedPrompt)),
      dataUrl: existingImage?.dataUrl,
    };

    normalizedByKey.set(slotId, mergedImage);
    nextInlineImages.push(mergedImage);

    return buildBlogImageSlotMarker(slotId);
  });

  normalizedContent = cleanDraftMarkdownArtifacts(normalizedContent).replace(BLOG_IMAGE_SLOT_REGEX, (_whole, rawSlotId) =>
    buildBlogImageSlotMarker(rawSlotId)
  );

  const contentSlotIds = new Set(extractBlogImageSlotIds(normalizedContent));
  const finalInlineImages = Array.from(normalizedByKey.values())
    .filter((image) => {
      const slotId = normalizeBlogImageSlotId(image.slotId);
      return slotId ? contentSlotIds.has(slotId) : false;
    })
    .map((image) => ({
      ...image,
      slotId: normalizeBlogImageSlotId(image.slotId) || image.slotId,
      prompt: sanitizeEditorialPromptText(image.prompt),
      altText: normalizeWhitespace(image.altText || buildInlineAltText(image.prompt)),
    }));

  return {
    content: normalizedContent,
    inlineImages: finalInlineImages,
  };
}

export interface InlineImagePlacementSummary {
  slotId: string;
  heading: string;
  context: string;
  order: number;
}

function findLastHeading(value: string) {
  const matches = Array.from(String(value || '').matchAll(/^##+\s+(.+)$/gm));
  const last = matches[matches.length - 1];
  return stripMarkdownFormatting(last?.[1] || '') || 'Inline image';
}

function findFirstContextParagraph(value: string) {
  const lines = buildArticlePreviewMarkdown(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) {
      continue;
    }

    const normalized = stripMarkdownFormatting(line);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export function buildInlineImagePlacementSummaries(content: string | null | undefined): InlineImagePlacementSummary[] {
  const rawContent = String(content || '');
  const slotRegex = new RegExp(BLOG_IMAGE_SLOT_REGEX.source, BLOG_IMAGE_SLOT_REGEX.flags);
  const placements: InlineImagePlacementSummary[] = [];
  let match = slotRegex.exec(rawContent);
  let order = 0;

  while (match) {
    const slotId = normalizeBlogImageSlotId(match[1]) || String(match[1] || '').trim();
    const before = rawContent.slice(0, match.index);
    const after = rawContent.slice(match.index + match[0].length);
    const heading = findLastHeading(before);
    const context = findFirstContextParagraph(after) || findFirstContextParagraph(before) || 'Context not found yet.';

    if (slotId) {
      placements.push({
        slotId,
        heading,
        context,
        order,
      });
      order += 1;
    }

    match = slotRegex.exec(rawContent);
  }

  return placements;
}
