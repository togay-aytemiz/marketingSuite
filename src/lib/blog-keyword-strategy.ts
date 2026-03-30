import type { BlogKeywordStrategy } from '../types';

const KEYWORD_LIMITS = {
  primaryKeyword: 1,
  secondaryKeywords: 6,
  supportKeywords: 10,
  longTailKeywords: 8,
  semanticKeywords: 15,
} as const;

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKeywordComparisonKey(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function createEmptyBlogKeywordStrategy(): BlogKeywordStrategy {
  return {
    primaryKeyword: '',
    secondaryKeywords: [],
    supportKeywords: [],
    longTailKeywords: [],
    semanticKeywords: [],
  };
}

export function parseKeywordInput(value: unknown, maxItems = 10) {
  const rawItems = Array.isArray(value)
    ? value.flatMap((item) => typeof item === 'string' ? [item] : [])
    : String(value || '').split(/[,\n;|]/);

  const items: string[] = [];
  const seen = new Set<string>();

  for (const rawItem of rawItems) {
    const normalized = normalizeWhitespace(rawItem);
    const key = normalizeKeywordComparisonKey(normalized);

    if (!normalized || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(normalized);

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

export function normalizeBlogKeywordStrategy(
  value: Partial<BlogKeywordStrategy> | null | undefined,
  fallbackKeywords?: string | null
) {
  const strategy = createEmptyBlogKeywordStrategy();
  const fallbackItems = parseKeywordInput(fallbackKeywords, 8);

  strategy.primaryKeyword = parseKeywordInput(
    value?.primaryKeyword,
    KEYWORD_LIMITS.primaryKeyword
  )[0] || fallbackItems[0] || '';
  strategy.secondaryKeywords = parseKeywordInput(
    value?.secondaryKeywords,
    KEYWORD_LIMITS.secondaryKeywords
  );
  strategy.supportKeywords = parseKeywordInput(
    value?.supportKeywords,
    KEYWORD_LIMITS.supportKeywords
  );
  strategy.longTailKeywords = parseKeywordInput(
    value?.longTailKeywords,
    KEYWORD_LIMITS.longTailKeywords
  );
  strategy.semanticKeywords = parseKeywordInput(
    value?.semanticKeywords,
    KEYWORD_LIMITS.semanticKeywords
  );

  if (strategy.secondaryKeywords.length === 0 && fallbackItems.length > 1) {
    strategy.secondaryKeywords = fallbackItems.slice(1, 5);
  }

  return strategy;
}

export function buildKeywordSummaryFromStrategy(strategy: Partial<BlogKeywordStrategy> | null | undefined, maxItems = 8) {
  const normalized = normalizeBlogKeywordStrategy(strategy);
  const summary: string[] = [];
  const seen = new Set<string>();

  const add = (items: string[]) => {
    for (const item of items) {
      const normalizedItem = normalizeWhitespace(item);
      const key = normalizeKeywordComparisonKey(normalizedItem);
      if (!normalizedItem || !key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      summary.push(normalizedItem);

      if (summary.length >= maxItems) {
        return;
      }
    }
  };

  add([normalized.primaryKeyword]);
  add(normalized.secondaryKeywords);
  add(normalized.supportKeywords);
  add(normalized.longTailKeywords);

  return summary;
}

export function buildKeywordSummaryText(strategy: Partial<BlogKeywordStrategy> | null | undefined, maxItems = 8) {
  return buildKeywordSummaryFromStrategy(strategy, maxItems).join(', ');
}

export function hasBlogKeywordStrategy(strategy: Partial<BlogKeywordStrategy> | null | undefined) {
  const normalized = normalizeBlogKeywordStrategy(strategy);
  return Boolean(
    normalized.primaryKeyword
    || normalized.secondaryKeywords.length > 0
    || normalized.supportKeywords.length > 0
    || normalized.longTailKeywords.length > 0
    || normalized.semanticKeywords.length > 0
  );
}

export function keywordStrategiesEqual(
  left: Partial<BlogKeywordStrategy> | null | undefined,
  right: Partial<BlogKeywordStrategy> | null | undefined
) {
  const a = normalizeBlogKeywordStrategy(left);
  const b = normalizeBlogKeywordStrategy(right);

  return a.primaryKeyword === b.primaryKeyword
    && JSON.stringify(a.secondaryKeywords) === JSON.stringify(b.secondaryKeywords)
    && JSON.stringify(a.supportKeywords) === JSON.stringify(b.supportKeywords)
    && JSON.stringify(a.longTailKeywords) === JSON.stringify(b.longTailKeywords)
    && JSON.stringify(a.semanticKeywords) === JSON.stringify(b.semanticKeywords);
}

export function formatKeywordStrategyFieldValue(items: string[]) {
  return items.join('\n');
}
