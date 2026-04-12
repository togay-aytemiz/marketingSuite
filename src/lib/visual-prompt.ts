import { getSingleOutputLanguageName } from './app-language';
import { detectRequestedChannels, getRequestedChannelAccentHints } from './channel-focus';
import {
  buildVisualBrandBlock,
  resolveVisualBrandName,
} from './visual-brand-profile';
import {
  VISUAL_HOUSE_STYLE,
  buildVisualThemeBlock,
  buildVisualHouseStyleBlock,
  getVisualHouseStyleVariationText,
} from './visual-house-style';
import type { VisualTheme } from './visual-house-style';

export function buildVisualStrategyContextBlock(strategyContextPromptText?: string) {
  const normalized = String(strategyContextPromptText || '').trim();
  if (!normalized) {
    return '';
  }

  return `
PRODUCT STRATEGY CONTEXT (from PRD/ROADMAP docs):
${normalized}

IMPORTANT: Align the visual concept, feature emphasis, and any supporting product framing with this strategy context and shipped capabilities. Do not imply features, workflows, or outcomes that are not present here.`;
}

export function buildVisualRealityContextBlock(realityContextPromptText?: string) {
  const normalized = String(realityContextPromptText || '').trim();
  if (!normalized) {
    return '';
  }

  return `
LOCAL CODEBASE REALITY CONTEXT (derived from nearby product code):
${normalized}

IMPORTANT: Treat this local product reality as higher priority than generic SaaS assumptions. If it says scoring is 0-10, do not invent 0-100 dashboards, percentile gauges, or enterprise scorecards unless the brief explicitly asks for them.`;
}

function buildPlatformInstruction(platform: string) {
  const normalizedPlatform = String(platform || 'General').trim() || 'General';
  const lower = normalizedPlatform.toLowerCase();

  if (lower.includes('instagram')) {
    return 'PLATFORM: INSTAGRAM. Optimize for feed-stopping impact in a fast-scrolling environment. The first read must happen instantly at phone size.';
  }

  if (lower.includes('linkedin')) {
    return 'PLATFORM: LINKEDIN. Keep the composition sharp, credible, and executive-friendly while still arresting the scroll.';
  }

  if (lower.includes('website')) {
    return 'PLATFORM: WEBSITE. Keep the frame clean enough to work as a hero asset and leave disciplined breathing room around the copy.';
  }

  if (lower.includes('x')) {
    return 'PLATFORM: X. Favor an immediate single-idea composition that remains readable in a compact timeline.';
  }

  return `PLATFORM: ${normalizedPlatform}. Adapt the composition appropriately without breaking the house style.`;
}

function buildCampaignObjectiveBlock(
  campaignType: string,
  campaignFocus: string,
  featureName: string
) {
  const normalizedCampaignType = String(campaignType || 'Product promotion').trim() || 'Product promotion';
  const normalizedFocus = String(campaignFocus || '').trim();
  const normalizedFeatureName = String(featureName || '').trim();
  const lower = normalizedCampaignType.toLowerCase();

  if (lower.includes('product promotion')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'General product value'}
- Primary objective: sell the broader product value and outcome, not a literal feature announcement.
- Do not frame this as a feature announcement unless the mandatory copy or campaign focus explicitly requires it.
- Do not let the image drift into a feature announcement just because "${normalizedFeatureName || 'the feature name'}" is present in the brief.
- If "${normalizedFeatureName || 'the feature'}" appears, treat it as supporting proof or context, not the main idea.
`.trim();
  }

  if (lower.includes('feature announcement')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || normalizedFeatureName || 'New feature'}
- Primary objective: announce one shipped feature clearly and make that feature the dominant subject.
- Keep the framing tightly centered on "${normalizedFeatureName || 'the feature'}" and its immediate value.
`.trim();
  }

  if (lower.includes('update release')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || normalizedFeatureName || 'Product update'}
- Primary objective: communicate a meaningful product update with clarity and forward motion.
- Use "${normalizedFeatureName || 'the update'}" as a release signal, not as a cluttered feature collage.
`.trim();
  }

  if (lower.includes('tutorial')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || normalizedFeatureName || 'How it works'}
- Primary objective: make one workflow or use case feel immediately understandable.
- Favor clarity over hype and use "${normalizedFeatureName || 'the feature'}" as the teaching anchor.
`.trim();
  }

  if (lower.includes('landing page visual')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'Hero-level product value'}
