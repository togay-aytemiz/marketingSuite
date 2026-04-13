import { detectRequestedChannels, getRequestedChannelAccentHints } from './channel-focus';

export type SocialPostPlatform = 'Instagram' | 'LinkedIn';
export type SocialPostTheme = 'light' | 'dark';
export type SocialPostCategory = 'new_feature' | 'product_overview' | 'blog';
export type SocialPostLanguage = 'TR' | 'EN';

export const SOCIAL_POST_STYLE_NAME = 'Social Post System';
export const SOCIAL_POST_IMAGE_SLOT_COUNT = 4;

export const SOCIAL_POST_DEFAULTS = {
  platform: 'Instagram' as SocialPostPlatform,
  theme: 'dark' as SocialPostTheme,
  category: 'new_feature' as SocialPostCategory,
  language: 'TR' as SocialPostLanguage,
} as const;

const SOCIAL_POST_VARIATION_DIRECTIONS = [
  'Large copy-safe negative space plus one hero UI crop. Keep the reserved copy area dominant, use one oversized product fragment, and protect strong negative space.',
  'Tight feature crop with one small floating tool or action chip. Push the capability much closer and make the core action feel immediate.',
  '2-layer editorial UI collage with a connector path. Show 2-3 modules together but keep them sparse, clean, and easy to scan.',
  'Quiet editorial product composition. Use more whitespace without abandoning the requested theme or product-UI base. Keep at least one crisp SaaS UI fragment, panel, or product card clearly present. Do not turn the quiet variation into photography, a real-world location scene, a map, or a bright document screenshot.',
] as const;

