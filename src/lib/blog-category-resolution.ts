export interface DraftCategoryOption {
  id: string;
  name: string;
}

export interface DraftRecentCategoryReference {
  title?: string;
  category?: string;
  categoryId?: string;
}

export interface DraftResolvedCategory {
  id: string;
  name: string;
  resolvedBy: 'exact-id' | 'exact-name' | 'slug-match' | 'fallback-balance';
  confidence: 'high' | 'medium' | 'low';
  fallbackReason: string | null;
}

const CATEGORY_SLUG_CHAR_MAP: Record<string, string> = {
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

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeCategoryLookupKey(value: string | null | undefined) {
  const normalized = normalizeWhitespace(String(value || ''))
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => CATEGORY_SLUG_CHAR_MAP[char] || char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalized
    .replace(/^category[.:/_-]?/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function normalizeCategoryOptions(categories: DraftCategoryOption[] = []) {
  return categories
    .map((category) => ({
      id: normalizeWhitespace(category.id),
      name: normalizeWhitespace(category.name),
    }))
    .filter((category) => category.id && category.name);
}

export function resolveDraftCategory(input: {
  rawCategoryId: string | null | undefined;
  sanityCategories: DraftCategoryOption[];
  recentPosts: DraftRecentCategoryReference[];
}): DraftResolvedCategory | null {
  const normalizedCategories = normalizeCategoryOptions(input.sanityCategories);

  if (normalizedCategories.length === 0) {
    return null;
  }

  const candidate = normalizeWhitespace(input.rawCategoryId);
  const candidateLookup = normalizeCategoryLookupKey(candidate);

  const exactMatch = normalizedCategories.find((category) => category.id === candidate);
  if (exactMatch) {
    return {
      id: exactMatch.id,
      name: exactMatch.name,
      resolvedBy: 'exact-id',
      confidence: 'high',
      fallbackReason: null,
    };
  }

  const byName = normalizedCategories.find((category) => category.name.toLowerCase() === candidate.toLowerCase());
  if (byName) {
    return {
      id: byName.id,
      name: byName.name,
      resolvedBy: 'exact-name',
      confidence: 'high',
      fallbackReason: null,
    };
  }

  if (candidateLookup) {
    const byLookup = normalizedCategories.find((category) => {
      const lookupKeys = new Set<string>([
        normalizeCategoryLookupKey(category.id),
        normalizeCategoryLookupKey(category.name),
        normalizeCategoryLookupKey(category.id.split('.').pop() || ''),
      ]);

      return lookupKeys.has(candidateLookup);
    });

    if (byLookup) {
      return {
        id: byLookup.id,
        name: byLookup.name,
        resolvedBy: 'slug-match',
        confidence: 'medium',
        fallbackReason: 'Model returned a slug-like category value, mapped to the closest Sanity category.',
      };
    }
  }

  const countsById = new Map<string, number>();
  const countsByName = new Map<string, number>();
  for (const post of input.recentPosts) {
    const categoryId = normalizeWhitespace(post.categoryId).toLowerCase();
    if (categoryId) {
      countsById.set(categoryId, (countsById.get(categoryId) || 0) + 1);
      continue;
    }

    const categoryName = normalizeWhitespace(post.category).toLowerCase();
    if (!categoryName) {
      continue;
    }

    countsByName.set(categoryName, (countsByName.get(categoryName) || 0) + 1);
  }

  const fallback = [...normalizedCategories].sort((left, right) => {
    const leftCount = countsById.get(left.id.toLowerCase()) || countsByName.get(left.name.toLowerCase()) || 0;
    const rightCount = countsById.get(right.id.toLowerCase()) || countsByName.get(right.name.toLowerCase()) || 0;

    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }

    return left.name.localeCompare(right.name);
  })[0];

  if (!fallback) {
    return null;
  }

  return {
    id: fallback.id,
    name: fallback.name,
    resolvedBy: 'fallback-balance',
    confidence: 'low',
    fallbackReason: 'Model category was invalid, so the least-covered matching category was selected automatically.',
  };
}