- Primary objective: create a broad product hero image, not a narrow feature announcement.
- Lead with overall product promise and conversion intent; any feature detail should stay subordinate.
`.trim();
  }

  if (lower.includes('customer success story')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'Customer outcome'}
- Primary objective: foreground customer proof, trust, and business outcome.
- Keep any feature mention secondary to the outcome story.
`.trim();
  }

  if (lower.includes('webinar') || lower.includes('event invite')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'Event invitation'}
- Primary objective: make the invitation and attendance value obvious at a glance.
- Keep the visual anchored to the event offer rather than drifting into generic product or feature framing.
`.trim();
  }

  if (lower.includes('special offer') || lower.includes('discount')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'Offer clarity'}
- Primary objective: make the offer and the next action obvious without cheap urgency clutter.
- Keep the product context supportive, but let the offer framing lead.
`.trim();
  }

  if (lower.includes('behind the scenes') || lower.includes('teaser')) {
    return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || 'Curiosity and intrigue'}
- Primary objective: create curiosity and anticipation without over-explaining.
- Reveal just enough product signal to invite a closer look.
`.trim();
  }

  return `
CAMPAIGN OBJECTIVE:
- Campaign Type: ${normalizedCampaignType}
- Campaign Focus: ${normalizedFocus || normalizedFeatureName || 'General campaign'}
- Primary objective: align the image with the stated campaign type before choosing the dominant subject.
`.trim();
}

function buildCustomInstructionBlock(customInstruction: string) {
  const normalized = String(customInstruction || '').trim();
  if (!normalized) {
    return '';
  }

  return `
NON-NEGOTIABLE CUSTOM INSTRUCTIONS:
- Apply this direction unless it conflicts with the mandatory text, the house style, or the supplied references.
- ${normalized}
`.trim();
}

function buildVisualAssetPlanningBlock(
  images: string[],
  featureName: string,
  outputLanguage: string,
  campaignType: string,
  campaignFocus: string,
  previousImage?: string,
  referenceImage?: string | null
) {
  if (previousImage) {
    return `
VISUAL SOURCE CONTEXT:
- This is a magic edit of a previously generated visual.
- Keep the overall composition and intent stable unless the user feedback explicitly asks for a bigger shift.
- Preserve the strongest existing signal-frame idea and only refine what is needed.
`.trim();
  }

  if (images.length > 0) {
    return `
VISUAL SOURCE CONTEXT:
- Screenshot inputs are available.
- Treat the uploaded screenshot as the primary structural source, not loose inspiration.
- Preserve recognizable panel geometry, spacing, and hierarchy from the source UI.
- Simplify only dense microcopy, tiny labels, or non-essential dashboard chrome.
- If the screenshot contains white or light surfaces, keep them crisp and solid instead of turning them into glassy abstractions.
- Never preserve real names, usernames, or profile photos from the screenshot; replace them with generic fictional markers.
- Any visible UI text must be rendered in ${outputLanguage}.
`.trim();
  }

  if (referenceImage) {
    return `
VISUAL SOURCE CONTEXT:
- A focused reference UI is attached for this visual.
- Treat it as the primary product surface source, not a loose style cue.
- Preserve recognizable panel geometry, spacing, and hierarchy from that source.
- Keep white or light surfaces crisp, solid, and product-real.
- Use one localized accent or contrast lift to emphasize the main focus instead of restyling the whole frame.
- Never preserve real names, usernames, or profile photos from that source; replace them with generic fictional markers.
`.trim();
  }

  const normalizedCampaignType = String(campaignType || '').trim().toLowerCase();
  const normalizedCampaignFocus = String(campaignFocus || '').trim();
  const normalizedFeatureName = String(featureName || '').trim() || 'the feature';

  if (
    normalizedCampaignType.includes('product promotion')
    || normalizedCampaignType.includes('landing page visual')
    || normalizedCampaignType.includes('customer success story')
    || normalizedCampaignType.includes('special offer')
    || normalizedCampaignType.includes('discount')
    || normalizedCampaignType.includes('webinar')
    || normalizedCampaignType.includes('event invite')
    || normalizedCampaignType.includes('behind the scenes')
    || normalizedCampaignType.includes('teaser')
  ) {
    return `