const SOCIAL_POST_MASTER_STYLE = `"Create a modern SaaS product marketing visual with a consistent, premium editorial design language.

STYLE LOCK:
- Background: black / near-black / graphite for dark mode, or soft white / light gray with a soft editorial tint field for light mode
- In dark mode, allow a restrained indigo/violet gradient field behind the hero area instead of flat black emptiness
- In light mode, allow a pale cool-blue, lilac, blush, or mint haze, but keep it subtle and premium
- In light mode, prefer a soft editorial tint field or gradient paper wash behind the hero zone instead of a plain flat white board
- Lighting: white haze + soft chrome bloom
- Atmosphere: editorial, calm, premium, minimal, high-end
- Add gentle grain/noise for depth
- Add subtle grain/noise, blur falloff, rim highlights, and soft bloom so the output feels designed rather than flat, but keep text areas clean and high contrast
- Optional: subtle dot or grid pattern for structure
- Prefer a low-contrast dot matrix field with evenly spaced micro-dots when the background needs extra texture
- Keep any dotted field faded, peripheral, and subordinate to the main composition
- When the user references respond.io-like launch assets, steer toward a glassy launch-card system: soft blue/lilac/violet gradient fields, translucent frosted panels, luminous rounded rectangles, haloed chat/action bubbles, floating square AI icons, dotted connector paths, and a low-contrast dot-matrix or halftone grid
- Use a refined background pattern layer in most outputs: dot-matrix, halftone grid, contour lines, or faint connector-line network
- Keep the pattern at 5-12% visual weight, mostly in the outer corners or behind the hero UI, with soft fade edges
- Avoid plain empty backgrounds; make the canvas feel designed even when the layout is minimal
- Add a soft glassy acrylic effect in the background system: frosted translucent background plates, blurred halos, specular edge highlights, and faint chrome reflections behind the hero UI
- Keep the core product UI card crisp, opaque, and readable; do not turn the main UI into frosted glass or a foggy translucent dashboard
- Do not imitate any third-party site exactly; translate the polished customer-conversation SaaS pattern language into Qualy's own restrained visual system
- Do not copy respond.io logos, exact copy, exact layout, or proprietary UI; use the reference only for mood, depth, glow, and composition logic

UI VISUAL LANGUAGE:
- Editorial UI collage, not a futuristic gradient poster
- UI cards should feel crisp, product-real, and editorial; use glass only for background plates, halos, and supporting shells
- Soft shadows, clean edges, and controlled highlights
- Add subtle acrylic edge highlights on floating panels, badges, and connector shells without making them look like shiny plastic
- Slight perspective and layered depth without drifting into fantasy UI
- Elements: cropped UI cards, document panels, tags, toggles, status chips, buttons, connector paths
- Favor a tall editorial hierarchy for launch/feature posts: small brand wordmark near the top, large short headline, one cropped product UI scene below or behind it, and one foreground glass bubble/action card that demonstrates the feature
- Avoid clutter; every element must earn its place

COLOR RULES:
- Base: black, white, graphite, smoke, cool gray
- Accent: soft silver / smoke / chrome glow plus restrained indigo/violet gradient accents
- Purple should stay slight and controlled, never the dominant full-canvas color
- Gemini-rendered lockup text: white, off-white, charcoal, or near-black depending on theme
- In light mode, allow one localized pastel accent field or soft tinted panel edge behind the hero area so the frame does not feel sterile
- Allow 1-2 small native-color channel icons only when the channel itself is central to the message
- If native-color channel icons appear, keep them crisp and small, using familiar hues such as WhatsApp green, Instagram gradient, Messenger blue
- Prefer outline, knockout, stencil, or cutout glyph treatments instead of filled app-icon tiles
- Instagram should read as a camera outline, gradient rim, or cutout glyph, not as a solid filled square or generic rounded gradient blob
- Do not turn the whole palette colorful just because one or two icons use their native colors
- Avoid neon color dominance, saturated accent floods, and warm color bias
- Avoid flat pure black/white emptiness; use depth, gradient transition, or soft atmospheric texture instead

COMPOSITION:
- One strong hero UI moment plus at most 1-2 supporting crops
- Plenty of negative space
- Depth with foreground/midground/background layering
- Use connector paths, glow dots, and crop relationships to imply product logic
- Never let the layout feel like a busy dashboard mosaic

GEMINI COPY LOCKUP ZONE:
- The final Gemini render request receives the exact headline and subheadline separately from this planned prompt
- Reserve a clean typography-safe and copy-safe zone for that Gemini-rendered lockup, usually top-aligned or left-aligned
- Do not include the literal headline or subheadline text inside this planned prompt field
- The planned prompt field itself should stay copy-free except for abstract no-text UI skeleton guidance
- Do not rely on extra readable UI microcopy to explain the concept

SUPPORTING MICROCOPY:
- Do not ask Gemini to render intentional secondary UI text inside cards; use abstract skeleton lines, no-text chips, dots, and icons instead
- Let the Gemini-rendered headline and subheadline carry the main message

MOOD:
- Smart, automated, calm, confident
- More editorial than futuristic

QUALITY:
- Ultra sharp, high resolution
- No pixelation, no artifacts
- Professional product marketing quality (like top SaaS landing pages)

AVOID:
- Neon blue/purple glow
- Futuristic gradient poster aesthetics
- Overcrowded UI
- Random accent colors outside the restrained cool-tone system
- Cartoonish or childish style
- Realistic photography"`;

const SOCIAL_POST_THEME_ADAPTATION = `"THEME MODE:
The design must adapt based on the selected theme.

If DARK mode:
- Background: deep black / graphite (#030303 - #111111)
- Accents: white haze, soft silver bloom, restrained chrome edge light, and a restrained indigo/violet gradient transition
- UI cards: crisp charcoal / deep graphite product surfaces with minimal transparency
- Gemini-rendered lockup text: white / off-white
- Overall mood: monochrome, cinematic, premium
- Prefer a soft vertical gradient or glow field instead of a flat black board
- Subtle dot or grid pattern is allowed in low-contrast background zones
- A dotted field can sit off to one side or fade across the canvas, similar to a premium presentation backdrop rather than a loud pattern
- Use luminous frosted-glass foreground chips or bubbles sparingly, with crisp headline text and controlled bloom

If LIGHT mode:
- Background: very light gray / soft white (#F5F5F5 - #FFFFFF)
- Accents: pale silver haze, restrained chrome highlight, subtle cool-gray shadow, and a faint cool-blue, lilac, blush, or mint haze when needed
- UI cards: white / soft-white crisp panels with soft shadows
- Borders: subtle gray (#E7E7E7)
- Gemini-rendered lockup text: dark gray / near black (#111827)
- Overall mood: clean, editorial, minimal, airy SaaS style
- Use a soft editorial tint field, localized pastel accent field, gradient paper wash, or frosted acrylic halo behind the hero zone instead of a plain flat white board
- Give light mode a visible but restrained glassy acrylic lift: translucent off-white plates, blurred pastel refraction, thin chrome rim light, and soft layered shadows behind the main UI
- Keep light-mode glass at the background and supporting-shell level only; the central product UI should stay solid white, crisp, and legible
- Keep the same composition system as dark mode, just with softer contrast and brighter surfaces

CONSISTENCY RULE:
- Layout, composition, UI components, and structure must remain identical between dark and light modes
- Only colors, lighting, and contrast should change"`;

