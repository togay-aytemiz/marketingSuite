import { sanitizeEditorialPromptText } from './blog-draft-media';

const COVER_IMAGE_HOUSE_STYLE_LINES = [
  'Use the same visual family across all blog covers.',
  'Dark graphite to deep navy background with a soft cobalt-indigo glow.',
  'One large frosted glass tile, panel, or abstract system symbol as the hero subject.',
  'At most 1-2 small supporting glass chips, cards, or restrained accent forms.',
  'Generous negative space, restrained depth, rounded geometry, and calm studio lighting.',
  'No people, no crowds, no literal office scenes, no dashboards, no screenshots, and no sticker-like icon clouds.',
  'No visible text, no letters, no numbers, no logos, and no recognizable platform branding.',
  'Keep the composition elegant, minimal, and consistent from cover to cover.',
];

const INLINE_IMAGE_HOUSE_STYLE_LINES = [
  'Default to professional editorial photography for believable business, customer, industry, or operations scenarios.',
  'Use a clean simplified explainer card only when the section is about a framework, checklist, requirements, or comparison.',
  'If people appear, they must look like real adults in realistic professional environments.',
  'Use restrained composition, natural lighting, realistic materials, and calm color treatment.',
  'Avoid childish illustration, glossy 3D fantasy scenes, miniature toy people, neon tech swirls, and impossible holographic dashboards.',
  'No visible text, no logos, no screenshots, and no recognizable platform branding.',
];

const PROMPT_SHELL_PATTERNS = [
  /^premium editorial b2b cover about\s*/i,
  /^publication-grade editorial photograph showing\s*/i,
  /^clean editorial explainer card about\s*/i,
  /^editorial photo:\s*/i,
  /^explainer card:\s*/i,
];

const STYLE_SENTENCE_PATTERNS = [
  /use the same visual family across all blog covers/gi,
  /dark graphite to deep navy (background|backdrop)[^.]*\./gi,
  /one large frosted glass[^.]*\./gi,
  /at most 1-2 small supporting glass[^.]*\./gi,
  /generous negative space[^.]*\./gi,
  /no visible text[^.]*\./gi,
  /default to professional editorial photography[^.]*\./gi,
  /use a clean simplified explainer card[^.]*\./gi,
  /if people appear[^.]*\./gi,
  /use restrained composition[^.]*\./gi,
  /avoid childish illustration[^.]*\./gi,
  /no people[^.]*\./gi,
];

const STYLE_STOP_WORDS = new Set([
  'about',
  'abstract',
  'background',
  'backdrop',
  'balanced',
  'believable',
  'blue',
  'brandless',
  'business',
  'calm',
  'canvas',
  'card',
  'chips',
  'clean',
  'clutter',
  'cobalt',
  'color',
  'colors',
  'composition',
  'connected',
  'control',
  'cover',
  'cues',
  'crowds',
  'dark',
  'deep',
  'details',
  'editorial',
  'elegant',
  'enterprise',
  'family',
  'forms',
  'frosted',
  'generous',
  'glass',
  'glow',
  'glowing',
  'gradients',
  'graphite',
  'hero',
  'house',
  'icons',
  'image',
  'images',
  'indigo',
  'large',
  'letters',
  'light',
  'lighting',
  'logo',
  'logos',
  'materials',
  'minimal',
  'motifs',
  'navy',
  'negative',
  'numbers',
  'office',
  'of',
  'panel',
  'panels',
  'people',
  'photo',
  'photograph',
  'platform',
  'premium',
  'professional',
  'prompt',
  'realistic',
  'realistically',
  'refined',
  'restrained',
  'rounded',
  'scene',
  'scenes',
  'screenshots',
  'small',
  'soft',
  'space',
  'spatial',
  'studio',
  'style',
  'subject',
  'subtle',
  'supporting',
  'symbol',
  'system',
  'text',
  'tile',
  'tonal',
  'visual',
  'vibrant',
  'workflow',
]);

const GENERIC_PROMPT_FILLER_PATTERNS = [
  /\b(use|using|showing|featuring|prefer|create|keep|with|and|for|the|a|an)\b/gi,
  /\b(reflections?|rounded edges?|hover(?:ing)? nearby|natural light(?:ing)?|calm art direction|believable real-world(?: business)? context)\b/gi,
  /\b(real adults?|professional adults?|brand marks?|watermarks?|labels?|numbers?|letters?)\b/gi,
];

function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function collapseRepeatedLeadingPhrase(value: string) {
  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);

  for (let phraseLength = Math.min(10, Math.floor(words.length / 2)); phraseLength >= 3; phraseLength -= 1) {
    const phrase = words.slice(0, phraseLength).join(' ').toLowerCase();
    let index = 0;
    let repeats = 0;

    while (index + phraseLength <= words.length) {
      const current = words.slice(index, index + phraseLength).join(' ').toLowerCase();
      if (current !== phrase) {
        break;
      }
      repeats += 1;
      index += phraseLength;
    }

    if (repeats >= 2) {
      return words.slice(0, phraseLength).join(' ');
    }
  }

  return normalizeWhitespace(value);
}

function stripPromptShells(value: string) {
  return PROMPT_SHELL_PATTERNS.reduce((current, pattern) => current.replace(pattern, ''), normalizeWhitespace(value));
}

function stripStyleSentences(value: string) {
  return STYLE_SENTENCE_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), value);
}

function stripCoverSceneNoise(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\b(a|an|the)\b/gi, ' ')
      .replace(/\b(team|people|person|staff|employees?|workers?|customers?|professionals?)\b/gi, ' ')
      .replace(/\b(meeting|discussion|collaboration|office|workspace|desk|room|laptop|screen|monitor|dashboard|phone|tablet)\b/gi, ' ')
      .replace(/\b(showing|symbolizing|representing|with|featuring|using)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  );
}

