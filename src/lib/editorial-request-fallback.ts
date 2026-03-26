export function shouldLoadEditorialSnapshot(action: string) {
  return (
    action === 'generate-topic-ideas' ||
    action === 'generate-blog-post' ||
    action === 'add-internal-links' ||
    action === 'edit-blog-post'
  );
}

export function shouldRequireEditorialCategories(action: string) {
  return action === 'generate-topic-ideas' || action === 'generate-blog-post';
}

export function preferNonEmptyArray<T>(preferred: T[] | null | undefined, fallback: T[] | null | undefined): T[] {
  if (Array.isArray(preferred) && preferred.length > 0) {
    return preferred;
  }

  return Array.isArray(fallback) ? fallback : [];
}

export function preferInternalLinkTargets<T extends { slug?: string | null }>(
  preferred: T[] | null | undefined,
  fallback: T[] | null | undefined
): Array<T & { slug: string }> {
  return preferNonEmptyArray(preferred, fallback).filter((item): item is T & { slug: string } => {
    return typeof item.slug === 'string' && item.slug.trim().length > 0;
  });
}