const SOCIAL_POST_CATEGORY_SYSTEM = `"CATEGORY:
The visual must adapt based on the content category while preserving the same core design system.

CATEGORIES:

1. FEATURE ANNOUNCEMENT (Yeni özellik)
- Focus: a specific UI capability
- Visual: close crop on one capability, interaction state, or tool moment
- Add restrained highlight emphasis on the feature area
- Feeling: "new capability unlocked"
- Optional: one small tool/action chip near the hero crop

2. PRODUCT OVERVIEW (Genel ürün tanıtımı)
- Focus: the overall system / platform
- Visual: 2-3 modules arranged together with clear hierarchy and connector logic
- Show ecosystem feeling without clutter
- Feeling: "all-in-one powerful system"
- Balanced composition, not too zoomed

3. BLOG / CONTENT SHARE
- Focus: readability + content
- Visual: cleaner layout, more whitespace
- Include a more dominant article card, document block, or editorial content panel
- Less glow, more flat & clean
- Feeling: "educational, informative"
- Slightly softer and calmer than others

CONSISTENCY RULE:
- All categories must use the same color system, lighting style, and UI language
- Only composition, focus, and density should change"`;

export function resolveSocialPostAspectRatio(platform: SocialPostPlatform) {
  return platform === 'Instagram' ? '4:5' : '1:1';
}

export function getSocialPostCategoryLabel(category: SocialPostCategory) {
  switch (category) {
    case 'new_feature':
      return 'Feature announcement';
    case 'product_overview':
      return 'Product overview';
    case 'blog':
      return 'Blog / content share';
  }
}

export function getSocialPostCategoryUiLabel(category: SocialPostCategory) {
  switch (category) {
    case 'new_feature':
      return 'Yeni özellik';
    case 'product_overview':
      return 'Genel ürün tanıtımı';
    case 'blog':
      return 'Blog / Makale';
  }
}

function getSocialPostPreviewBadge(category: SocialPostCategory, language: SocialPostLanguage) {
  if (language === 'TR') {
    switch (category) {
      case 'new_feature':
        return 'YENİ ÖZELLİK';
      case 'product_overview':
        return 'ÜRÜN TANITIMI';
      case 'blog':
        return 'BLOG / MAKALE';
    }
  }

  switch (category) {
    case 'new_feature':
      return 'NEW FEATURE';
    case 'product_overview':
      return 'PRODUCT OVERVIEW';
    case 'blog':
      return 'BLOG / ARTICLE';
  }
}

function getSocialPostPreviewSubtitle(category: SocialPostCategory, language: SocialPostLanguage, platform: SocialPostPlatform) {
  if (language === 'TR') {
    switch (category) {
      case 'new_feature':
        return `${platform} özellik duyurusu`;
      case 'product_overview':
        return `${platform} ürün tanıtımı`;
      case 'blog':
        return `${platform} makale paylaşımı`;
    }
  }

  switch (category) {
    case 'new_feature':
      return `${platform} feature post`;
    case 'product_overview':
      return `${platform} product overview`;
    case 'blog':
      return `${platform} article share`;
  }
}

export function getSocialPostPreviewMeta(input: {
  category: SocialPostCategory;
  language: SocialPostLanguage;
  platform: SocialPostPlatform;
  variationIndex: number;
}) {
  return {
    badge: getSocialPostPreviewBadge(input.category, input.language),
    title: `${input.language === 'TR' ? 'Varyasyon' : 'Variation'} ${Math.max(0, input.variationIndex) + 1}`,
    subtitle: getSocialPostPreviewSubtitle(input.category, input.language, input.platform),
  };
}