VISUAL SOURCE CONTEXT:
- No screenshot input is available.
- Build the composition from scratch around the campaign objective: "${normalizedCampaignFocus || campaignType || 'General product value'}".
- Do not automatically center the composition on "${normalizedFeatureName}" unless the mandatory copy clearly makes it the main idea.
- Use one clear product signal, one conversion-oriented metaphor, or one cropped interface fragment only.
`.trim();
  }

  return `
VISUAL SOURCE CONTEXT:
- No screenshot input is available.
- Build the composition from scratch around the feature "${featureName || 'New Feature'}".
- Use one clear product metaphor, one cropped product signal, or one hero interface fragment only.
`.trim();
}

function buildReferenceInstruction(referenceImage?: string | null) {
  if (!referenceImage) {
    return '';
  }

  return `
REFERENCE IMAGE:
- A style reference image is attached.
- Borrow its composition, pacing, and editorial feel without copying the exact text, product, or layout verbatim.
- Reinterpret it into a cleaner marketing composition instead of tracing it literally.
- Convert recognizable fragments into simplified shapes, crops, highlights, or UI cues that fit the final concept.
`.trim();
}

function buildFeedbackInstruction(userComment?: string) {
  const normalized = String(userComment || '').trim();
  if (!normalized) {
    return '';
  }

  return `
USER FEEDBACK TO APPLY:
"${normalized}"

- The edited image must visibly apply the user feedback without breaking the house style.
- Do not return a near-identical image when the feedback asks for a concrete change.
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
- Treat this explicit channel request as higher priority than surrounding product-context channel mentions.
- Do not swap the requested channel focus to ${otherChannelList}, or other surrounding product channels.
- If one channel is explicitly requested, keep the render centered on that channel unless the brief explicitly asks for a multi-channel story.
`.trim();
  }

  return `
CHANNEL PRIORITY:
- Requested channels: ${requestedChannels.join(', ')}
- Keep these requested channels central even if other channels appear elsewhere in the brief or planned prompt.
- Do not introduce extra channels outside this requested set unless the brief explicitly asks for a broader multi-channel story.
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
- Use them as a restrained spark, not a colorful redesign.
- ${hints.join('\n- ')}
`.trim();
}

function buildMandatoryCopyRule(includeCta: boolean) {
  return includeCta
    ? 'The prompt must explicitly keep the visible copy limited to the provided headline, subheadline, and CTA.'
    : 'The prompt must explicitly keep the visible copy limited to the provided headline and subheadline only. CTA is disabled for this visual.';
}

function buildMandatoryCopyBlock(headline: string, subheadline: string, cta: string, includeCta: boolean) {
  if (!includeCta) {
    return `
MANDATORY TEXT VALUES TO INCLUDE IN THE FINAL IMAGE:
Exact headline text for the final image: ${headline || '[Auto-generated headline]'}
Exact subheadline text for the final image: ${subheadline || '[Auto-generated subheadline]'}
No CTA text should appear.

- CTA is disabled for this visual.
- Use headline and subheadline only.
- Do not add any button label, action chip, footer CTA, or invented action copy.
- Do not render field labels such as "Headline", "Subheadline", "CTA", or "Call to Action"; those are prompt field names only.
`.trim();
  }

  return `
MANDATORY TEXT VALUES TO INCLUDE IN THE FINAL IMAGE:
Exact headline text for the final image: ${headline || '[Auto-generated headline]'}
Exact subheadline text for the final image: ${subheadline || '[Auto-generated subheadline]'}
Exact button text for the final image: ${cta || '[Auto-generated CTA]'}

- Do not render field labels such as "Headline", "Subheadline", "CTA", "Call to Action", or "Button"; those are prompt field names only.
`.trim();
}

function buildRenderCopyBlock(headline: string, subheadline: string, cta: string, includeCta: boolean) {
  if (!includeCta) {
    return `
MANDATORY TEXT VALUES TO RENDER:
Exact headline text to render: ${headline || '[Auto-generated headline]'}
Exact subheadline text to render: ${subheadline || '[Auto-generated subheadline]'}
No CTA text should be rendered.

- CTA is disabled for this visual.
- Render headline and subheadline only.
- Do not add any button label, action chip, footer CTA, or invented action copy.
- Do not render field labels such as "Headline", "Subheadline", "CTA", or "Call to Action"; those are prompt field names only.
`.trim();
  }

  return `
