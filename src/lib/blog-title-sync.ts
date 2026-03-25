function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function syncDraftTitleHeading(
  content: string | null | undefined,
  previousTitle: string | null | undefined,
  nextTitle: string | null | undefined
) {
  if (typeof content !== 'string' || !content) {
    return content ?? null;
  }

  const normalizedPreviousTitle = normalizeWhitespace(previousTitle);
  const normalizedNextTitle = normalizeWhitespace(nextTitle);

  if (!normalizedPreviousTitle || !normalizedNextTitle || normalizedPreviousTitle === normalizedNextTitle) {
    return content;
  }

  const escapedPreviousTitle = normalizedPreviousTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return content.replace(
    new RegExp(`^(#{1,3}\\s+)${escapedPreviousTitle}(\\s*(?:\\r?\\n|$))`, 'i'),
    `$1${normalizedNextTitle}$2`
  );
}