export function getSocialPostLanguageLabel(language: SocialPostLanguage) {
  return language === 'EN' ? 'English' : 'Turkish';
}

export function supportsSocialPostReferenceImage(category: SocialPostCategory) {
  return category === 'new_feature' || category === 'product_overview';
}

export function resolveSocialPostFocus(
  focusInput: string
) {
  return String(focusInput || '').trim();
}

export function getSocialPostVariationDirection(variationIndex: number) {
  return SOCIAL_POST_VARIATION_DIRECTIONS[Math.abs(variationIndex) % SOCIAL_POST_VARIATION_DIRECTIONS.length];
}

function truncateSocialPostCopy(value: string, maxWords: number) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
    .trim();
}

export function buildFallbackSocialPostLockup(input: {
  category: SocialPostCategory;
  language: SocialPostLanguage;
  productName?: string;
  featureName?: string;
}) {
  const productName = String(input.productName || '').trim() || 'Qualy';
  const featureName = truncateSocialPostCopy(String(input.featureName || '').trim(), 5);

  if (input.language === 'TR') {
    switch (input.category) {
      case 'new_feature':
        return {
          headline: featureName || 'Yeni özellik',
          subheadline: 'Tek özellik daha net, daha görünür, daha hızlı.',
        };
      case 'blog':
        return {
          headline: 'Yeni blog yazısı',
          subheadline: 'Ana fikri tek karede sakin ve net göster.',
        };
      case 'product_overview':
      default:
        return {
          headline: `${productName} ile tek merkez`,
          subheadline: 'Ekip, otomasyon ve sohbet akışını birlikte görün.',
        };
    }
  }

  switch (input.category) {
    case 'new_feature':
      return {
        headline: featureName || 'New feature',
        subheadline: 'One capability, clearer value, faster read.',
      };
    case 'blog':
      return {
        headline: 'New article',
        subheadline: 'Show the core idea in one calm editorial frame.',
      };
    case 'product_overview':
    default:
      return {
        headline: `${productName} in one view`,
        subheadline: 'See teams, automation, and conversations together.',
      };
  }
}

function buildSocialPostCategoryAdaptation(category: SocialPostCategory) {
  switch (category) {
    case 'new_feature':
      return `
CATEGORY ADAPTATION:
- Category: Feature announcement
- Make one shipped capability the dominant subject.
- Prefer a close crop on one UI fragment, active state, tool chip, or flow hint.
- Let one small supporting action chip orbit the hero without making the frame busy.
- Add localized glow or gradient emphasis around the focus area, not across the whole frame.
`.trim();
    case 'blog':
      return `
CATEGORY ADAPTATION:
- Category: Blog / content share
- Prioritize readability, whitespace, and a calmer editorial rhythm.
- Use a document/article card as the main anchor and give it more presence than the surrounding UI.
- Make the article/blog intent obvious at a glance rather than looking like a generic feature ad.
- Keep the overall frame cleaner and slightly softer than feature or product overview visuals.
`.trim();
    case 'product_overview':
    default:
      return `
CATEGORY ADAPTATION:
- Category: Product overview
- Show the product ecosystem rather than a single tiny feature moment.
- Use 2-3 connected modules to imply one cohesive platform, but keep them sparse.
- Keep the layout balanced and premium, without drifting into clutter.
- Let one module carry the strongest localized emphasis so the system still has a clear focal point.
`.trim();
  }
}

function buildContextBlock(title: string, value?: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return `
${title}:
${normalized}
`.trim();
}

function buildBlogContentContextBlock(value?: string) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const excerpt = normalized.slice(0, 2400);
  return `
BLOG CONTENT CONTEXT:
${excerpt}${excerpt.length < normalized.length ? '…' : ''}

IMPORTANT: Use this pasted blog/article content as the primary editorial source for the visual angle, hierarchy, and content framing. Do not invent a different article topic.
`.trim();
}