MANDATORY TEXT VALUES TO RENDER:
Exact headline text to render: ${headline || '[Auto-generated headline]'}
Exact subheadline text to render: ${subheadline || '[Auto-generated subheadline]'}
Exact button text to render: ${cta || '[Auto-generated CTA]'}

- Do not render field labels such as "Headline", "Subheadline", "CTA", "Call to Action", or "Button"; those are prompt field names only.
`.trim();
}

function buildNoVisibleCopyBlock(outputLanguage: string) {
  return `
NO VISIBLE COPY:
- Do not render any headline, subheadline, CTA, paragraph text, numbers, UI labels, status chips, button copy, tooltip copy, or metric pills.
- Do not render literal words from the prompt. Treat quoted terms, focus phrases, example labels, chip names, status names, and taxonomy words as semantic guidance only.
- If a UI element needs textual structure, replace it with abstract lines, neutral bars, dots, icons, or no-text placeholders.
- Do not render gibberish, pseudo-language, Cyrillic-like or Latin-like fake interface text, stray numbers, or unreadable word fragments.
- Do not add standalone logos or decorative brand marks.
- If any readable text survives, it must be in ${outputLanguage} only.
- Leave clean composition space where editorial copy could be added later, but keep the generated image itself text-free.
`.trim();
}

function buildNoVisibleTextLanguageLock(outputLanguage: string) {
  if (outputLanguage === 'Turkish') {
    return `
TEXT-FREE TURKISH BASE LOCK:
- Do not render Turkish ad copy in the base image; the app overlays final copy after generation.
- Do not render readable UI microcopy, chat text, status chips, or label text.
- Avoid English, Turkish-looking nonsense, pseudo-Turkish, no Cyrillic-like gibberish, malformed words, and partial translations.
- Use abstract skeleton bars, dots, neutral chips, icon-only controls, and no-text placeholders instead of readable words.
`.trim();
  }

  return `
TEXT-FREE ${outputLanguage.toUpperCase()} BASE LOCK:
- Do not render ${outputLanguage} ad copy in the base image; the app overlays final copy after generation.
- Do not render readable UI microcopy, chat text, status chips, or label text.
- Avoid mixed-language strings, pseudo-language, no Cyrillic-like gibberish, malformed words, and partial translations.
- Use abstract skeleton bars, dots, neutral chips, icon-only controls, and no-text placeholders instead of readable words.
`.trim();
}

function buildVisibleTextLanguageLock(outputLanguage: string) {
  if (outputLanguage === 'Turkish') {
    return `
TURKISH VISIBLE TEXT LOCK:
- Every visible conversation, chat bubble, message, reply, label, callout, status chip, score indicator, and UI text must be Turkish with natural Turkish characters.
- Do not render mixed-language or pseudo-Turkish strings; no gibberish, malformed words, or partial translations.
- Avoid readable English terms such as "Lead Scoring", "High Score", "Assistant", or "AI response"; use Turkish equivalents only when supporting text is truly necessary.
- Turkish ad copy must stay crisp, legible, and readable; do not blur, crop, hide, or skeletonize intended copy.
- If a chat bubble, message, reply, label, callout, status chip, score indicator, or UI text is intentionally visible, render it as short readable Turkish.
- Only decorative dense UI chrome may become abstract skeleton lines or no-text placeholders; never apply this to intended ad copy, message copy, or callout copy.
`.trim();
  }

  return `