function stripInlineSceneNoise(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\b(illustration|abstract|futuristic|glowing|holographic|isometric|3d)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  );
}

function isExplainerImagePrompt(value: string) {
  return /\b(framework|checklist|comparison|requirements?|criteria|steps?|process|playbook|matrix|overview|architecture|flow)\b/i.test(value);
}

function cleanSemanticSentence(value: string) {
  const stripped = GENERIC_PROMPT_FILLER_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), value);

  return normalizeWhitespace(
    stripped
      .split(/\s+/)
      .filter((token) => {
        const normalized = token.toLowerCase().replace(/[^a-z0-9-]/gi, '');
        return normalized && !STYLE_STOP_WORDS.has(normalized);
      })
      .join(' ')
  );
}

function pickBestSemanticSentence(value: string, fallback: string) {
  const normalized = collapseRepeatedLeadingPhrase(
    normalizeWhitespace(stripStyleSentences(stripPromptShells(value)))
  );
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanSemanticSentence(sentence))
    .filter(Boolean);

  let best = '';
  let bestScore = 0;
  for (const sentence of [...sentences, cleanSemanticSentence(normalized)]) {
    const score = sentence.split(/\s+/).filter(Boolean).length;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }

  return normalizeWhitespace(best || fallback);
}

function limitWordCount(value: string, maxWords: number) {
  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ').trim();
}

function inferCoverSubjectMetaphor(subject: string) {
  const normalized = normalizeWhitespace(subject).toLowerCase();

  if (/\b(integration|integrations|api|crm|sync|webhook|connect|connected)\b/.test(normalized)) {
    return 'linked glass system modules with active signal bridge';
  }

  if (/\b(automation|workflow|routing|handoff|process|orchestration)\b/.test(normalized)) {
    return 'sequenced glass workflow nodes with highlighted handoff path';
  }

  if (/\b(analytics|analysis|measurement|metrics|metric|reporting|performance|insight|conversion|revenue|sales)\b/.test(normalized)) {
    return 'glass analytics nodes with rising conversion signal';
  }

  if (/\b(compare|comparison|versus|benchmark|difference|choice)\b/.test(normalized)) {
    return 'paired glass decision modules with contrast signal';
  }

  if (/\b(case|scenario|use case|customer|journey|qualification)\b/.test(normalized)) {
    return 'focused glass pathway with qualification signal';
  }

  return '';
}

export function getCoverImageHouseStyleText() {
  return COVER_IMAGE_HOUSE_STYLE_LINES.join(' ');
}

export function getCoverImageHouseStyleBullets() {
  return COVER_IMAGE_HOUSE_STYLE_LINES.map((line) => `- ${line}`).join('\n');
}

export function getInlineImageHouseStyleText() {
  return INLINE_IMAGE_HOUSE_STYLE_LINES.join(' ');
}

export function getInlineImageHouseStyleBullets() {
  return INLINE_IMAGE_HOUSE_STYLE_LINES.map((line) => `- ${line}`).join('\n');
}

export function finalizeCoverImagePromptText(prompt: string | null | undefined) {
  const normalized = pickBestSemanticSentence(
    sanitizeEditorialPromptText(prompt)
      .replace(/\busing ai tools?\b/gi, 'automation')
      .replace(/\bshowing collaboration and efficiency\b/gi, 'enterprise clarity')
      .replace(/\bmeeting room\b/gi, 'enterprise setting')
      .replace(/\boffice\b/gi, 'enterprise setting')
      .replace(/\.+$/g, ''),
    'connected sales analytics signal'
  );

  const subject = limitWordCount(stripCoverSceneNoise(normalized), 12) || 'connected sales analytics signal';
  const enrichedSubject =
    inferCoverSubjectMetaphor(subject) ||
    (/\b(signal|nodes?|module|path|bridge|matrix|loop|pathway|stack|cluster|orbit|chart)\b/i.test(subject)
      ? subject
      : '');

  return normalizeWhitespace(enrichedSubject || subject);
}

export function finalizeInlineImagePromptText(prompt: string | null | undefined) {
  const explicitExplainer = /^explainer card:\s*/i.test(String(prompt || ''));
  const normalized = pickBestSemanticSentence(
    sanitizeEditorialPromptText(prompt)
      .replace(/\babstract illustration\b/gi, 'editorial photograph')
      .replace(/\bvibrant and abstract\b/gi, 'professional and restrained')
      .replace(/\billustration\b/gi, 'editorial photograph')
      .replace(/\bfuturistic elements?\b/gi, 'restrained professional details')
      .replace(/\bdigital gradients?\b/gi, 'subtle tonal gradients')
      .replace(/\bglowing\b/gi, 'subtle')
      .replace(/\bholographic\b/gi, 'glass-accented')
      .replace(/\btech-driven sales team\b/gi, 'sales team reviewing live performance data')
      .replace(/\bai tools?\b/gi, 'automation workflows')
      .replace(/\bautomation cues\b/gi, 'automation workflows')
      .replace(/\b3d\b/gi, '')
      .replace(/\bisometric\b/gi, 'editorial')
      .replace(/\.+$/g, ''),
    'believable B2B workflow scenario'
  );

  const subject = limitWordCount(stripInlineSceneNoise(normalized), 18) || 'believable B2B workflow scenario';

  if (explicitExplainer || isExplainerImagePrompt(subject)) {
    return normalizeWhitespace(`Explainer card: ${subject}`);
  }

  return normalizeWhitespace(`Editorial photo: ${subject}`);
}
