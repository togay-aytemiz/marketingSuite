import fs from 'node:fs';
import path from 'node:path';

interface StrategyPromptInput {
  projectName: string;
  sourcePath: string | null;
  updateNotes: string[];
  inScopeFeatures: string[];
  roadmapCompletions: string[];
  focusKeywords: string[];
}

export interface StrategyContextSnapshot extends StrategyPromptInput {
  available: boolean;
  promptText: string;
}

const KEYWORD_STOP_WORDS = new Set([
  'about',
  'added',
  'after',
  'against',
  'already',
  'also',
  'and',
  'app',
  'are',
  'as',
  'before',
  'between',
  'but',
  'calendar',
  'cards',
  'channel',
  'channels',
  'copy',
  'docs',
  'for',
  'from',
  'full',
  'has',
  'have',
  'with',
  'when',
  'that',
  'this',
  'through',
  'into',
  'inside',
  'instead',
  'integration',
  'implemented',
  'inbox',
  'keep',
  'last',
  'latest',
  'line',
  'mark',
  'must',
  'new',
  'note',
  'now',
  'only',
  'operator',
  'phase',
  'roadmap',
  'scope',
  'settings',
  'should',
  'state',
  'status',
  'still',
  'surface',
  'surfaces',
  'the',
  'their',
  'there',
  'these',
  'use',
  'used',
  'using',
  'v1',
  'via',
  'was',
  'while',
  'without',
  'yeni',
  've',
  'ile',
  'bir',
  'icin',
  'olarak',
  'gibi',
  'artık',
  'daha',
  'sadece',
  'ama',
  'bu',
  'su',
  'icin',
  'de',
  'da',
  'mi',
  'mu',
  'mü',
  'ya',
  'veya',
  'notu',
  'guncelleme',
  'güncelleme',
  'durum',
  'uygulama',
  'uygulamalar',
  'takvim',
  'ai',
  'qualy',
  'whatsapp',
]);

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function dedupeList(items: string[], limit: number) {
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

function extractProjectName(markdown: string) {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  const heading = normalizeLine(headingMatch?.[1] || 'Leadqualifier');
  const withoutSuffix = normalizeLine(heading.split('—')[0] || heading.split('-')[0] || heading);
  return withoutSuffix || heading || 'Leadqualifier';
}

function extractKeywordCandidates(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ');

    for (const token of normalized.split(' ')) {
      const cleanToken = token.trim();
      if (!cleanToken || cleanToken.length < 4 || /^\d+$/.test(cleanToken)) {
        continue;
      }
      if (KEYWORD_STOP_WORDS.has(cleanToken)) {
        continue;
      }

      counts.set(cleanToken, (counts.get(cleanToken) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([token]) => token);
}

export function extractUpdateNotes(markdown: string, limit = 12) {
  const notes: string[] = [];
  const regex = /^\>\s+\*\*Update Note(?:\s*\([^)]+\))?:\*\*\s*(.+)$/gim;
  let match = regex.exec(markdown);

  while (match) {
    notes.push(match[1]);
    match = regex.exec(markdown);
  }

  return dedupeList(notes, limit);
}

export function extractInScopeFeatureNames(markdown: string, limit = 12) {
  const sectionMatch = markdown.match(/###\s*✅\s*In Scope[\s\S]*?(?=\n###\s|$)/i);
  const section = sectionMatch?.[0] || markdown;
  const featureNames: string[] = [];

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => normalizeLine(cell))
      .filter(Boolean);

    if (cells.length < 2) {
      continue;
    }

    const feature = cells[0];
    if (!feature || /^feature$/i.test(feature) || /^[-:]+$/.test(feature)) {
      continue;
    }

    featureNames.push(feature);
  }

  return dedupeList(featureNames, limit);
}

export function extractCompletedChecklistItems(markdown: string, limit = 24) {
  const items: string[] = [];
  const regex = /^\s*-\s*\[x\]\s+(.*)$/gim;
  let match = regex.exec(markdown);

  while (match) {
    items.push(match[1]);
    match = regex.exec(markdown);
  }

  return dedupeList(items, limit);
}

export function buildStrategyContextPromptText(input: StrategyPromptInput) {
  const lines: string[] = [];

  lines.push(`Source Product: ${input.projectName}`);
  if (input.sourcePath) {
    lines.push(`Docs Source: ${input.sourcePath}`);
  }

  if (input.updateNotes.length > 0) {
    lines.push('Latest Update Notes:');
    for (const note of input.updateNotes.slice(0, 8)) {
      lines.push(`- ${note}`);
    }
  }

  if (input.inScopeFeatures.length > 0) {
    lines.push('Current In-Scope Features:');
    for (const feature of input.inScopeFeatures.slice(0, 10)) {
      lines.push(`- ${feature}`);
    }
  }

  if (input.roadmapCompletions.length > 0) {
    lines.push('Roadmap Highlights (Completed):');
    for (const item of input.roadmapCompletions.slice(0, 10)) {
      lines.push(`- ${item}`);
    }
  }

  if (input.focusKeywords.length > 0) {
    lines.push(`Focus keywords: ${input.focusKeywords.join(', ')}`);
  }

  return lines.join('\n');
}

function resolveCandidateDocPaths(baseDir: string) {
  const homeDir = process.env.HOME ? path.resolve(process.env.HOME) : '';

  return dedupeList(
    [
      path.resolve(baseDir, '../leadqualifier/docs'),
      path.resolve(baseDir, '../desktop/leadqualifier/docs'),
      homeDir ? path.resolve(homeDir, 'Desktop/leadqualifier/docs') : '',
      path.resolve(baseDir, '../Qualy-lp/docs'),
      homeDir ? path.resolve(homeDir, 'Desktop/Qualy-lp/docs') : '',
    ].filter(Boolean),
    20
  );
}

function readMarkdownFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function resolveStrategyDocsRoot(baseDir: string) {
  for (const candidate of resolveCandidateDocPaths(baseDir)) {
    const hasPrd = fs.existsSync(path.join(candidate, 'PRD.md'));
    const hasRoadmap = fs.existsSync(path.join(candidate, 'ROADMAP.md'));
    if (hasPrd || hasRoadmap) {
      return candidate;
    }
  }

  return null;
}

export function getStrategyContextSnapshot(baseDir = process.cwd()): StrategyContextSnapshot {
  const docsRoot = resolveStrategyDocsRoot(baseDir);
  if (!docsRoot) {
    return {
      available: false,
      projectName: 'Leadqualifier',
      sourcePath: null,
      updateNotes: [],
      inScopeFeatures: [],
      roadmapCompletions: [],
      focusKeywords: [],
      promptText: '',
    };
  }

  const prdMarkdown = readMarkdownFileIfExists(path.join(docsRoot, 'PRD.md')) || '';
  const roadmapMarkdown = readMarkdownFileIfExists(path.join(docsRoot, 'ROADMAP.md')) || '';
  const combined = `${prdMarkdown}\n${roadmapMarkdown}`.trim();

  const projectName = extractProjectName(prdMarkdown || roadmapMarkdown || 'Leadqualifier');
  const updateNotes = dedupeList(
    [...extractUpdateNotes(prdMarkdown, 8), ...extractUpdateNotes(roadmapMarkdown, 8)],
    10
  );
  const inScopeFeatures = extractInScopeFeatureNames(prdMarkdown, 10);
  const roadmapCompletions = extractCompletedChecklistItems(roadmapMarkdown, 20);
  const focusKeywords = extractKeywordCandidates([...updateNotes, ...inScopeFeatures, ...roadmapCompletions]).slice(0, 16);

  const promptText = buildStrategyContextPromptText({
    projectName,
    sourcePath: docsRoot,
    updateNotes,
    inScopeFeatures,
    roadmapCompletions,
    focusKeywords,
  });

  return {
    available: combined.length > 0,
    projectName,
    sourcePath: docsRoot,
    updateNotes,
    inScopeFeatures,
    roadmapCompletions,
    focusKeywords,
    promptText,
  };
}