VISIBLE TEXT LANGUAGE LOCK:
- Every visible conversation, chat bubble, message, reply, label, callout, status chip, score indicator, and UI text must be in ${outputLanguage}.
- Do not render mixed-language strings, pseudo-language gibberish, malformed words, or partial translations.
- ${outputLanguage} ad copy must stay crisp, legible, and readable; do not blur, crop, hide, or skeletonize intended copy.
- If a chat bubble, message, reply, label, callout, status chip, score indicator, or UI text is intentionally visible, render it as short readable ${outputLanguage}.
- Only decorative dense UI chrome may become abstract skeleton lines or no-text placeholders; never apply this to intended ad copy, message copy, or callout copy.
`.trim();
}

export const buildPrompt = (
  images: string[],
  productName: string,
  featureName: string,
  description: string,
  headline: string,
  subheadline: string,
  cta: string,
  brandColor: string,
  platform: string,
  campaignType: string,
  aspectRatio: string,
  tone: string,
  designStyle: string,
  theme: VisualTheme,
  mode: string,
  language: string,
  customInstruction: string,
  campaignFocus: string,
  variationIndex: number = 0,
  previousImage?: string,
  userComment?: string,
  referenceImage?: string | null,
  strategyContextPromptText?: string,
  realityContextPromptText?: string,
  includeCta: boolean = true
): string => {
  const outputLanguage = getSingleOutputLanguageName(language);
  const resolvedProductName = resolveVisualBrandName(productName);
  const strategyContextBlock = buildVisualStrategyContextBlock(strategyContextPromptText);
  const realityContextBlock = buildVisualRealityContextBlock(realityContextPromptText);
  const brandBlock = buildVisualBrandBlock(productName);
  const houseStyleBlock = buildVisualHouseStyleBlock(brandColor);
  const themeBlock = buildVisualThemeBlock(theme, variationIndex);
  const platformInstruction = buildPlatformInstruction(platform);
  const campaignObjectiveBlock = buildCampaignObjectiveBlock(campaignType, campaignFocus, featureName);
  const customInstructionBlock = buildCustomInstructionBlock(customInstruction);
  const visualAssetBlock = buildVisualAssetPlanningBlock(
    images,
    featureName,
    outputLanguage,
    campaignType,
    campaignFocus,
    previousImage,
    referenceImage
  );
  const referenceInstruction = buildReferenceInstruction(referenceImage);
  const feedbackInstruction = buildFeedbackInstruction(userComment);
  const variationPrompt = getVisualHouseStyleVariationText(variationIndex);
  const normalizedPlatform = String(platform || 'General').trim() || 'General';

  return `
You are a senior brand art director creating a Gemini-ready visual prompt for a SaaS marketing visual.

Return JSON only in this shape:
{
  "prompt": "A single English prompt for Gemini image generation"
}

Rules for the JSON response:
- Return valid JSON only. No markdown fences.
- The prompt must be in English.
- The prompt must stay concise and production-ready, roughly 90-160 words.
- The prompt must keep the ${VISUAL_HOUSE_STYLE.name} house style intact.
- The prompt must clearly describe one dominant signal object or one dominant subject, not a busy scene.
- ${buildMandatoryCopyRule(includeCta)}
- The prompt must mention that the brand color is a controlled accent, not a full-canvas wash.
- The prompt must avoid clutter, sticker energy, icon showers, chaotic gradients, meme tropes, and generic stock-SaaS vibes.
- The prompt must not invent features, workflows, or claims beyond the provided context.
- The prompt must honor the campaign objective before defaulting to feature-centric framing.
- The prompt must follow the non-negotiable custom instructions when they are present.
- The prompt must make the concept understandable at a glance in under 3 seconds.

INPUT CONTEXT:
Product Name: ${resolvedProductName}
Feature: ${featureName || 'New Feature'}
Description: ${description || 'Modern software application'}
Platform: ${normalizedPlatform}
Aspect Ratio: ${aspectRatio}
Campaign Type: ${campaignType}
Tone: ${tone}
Design Style: ${designStyle}
Theme Mode: ${theme}
Mode: ${mode}
Language for visible text: ${outputLanguage}
Campaign Focus / Theme: ${campaignFocus || 'General product promotion'}
Custom Instructions: ${customInstruction || 'None'}

${VISUAL_HOUSE_STYLE.name.toUpperCase()} HOUSE STYLE:
${houseStyleBlock}

${themeBlock}

${brandBlock}

${strategyContextBlock}

${realityContextBlock}

${campaignObjectiveBlock}

${customInstructionBlock}

${buildMandatoryCopyBlock(headline, subheadline, cta, includeCta)}

CREATIVE DIRECTION:
1. ${platformInstruction}
2. Variation direction: ${variationPrompt}
3. Emphasize one conversion path, one message, and one focal subject.
4. Use the brand color as a controlled accent and keep the rest of the palette calm.
5. If typography appears, it must be strong, sparse, and instantly legible.