export interface SocialPostPlannerPromptInput {
  productName: string;
  featureName: string;
  description: string;
  platform: SocialPostPlatform;
  theme: SocialPostTheme;
  category: SocialPostCategory;
  language: SocialPostLanguage;
  focus: string;
  blogContent?: string;
  extraInstruction: string;
  variationIndex?: number;
  hasReferenceImage?: boolean;
  strategyContextPromptText?: string;
  realityContextPromptText?: string;
}

function buildReferenceImageContextBlock(hasReferenceImage?: boolean, theme: SocialPostTheme = 'dark') {
  if (!hasReferenceImage) {
    return '';
  }

  const surfaceInstruction = theme === 'dark'
    ? `- Adapt white or light reference panels into dark graphite or ink surfaces while preserving recognizable geometry, spacing, hierarchy, and core product structure.
- Do not produce a bright white page, spreadsheet, chart, table, axis plot, or light-mode dashboard.
- Keep the product UI crisp and product-real; use glass only as a supporting background, shell, or action layer.`
    : `- Keep white or light panels crisp, solid, and product-real instead of turning them into smoked or frosted glass.
- Do not reinterpret the source as a dark fantasy dashboard or generic glass cards.`;

  return `
REFERENCE IMAGE MODE:
- An uploaded reference UI exists for this variation.
- Treat the uploaded reference UI as the primary product surface source, not loose inspiration.
- Keep recognizable panel geometry, spacing, hierarchy, and core product structure from that source.
${surfaceInstruction}
- Use one localized accent, outline, glow, crop, or contrast lift to make the requested focus read first.
- Simplify only dense microcopy or non-essential chrome; keep the product surface feeling real and close to the shipped UI.
- Never preserve personal names, usernames, initials, or profile photos from the reference.
- Simplify or regenerate avatars into generic fictional profile markers.
- If an identity label must survive, replace it with a fictional localized placeholder or omit the non-essential label.
`.trim();
}

function buildChannelPriorityBlock(requestedChannels: string[]) {
  if (requestedChannels.length === 0) {
    return '';
  }

  const otherChannels = ['WhatsApp', 'Instagram', 'Messenger', 'Telegram'].filter(
    (channel) => !requestedChannels.includes(channel)
  );
  const otherChannelList = otherChannels.join(', ');

  if (requestedChannels.length === 1) {
    return `
CHANNEL PRIORITY:
- Requested channels: ${requestedChannels[0]}
- This explicit user focus outranks product-name wording, PRD/ROADMAP context, and local codebase channel references.
- Do not swap the requested channel focus to ${otherChannelList}, or other surrounding product channels.
- If a single channel is explicitly requested, keep the visual centered on that channel unless the user explicitly asks for a multi-channel story.
`.trim();
  }

  return `
CHANNEL PRIORITY:
- Requested channels: ${requestedChannels.join(', ')}
- Keep these requested channels central even if other channels appear in product context, PRD/ROADMAP notes, or local codebase reality.
- Do not introduce extra channels outside this requested set unless the user explicitly asks for a broader multi-channel story.
`.trim();
}

function buildChannelAccentBlock(requestedChannels: string[]) {
  const hints = getRequestedChannelAccentHints(requestedChannels as Array<any>);
  if (hints.length === 0) {
    return '';
  }

  return `
CHANNEL ACCENTS:
- Keep any native-color channel accents small, crisp, and localized near the requested focus.
- Use these accents as a subtle lift, not a colorful redesign.
- Prefer outline, knockout, stencil, or cutout glyph treatments instead of filled app-icon tiles.
- ${hints.join('\n- ')}
`.trim();
}

function buildFocusCopyPriorityBlock(focus: string) {
  if (!focus) {
    return '';
  }

  return `
FOCUS ROLE:
- Treat this focus as the primary campaign angle for both copy and composition.
- Use product context, PRD/ROADMAP context, and local codebase reality only to validate or enrich that angle.
- Do not default to broader product naming, project titles, or dominant channel wording from background context when the focus is narrower.
- Interpret the focus into polished marketing copy rather than echoing it verbatim unless it is already clean headline language.
`.trim();
}

