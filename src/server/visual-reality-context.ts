import fs from 'node:fs';
import path from 'node:path';

export interface VisualRealityContextPromptInput {
  sourcePaths: string[];
  facts: string[];
}

export interface VisualRealityContextSnapshot extends VisualRealityContextPromptInput {
  available: boolean;
  promptText: string;
}

const REPO_CONTEXT_ENV_VARS = [
  'VISUAL_CONTEXT_REPO_PATHS',
  'LEADQUALIFIER_PATH',
  'QUALY_PRODUCT_PATH',
  'QUALY_LP_PATH',
] as const;

const FILE_CANDIDATES = [
  '.agents/product-marketing-context.md',
  'docs/PRD.md',
  'docs/ROADMAP.md',
  'docs/RELEASE.md',
  'docs/marketing_product_context.md',
  'LanguageContext.tsx',
  path.join('components', 'Features.tsx'),
] as const;

const CHANNEL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'WhatsApp', pattern: /\bwhatsapp\b/i },
  { label: 'Instagram', pattern: /\binstagram\b/i },
  { label: 'Messenger', pattern: /\bmessenger\b/i },
  { label: 'Telegram', pattern: /\btelegram\b/i },
];

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function dedupeList(items: string[], limit = 20) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const item of items) {
    const normalized = normalizeLine(item);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);

    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function parseEnvRepoPaths(baseDir: string) {
  const collected: string[] = [];

  for (const envVar of REPO_CONTEXT_ENV_VARS) {
    const raw = String(process.env[envVar] || '').trim();
    if (!raw) {
      continue;
    }

    for (const chunk of raw.split(',')) {
      const normalized = chunk.trim();
      if (!normalized) {
        continue;
      }

      collected.push(path.resolve(baseDir, normalized));
    }
  }

  return collected;
}

function resolveCandidateRepoRoots(baseDir: string) {
  const homeDir = process.env.HOME ? path.resolve(process.env.HOME) : '';

  return dedupeList(
    [
      ...parseEnvRepoPaths(baseDir),
      path.resolve(baseDir, '../leadqualifier'),
      homeDir ? path.resolve(homeDir, 'Desktop/leadqualifier') : '',
      path.resolve(baseDir, '../Qualy-lp'),
      homeDir ? path.resolve(homeDir, 'Desktop/Qualy-lp') : '',
    ].filter(Boolean),
    20
  );
}

function collectExistingContextFiles(repoRoot: string) {
  return FILE_CANDIDATES
    .map((relativePath) => path.join(repoRoot, relativePath))
    .filter((filePath) => fs.existsSync(filePath));
}

function readFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function joinLabels(items: string[]) {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function extractRealityFacts(markdownOrCode: string) {
  const normalized = normalizeLine(markdownOrCode);
  const lower = normalized.toLowerCase();
  const facts: string[] = [];

  if (
    /lead score\s*\(0\s*-\s*10\)/i.test(normalized)
    || /\b0\s*-\s*10 scoring algorithm\b/i.test(normalized)
    || /\bscores intent\s*1\s*-\s*10\b/i.test(normalized)
    || /\bscore(?: runs| range|s)? from\s*0?\s*to\s*10\b/i.test(normalized)
    || /\b0\s*-\s*10 arası\b/i.test(normalized)
  ) {
    facts.push('Lead scoring uses a 0-10 scale in shipped product surfaces: 0-10, not 0-100. Do not depict percentile dashboards.');
  }

  if (/\bhot\b/.test(lower) && /\bwarm\b/.test(lower) && /\bcold\b/.test(lower)) {
    facts.push('Lead priority states are hot, warm, cold.');
  }

  if (
    /\bnone\b/.test(lower)
    && /\binformational_commercial\b/.test(lower)
    && /\bqualification\b/.test(lower)
    && /\bbooking_ready\b/.test(lower)
  ) {
    facts.push('Semantic intent stages in the current product logic: none, informational_commercial, qualification, booking_ready.');
  }

  const channels = CHANNEL_PATTERNS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label);
  if (channels.length >= 2) {
    facts.push(`Messaging channels repeated across shipped files: ${joinLabels(channels)}.`);
  }

  if (/skills\s*\+\s*knowledge\s*base/i.test(normalized)) {
    facts.push('Current product framing repeats Skills + Knowledge Base as the automation layer.');
  }

  if (/\bhands chats to your team\b/i.test(normalized) || /\bhandoff\b/i.test(lower) || /\bescalation\b/i.test(lower)) {
    facts.push('Current product framing includes team handoff when conversation priority is high.');
  }

  if (
    /\bqualy\s+ai\b/i.test(normalized)
    && (
      /\bai-powered unified inbox\b/i.test(normalized)
      || /\bunified inbox\b/i.test(normalized)
      || /\btek gelen kutusu\b/i.test(lower)
    )
  ) {
    facts.push('Launch/social visuals should frame the AI actor as Qualy AI managing an AI-powered unified inbox, not as a generic shared inbox or human assistant.');
  }

  if (/\bqualy\b/i.test(normalized) && /\bwordmark\b|\blogo\b/i.test(normalized)) {
    facts.push('Launch/social visuals should keep a visible Qualy wordmark or logo when brand context is required, using official brand references instead of invented logo forms.');
  }

  if (/\bqualy\s+ai\b/i.test(normalized) && (/\bassistant\b/i.test(normalized) || /\basistan\b/i.test(lower) || /\bhuman avatar\b/i.test(normalized))) {
    facts.push('When an AI actor is shown, label it Qualy AI or AI request summary; do not use a human avatar or bare Assistant/asistan labels.');
  }

  if (
    CHANNEL_PATTERNS.every(({ pattern }) => pattern.test(normalized))
    && (
      /\bthreads\b/i.test(normalized)
      || /\bx\/twitter\b/i.test(normalized)
      || /\bemail\b/i.test(normalized)
      || /\be-posta\b/i.test(lower)
      || /\bgeneric chat\b/i.test(normalized)
      || /\brandom chat\b/i.test(normalized)
      || /\bextra social logos?\b/i.test(normalized)
    )
  ) {
    facts.push('When channel coverage is shown, use exactly WhatsApp, Instagram, Telegram, and Messenger; do not add Threads, X/Twitter, email, generic chat icons, or extra social logos.');
  }

  return dedupeList(facts, 12);
}

export function buildVisualRealityContextPromptText(input: VisualRealityContextPromptInput) {
  const facts = dedupeList(input.facts || [], 12);
  if (facts.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push('Shipped Product Facts:');
  for (const fact of facts) {
    lines.push(`- ${fact}`);
  }

  return lines.join('\n');
}

export function getVisualRealityContextSnapshot(baseDir = process.cwd()): VisualRealityContextSnapshot {
  const sourcePaths: string[] = [];
  const collectedTexts: string[] = [];

  for (const repoRoot of resolveCandidateRepoRoots(baseDir)) {
    const files = collectExistingContextFiles(repoRoot);
    if (files.length === 0) {
      continue;
    }

    sourcePaths.push(repoRoot);

    for (const filePath of files) {
      collectedTexts.push(readFileIfExists(filePath));
    }
  }

  const facts = extractRealityFacts(collectedTexts.join('\n'));
  const dedupedFacts = dedupeList(facts, 12);
  const dedupedSourcePaths = dedupeList(sourcePaths, 8);
  const promptText = buildVisualRealityContextPromptText({
    sourcePaths: dedupedSourcePaths,
    facts: dedupedFacts,
  });

  return {
    available: dedupedFacts.length > 0,
    sourcePaths: dedupedSourcePaths,
    facts: dedupedFacts,
    promptText,
  };
}