${visualAssetBlock}
${referenceInstruction}
${feedbackInstruction}
`.trim();
};

export interface GeminiRenderPromptInput {
  plannedPrompt: string;
  headline: string;
  subheadline: string;
  cta: string;
  includeCta?: boolean;
  renderText?: boolean;
  language: string;
  images: string[];
  featureName: string;
  theme?: VisualTheme;
  variationIndex?: number;
  brandName?: string;
  hasBrandReferences?: boolean;
  campaignType?: string;
  campaignFocus?: string;
  customInstruction?: string;
  previousImage?: string;
  userComment?: string;
  referenceImage?: string | null;
  requireBrandPlacement?: boolean;
}

export function buildGeminiRenderPrompt(input: GeminiRenderPromptInput) {
  const outputLanguage = getSingleOutputLanguageName(input.language);
  const brandName = resolveVisualBrandName(input.brandName);
  const variationIndex = input.variationIndex ?? 0;
  const renderText = input.renderText ?? true;
  const normalizedPlannedPrompt = String(input.plannedPrompt || '').trim()
    || `Minimal ${VISUAL_HOUSE_STYLE.name} editorial poster for ${input.featureName || brandName || 'the product'}.`;
  const themeBlock = buildVisualThemeBlock(input.theme || 'mixed', variationIndex);
  const feedbackInstruction = buildFeedbackInstruction(input.userComment);
  const campaignObjectiveBlock = buildCampaignObjectiveBlock(
    input.campaignType || '',
    input.campaignFocus || '',
    input.featureName
  );
  const customInstructionBlock = buildCustomInstructionBlock(input.customInstruction || '');
  const requestedChannels = detectRequestedChannels([
    input.campaignFocus || '',
    input.customInstruction || '',
  ]);
  const fallbackRequestedChannels = requestedChannels.length > 0
    ? requestedChannels
    : detectRequestedChannels([input.plannedPrompt || '']);
  const channelPriorityBlock = buildChannelPriorityBlock(fallbackRequestedChannels);
  const channelAccentBlock = buildChannelAccentBlock(fallbackRequestedChannels);
  const textFreeThemeGuardrail = !renderText && (input.theme || 'mixed') === 'dark'
    ? '- Keep the generated base dark-dominant across the whole canvas; no bright white page takeover, no light-mode app screenshot, no pale document board.'
    : '';
  const textFreeSceneGuardrail = !renderText
    ? '- Keep the base as a product marketing UI/abstract SaaS composition; no daylight photography, city, building, street, map, landscape, camera feed, or real-world location scene.'
    : '';

  let assetInstruction = '';
  if (input.previousImage) {
    assetInstruction = `
EDIT MODE:
- The first attached image is the current generated visual to edit.
- Edit that provided generated image instead of rebuilding from zero.
- Keep the strongest existing composition choices unless the feedback requires a stronger change.
- The output must visibly apply the user feedback while preserving the supplied headline and subheadline copy.
`.trim();
  } else if (input.images.length > 0) {
    assetInstruction = `
SCREENSHOT HANDLING:
- Treat the uploaded screenshot as the primary structural source, not loose inspiration.
- Preserve recognizable panel geometry, spacing, and hierarchy from it.
- Simplify only dense labels, excessive chrome, and non-essential UI furniture.
- If the screenshot contains white or light surfaces, keep them crisp and solid.
`.trim();
  } else if (input.referenceImage) {
    assetInstruction = `
REFERENCE-LED COMPOSITION:
- Build the composition around the uploaded reference UI rather than inventing a different dashboard.
- Preserve the strongest panel structure and simplify only non-essential microcopy or chrome.
- Keep white or light surfaces crisp, bright, and product-real.
- Replace source-specific people identifiers and profile photos with fictional or generic markers.
`.trim();
  } else {
    assetInstruction = `
NO SCREENSHOT PROVIDED:
- Create the composition from scratch around one clear signal object, one cropped UI fragment, or one meaningful metaphor.
`.trim();
  }

  const referenceInstruction = input.referenceImage
    ? `
REFERENCE IMAGE HANDLING:
- Treat the uploaded image as primary UI source material, not a passive style reference.
- Keep recognizable panel geometry, spacing, and hierarchy from the reference.
- If the reference contains white or light surfaces, keep them crisp, bright, and solid.
- Do not reinterpret the reference as smoked glass, frosted panels, or a dark fantasy dashboard.
- Use 1-3 focused crops or panels from the reference.
- Emphasize the focus with one localized accent, outline, glow, zoom, or contrast shift.
- Simplify dense non-essential microcopy into no-text placeholders, but keep the product surface feeling real and close to the source.
- Never preserve real names, usernames, initials, avatar photos, or face crops from the reference.
- Simplify or regenerate avatars into generic fictional profile markers.
- If a tiny identity label survives, replace it with a fictional localized placeholder or omit the non-essential label.
- Do not copy its exact readable text, product copy, or layout verbatim.
`.trim()
    : '';

  const brandReferenceInstruction = input.hasBrandReferences
    ? `