function buildSocialPostVisibleTextLanguageLock(language: SocialPostLanguage) {
  if (language === 'TR') {
    return `
TURKISH VISIBLE TEXT LOCK:
- Outside the Gemini-rendered headline/subheadline lockup, avoid readable conversation, chat bubble, message, reply, label, callout, status chip, score indicator, and UI text.
- If any unavoidable visible UI text remains, it must be Turkish with natural Turkish characters.
- Do not render mixed-language or pseudo-Turkish strings; no gibberish, malformed words, partial translations, or Turkish-looking nonsense.
- Avoid readable English terms such as "Lead Scoring", "High Score", "Assistant", or "AI response"; use Turkish equivalents only when supporting UI text is truly necessary.
- Do not include Turkish ad copy inside the planned prompt field; the final Gemini render receives copy separately.
- If supporting chat or UI text is unavoidable, use short natural Turkish phrases.
- Prefer abstract skeleton lines, dots, and no-text placeholders for decorative dense UI chrome.
`.trim();
  }

  return `
VISIBLE TEXT LANGUAGE LOCK:
- Outside the Gemini-rendered headline/subheadline lockup, avoid readable conversation, chat bubble, message, reply, label, callout, status chip, score indicator, and UI text.
- If any unavoidable visible UI text remains, it must be English.
- Do not render mixed-language strings, pseudo-language gibberish, malformed words, or partial translations.
- Do not include English ad copy inside the planned prompt field; the final Gemini render receives copy separately.
- If supporting chat or UI text is unavoidable, use short natural English phrases.
- Prefer abstract skeleton lines, dots, and no-text placeholders for decorative dense UI chrome.
`.trim();
}

