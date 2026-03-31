import { getSingleOutputLanguageName } from './app-language';
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
- Use the uploaded screenshot only as loose structural reference.
- Redraw and simplify aggressively. Do not replicate dense UI, tiny labels, or dashboard clutter.
- Any visible UI text must be rendered in ${outputLanguage}.
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

- The new direction must incorporate this feedback without breaking the house style.
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
MANDATORY TEXT TO INCLUDE IN THE FINAL IMAGE:
Headline: "${headline || '[Auto-generated headline]'}"
Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
CTA: none

- CTA is disabled for this visual.
- Use headline and subheadline only.
- Do not add any button label, action chip, footer CTA, or invented action copy.
`.trim();
  }

  return `
MANDATORY TEXT TO INCLUDE IN THE FINAL IMAGE:
Headline: "${headline || '[Auto-generated headline]'}"
Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
Call to Action (CTA) Button: "${cta || '[Auto-generated CTA]'}"
`.trim();
}

function buildRenderCopyBlock(headline: string, subheadline: string, cta: string, includeCta: boolean) {
  if (!includeCta) {
    return `
MANDATORY TEXT TO RENDER:
Headline: "${headline || '[Auto-generated headline]'}"
Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
CTA: none

- CTA is disabled for this visual.
- Render headline and subheadline only.
- Do not add any button label, action chip, footer CTA, or invented action copy.
`.trim();
  }

  return `
MANDATORY TEXT TO RENDER:
Headline: "${headline || '[Auto-generated headline]'}"
Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
Call to Action (CTA) Button: "${cta || '[Auto-generated CTA]'}"
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
}

export function buildGeminiRenderPrompt(input: GeminiRenderPromptInput) {
  const outputLanguage = getSingleOutputLanguageName(input.language);
  const brandName = resolveVisualBrandName(input.brandName);
  const variationIndex = input.variationIndex ?? 0;
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

  let assetInstruction = '';
  if (input.previousImage) {
    assetInstruction = `
EDIT MODE:
- Edit the provided generated image instead of rebuilding from zero.
- Keep the strongest existing composition choices unless the feedback requires a stronger change.
`.trim();
  } else if (input.images.length > 0) {
    assetInstruction = `
SCREENSHOT HANDLING:
- Use the uploaded screenshot only as loose structural reference.
- Redraw and simplify the interface.
- Remove dense labels, excessive chrome, and non-essential UI furniture.
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
- Use the uploaded reference image for tone, composition, and pacing only.
- Do not copy its exact text or product.
`.trim()
    : '';

  const brandReferenceInstruction = input.hasBrandReferences
    ? `
BRAND REFERENCES:
- Official ${brandName} brand references are attached.
- Use the ${brandName} wordmark or icon as one small, clean anchor only.
- If both black or white logo variants are attached, choose the version with the clearest contrast against the local background.
- Keep brand marks subtle and premium, never repeated, distorted, or oversized.
`.trim()
    : '';

  return `
${normalizedPlannedPrompt}

${buildRenderCopyBlock(
    input.headline,
    input.subheadline,
    input.cta,
    input.includeCta ?? true
  )}

RENDERER RULES:
- All visible text must be in ${outputLanguage}.
- Do not clutter the image.
- Preserve the ${VISUAL_HOUSE_STYLE.name} house style and keep one dominant subject only.
- Keep supporting details sparse and subordinate.
- No sticker piles, icon showers, generic dashboard overload, or chaotic background effects.

${themeBlock}
${assetInstruction}
${campaignObjectiveBlock}
${customInstructionBlock}
${referenceInstruction}
${brandReferenceInstruction}
${feedbackInstruction}
`.trim();
}