BRAND REFERENCES:
- Official ${brandName} brand references are attached.
- Do not add a standalone decorative logo placement.
- If the product UI naturally includes a brand mark, it may remain there without becoming a focal point.
- Use attached official brand references only as correctness guides for any natural in-product brand mark such as the ${brandName} wordmark or icon.
- If both black or white logo variants are attached, choose the version with the clearest contrast against the local background.
- Do not isolate, badge, enlarge, or repeat brand marks.
`.trim()
      : '';

  const copyInstruction = renderText
    ? buildRenderCopyBlock(
        input.headline,
        input.subheadline,
        input.cta,
        input.includeCta ?? true
      )
    : buildNoVisibleCopyBlock(outputLanguage);

  const rendererRules = renderText
    ? `RENDERER RULES:
- All visible text must be in ${outputLanguage}.
- Only the supplied headline, subheadline, and CTA (if enabled) may appear as readable copy.
- Do not render prompt field names such as "Headline", "Subheadline", "CTA", or "Call to Action" as visible words.
${buildVisibleTextLanguageLock(outputLanguage)}
- If supporting UI copy is intentionally visible, keep it short, sparse, and readable in ${outputLanguage}.
- Only decorative dense UI chrome may become abstract skeleton lines or no-text placeholders.
- Do not invent extra readable labels, status words, chip text, button text, tooltip copy, or metric pills.
- Do not render English or malformed UI headers, field labels, card titles, person names, score badges, percentages, list rows, profile names, or assistant labels.
- Do not reproduce prompt phrases like "Customer Info", "customer profiles", "High score", "Lead Score", or "AI Automated Response" as visible UI text.
- ${outputLanguage === 'Turkish' ? 'Never render English words from the planned prompt, internal reasoning, or example UI labels.' : `Never render readable words in a language other than ${outputLanguage}.`}
- ${outputLanguage === 'Turkish' ? 'If a supporting label is unavoidable, translate it into short readable Turkish or omit the non-essential label.' : `If a supporting label is unavoidable, translate it into short readable ${outputLanguage} or omit the non-essential label.`}
- Never preserve imported names, usernames, initials, or identity tags from screenshots or reference images.
- Simplify or regenerate avatar/profile photos into generic fictional profile markers instead of keeping real faces.
- ${outputLanguage === 'Turkish' ? 'If an identity label is unavoidable, replace it with a fictional Turkish placeholder or omit the non-essential label.' : `If an identity label is unavoidable, replace it with a fictional ${outputLanguage} placeholder or omit the non-essential label.`}
- Do not clutter the image.
- Preserve the ${VISUAL_HOUSE_STYLE.name} house style and keep one dominant subject only.
- Keep supporting details sparse and subordinate.
- No sticker piles, icon showers, generic dashboard overload, or chaotic background effects.`
    : `RENDERER RULES:
- Keep the image strictly text-free. The planned prompt, focus field, reference examples, and category labels are compositional guidance only, not literal on-canvas copy.
- Never render English placeholder words, sample chip labels, taxonomies, or status names just because they appear in the prompt.
- Do not render prompt field names such as "Headline", "Subheadline", "CTA", or "Call to Action" as visible words.
${buildNoVisibleTextLanguageLock(outputLanguage)}
${textFreeThemeGuardrail}
${textFreeSceneGuardrail}
- Do not clutter the image.
- Preserve the ${VISUAL_HOUSE_STYLE.name} house style and keep one dominant subject only.
- Keep supporting details sparse and subordinate.
- No sticker piles, icon showers, generic dashboard overload, or chaotic background effects.`;

  return `
${copyInstruction}

${rendererRules}

PLANNED VISUAL DIRECTION:
- Interpret the following planned prompt semantically, not literally.
- Do not quote it or turn its wording into readable UI labels.
${normalizedPlannedPrompt}

${themeBlock}
${assetInstruction}
${campaignObjectiveBlock}
${channelPriorityBlock}
${channelAccentBlock}
${customInstructionBlock}
${referenceInstruction}
${brandReferenceInstruction}
${feedbackInstruction}
`.trim();
}