export function buildSocialPostPlannerPrompt(input: SocialPostPlannerPromptInput) {
  const platform = input.platform;
  const theme = input.theme;
  const categoryLabel = getSocialPostCategoryLabel(input.category);
  const languageLabel = getSocialPostLanguageLabel(input.language);
  const aspectRatio = resolveSocialPostAspectRatio(platform);
  const focus = String(input.focus || '').trim();
  const extraInstruction = String(input.extraInstruction || '').trim();
  const variationIndex = (input.variationIndex ?? 0) + 1;
  const variationDirection = getSocialPostVariationDirection(input.variationIndex ?? 0);
  const blogContentBlock = buildBlogContentContextBlock(input.blogContent);
  const strategyContextBlock = buildContextBlock(
    'PRODUCT STRATEGY CONTEXT (from PRD/ROADMAP docs)',
    input.strategyContextPromptText
  );
  const realityContextBlock = buildContextBlock(
    'LOCAL CODEBASE REALITY CONTEXT (derived from nearby product code)',
    input.realityContextPromptText
  );
  const referenceImageContextBlock = buildReferenceImageContextBlock(input.hasReferenceImage, theme);
  const requestedChannels = detectRequestedChannels([focus, extraInstruction]);
  const channelPriorityBlock = buildChannelPriorityBlock(requestedChannels);
  const channelAccentBlock = buildChannelAccentBlock(requestedChannels);
  const focusCopyPriorityBlock = buildFocusCopyPriorityBlock(focus);
  const visibleTextLanguageLock = buildSocialPostVisibleTextLanguageLock(input.language);

  return `
You are a senior creative director generating one production-ready Gemini image prompt for a SaaS social page post visual.

OUTPUT TARGET:
- Platform: ${platform}
- Aspect Ratio: ${aspectRatio}
- Theme Mode: ${theme}
- Category: ${categoryLabel}
- Copy Language: ${languageLabel}
- Variation: ${variationIndex} of ${SOCIAL_POST_IMAGE_SLOT_COUNT}

PRODUCT CONTEXT:
- Product Name: ${String(input.productName || '').trim() || 'Qualy'}
- Feature Name: ${String(input.featureName || '').trim() || 'Core product workflow'}
- Description: ${String(input.description || '').trim() || 'Modern SaaS platform'}

MASTER STYLE PROMPT:
${SOCIAL_POST_MASTER_STYLE}

THEME ADAPTATION:
${SOCIAL_POST_THEME_ADAPTATION}

CATEGORY SYSTEM:
${SOCIAL_POST_CATEGORY_SYSTEM}

${buildSocialPostCategoryAdaptation(input.category)}

${focus
  ? `FOCUS: ${focus}`
  : `FOCUS: AI should decide the strongest focus based on the selected category, product context, PRD/ROADMAP context, and shipped product reality.`}

${focus
  ? `FOCUS EMPHASIS RULE:
- Build one localized emphasis zone around the requested focus.
- Use gradient transition, glow, crop tension, or connector contrast to make that area read first.
- Keep the rest of the frame calmer so the focus feels deliberate.`
  : ''}

${focusCopyPriorityBlock}

VARIATION DIRECTION:
- ${variationDirection}

${focus
  ? `VISUAL HINT:
Use UI elements that represent this focus clearly, such as tags, chat bubbles, triggers, assignment flows, document cards, status labels, or lightweight automation connectors.`
  : `VISUAL HINT:
AI should decide the clearest visual hint and UI metaphor for that focus, using only the elements that best explain the category and shipped product capabilities.`}

${channelPriorityBlock}

${channelAccentBlock}

${referenceImageContextBlock}

${extraInstruction ? `EXTRA DIRECTION:\n${extraInstruction}` : 'EXTRA DIRECTION:\n- No extra direction provided. Keep the composition clean and minimal.'}

${blogContentBlock}

${strategyContextBlock}

${realityContextBlock}

NON-NEGOTIABLE RULES:
- Return one production-ready Gemini render prompt in English.
- This is for an Instagram or LinkedIn page post, not a banner ad, device mockup, or website hero.
- Keep the same overall layout logic between dark and light themes; only colors, lighting, and contrast should change.
- The final Gemini render request receives the exact headline and subheadline separately from this planned prompt.
- Reserve a clean typography-safe zone for the Gemini-rendered lockup.
- Do not include the literal headline/subheadline text or a second copy lockup inside the planned prompt field.
- Keep all 4 variations as siblings of the same brief; reuse the same headline and subheadline copy while only crop, hierarchy, and supporting density change.
- Every variation must remain a rendered social page post visual with product UI or abstract SaaS interface structure.
- Never turn a variation into daylight photography, city/building/street imagery, map-like views, or a bright text-heavy screenshot.
- Any visible text in the final Gemini-rendered export must be in ${languageLabel}; the planned prompt should avoid extra readable UI text entirely.
- Any example words, labels, status names, chip text, or focus phrases are semantic guidance only. Do not instruct Gemini to render those words literally on canvas.
- Outside the Gemini-rendered headline/subheadline lockup, avoid intentional readable microcopy; represent UI content with no-text skeleton lines, dots, or neutral blocks.
- Do not render prompt field labels such as "Headline", "Subheadline", "CTA", or "Call to Action" as visible words.
${visibleTextLanguageLock}
- Do not plan standalone decorative logo placements or make the composition revolve around a logo.
- If the product UI naturally contains a brand mark, it may appear there, but it should stay non-focal.
- ${input.language === 'TR' ? 'Never introduce English UI labels or placeholder words when the selected language is Turkish.' : `Never introduce readable UI labels in a language other than ${languageLabel}.`}
- ${input.language === 'TR' ? 'Never preserve English labels, usernames, or person-name strings from uploaded references when the selected language is Turkish.' : `Never preserve readable imported labels or identity strings in a language other than ${languageLabel}.`}
- If supporting UI copy is intentionally visible, keep it short, sparse, and readable in ${languageLabel}.
- Only decorative dense UI chrome may become abstract skeleton lines or no-text placeholders.
- Keep UI panels, badges, profile cards, and score indicators free of English labels, malformed words, and unnecessary dense microcopy.
- Avoid English or malformed UI headers such as customer info, customer profiles, high score, lead score, automated response, or person-name labels; translate necessary labels into short ${languageLabel} phrases or omit non-essential labels.
- Never preserve real profile identities from uploaded references; use fictional localized placeholders or generic avatar markers instead.
- Do not invent product capabilities, UI states, metrics, or workflows that are not supported by the provided product context, PRD/ROADMAP context, or local codebase reality.
- Keep the scene premium, minimal, and sharp at a glance.

Return JSON only:
- prompt: final Gemini render prompt
- styleName: "${SOCIAL_POST_STYLE_NAME}"
`.trim();
}
