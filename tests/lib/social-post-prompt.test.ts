import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOCIAL_POST_DEFAULTS,
  SOCIAL_POST_IMAGE_SLOT_COUNT,
  buildSocialPostPlannerPrompt,
  getSocialPostPreviewMeta,
  resolveSocialPostAspectRatio,
  supportsSocialPostReferenceImage,
} from '../../src/lib/social-post-prompt';

test('social post defaults target a dark instagram feature post flow with four sequential slots', () => {
  assert.equal(SOCIAL_POST_DEFAULTS.platform, 'Instagram');
  assert.equal(SOCIAL_POST_DEFAULTS.theme, 'dark');
  assert.equal(SOCIAL_POST_DEFAULTS.category, 'new_feature');
  assert.equal(SOCIAL_POST_DEFAULTS.language, 'TR');
  assert.equal(SOCIAL_POST_IMAGE_SLOT_COUNT, 4);
});

test('social post aspect ratio follows platform presets', () => {
  assert.equal(resolveSocialPostAspectRatio('Instagram'), '4:5');
  assert.equal(resolveSocialPostAspectRatio('LinkedIn'), '1:1');
});

test('social post planner prompt keeps master style, theme adaptation, category system, and per-image focus together', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'new_feature',
    language: 'TR',
    focus: 'AI automatically tagging conversations',
    extraInstruction: 'Use floating tags around a central inbox card.',
    variationIndex: 1,
  });

  assert.match(prompt, /Create a modern SaaS product marketing visual/i);
  assert.match(prompt, /white haze \+ soft chrome bloom/i);
  assert.match(prompt, /editorial UI collage/i);
  assert.match(prompt, /Platform:\s+Instagram/i);
  assert.match(prompt, /Theme Mode:\s+dark/i);
  assert.match(prompt, /Category:\s+Feature announcement/i);
  assert.match(prompt, /Copy Language:\s+Turkish/i);
  assert.match(prompt, /FOCUS:\s+AI automatically tagging conversations/i);
  assert.match(prompt, /Use floating tags around a central inbox card\./i);
  assert.match(prompt, /VARIATION DIRECTION:/i);
  assert.match(prompt, /copy-safe zone/i);
});

test('social post planner prompt does not duplicate Gemini lockup copy inside the planned prompt field', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'EN',
    focus: 'WhatsApp, Instagram and Messenger unified inbox with AI reply and lead scoring',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /Reserve a clean typography-safe zone/i);
  assert.match(prompt, /Do not include the literal headline\/subheadline text or a second copy lockup inside the planned prompt field/i);
  assert.doesNotMatch(prompt, /Large headline lockup/i);
  assert.doesNotMatch(prompt, /typographic area dominant/i);
  assert.doesNotMatch(prompt, /strong readable headline lockup/i);
});

test('social post reference visuals stay scoped to feature and product overview categories', () => {
  assert.equal(supportsSocialPostReferenceImage('new_feature'), true);
  assert.equal(supportsSocialPostReferenceImage('product_overview'), true);
  assert.equal(supportsSocialPostReferenceImage('blog'), false);
});

test('social post planner prompt appends strategy and local reality context when provided', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'LinkedIn',
    theme: 'light',
    category: 'blog',
    language: 'EN',
    focus: 'Educational article card for AI lead qualification',
    blogContent: `How AI lead qualification works

AI can score incoming conversations, route them to the right team, and surface the hottest leads first.`,
    extraInstruction: '',
    variationIndex: 0,
    strategyContextPromptText: `Source Product: Qualy
Current In-Scope Features:
- AI Inbox
- Workflow automation`,
    realityContextPromptText: `Product surfaces consistently describe lead scoring as 0-10.
- Messaging channels: WhatsApp, Instagram, Messenger.`,
  });

  assert.match(prompt, /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
  assert.match(prompt, /Workflow automation/i);
  assert.match(prompt, /BLOG CONTENT CONTEXT:/);
  assert.match(prompt, /How AI lead qualification works/i);
  assert.match(prompt, /LOCAL CODEBASE REALITY CONTEXT \(derived from nearby product code\):/);
  assert.match(prompt, /0-10/i);
  assert.match(prompt, /Copy Language:\s+English/i);
});

test('social post planner prompt tells AI to decide focus and visual hint when the input is blank', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: '',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /FOCUS:\s+AI should decide the strongest focus/i);
  assert.match(prompt, /VISUAL HINT:\s+AI should decide the clearest visual hint/i);
  assert.match(prompt, /Any visible text in the final Gemini-rendered export must be in Turkish/i);
  assert.match(prompt, /planned prompt should avoid extra readable UI text entirely/i);
});

test('social post planner prompt allows restrained gradients and pattern detail instead of flat monochrome output', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'new_feature',
    language: 'TR',
    focus: 'Highlight the AI tagging capability',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /restrained indigo\/violet gradient/i);
  assert.match(prompt, /localized glow or gradient emphasis/i);
  assert.match(prompt, /subtle dot or grid pattern/i);
  assert.match(prompt, /low-contrast dot matrix field/i);
  assert.match(prompt, /evenly spaced micro-dots/i);
  assert.match(prompt, /refined background pattern layer/i);
  assert.match(prompt, /dot-matrix, halftone grid, contour lines, or faint connector-line network/i);
  assert.match(prompt, /5-12% visual weight/i);
  assert.match(prompt, /Avoid plain empty backgrounds/i);
  assert.match(prompt, /avoid flat pure black\/white emptiness/i);
});

test('social post planner prompt gives light mode a restrained glassy acrylic background without frosting core ui', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'light',
    category: 'product_overview',
    language: 'EN',
    focus: 'Qualy AI unified inbox for WhatsApp, Instagram, Telegram, and Messenger',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /soft glassy acrylic effect/i);
  assert.match(prompt, /frosted translucent background plates/i);
  assert.match(prompt, /specular edge highlights/i);
  assert.match(prompt, /keep the core product UI card crisp, opaque, and readable/i);
  assert.match(prompt, /do not turn the main UI into frosted glass/i);
});

test('social post planner prompt steers respond-like references toward glassy launch-card art direction', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'new_feature',
    language: 'EN',
    focus: 'AI replies for customer conversations',
    extraInstruction: 'Use the attached respond.io-like launch graphic as style inspiration.',
    variationIndex: 0,
  });

  assert.match(prompt, /glassy launch-card system/i);
  assert.match(prompt, /soft blue\/lilac\/violet gradient fields/i);
  assert.match(prompt, /haloed chat\/action bubbles/i);
  assert.match(prompt, /floating square AI icons/i);
  assert.match(prompt, /small brand wordmark near the top, large short headline/i);
  assert.match(prompt, /Do not copy respond\.io/i);
});

test('social post planner prompt can use restrained native-color social icons when channels are the story', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'Çok Kanallı Gelen Kutusu',
    description: 'WhatsApp, Instagram ve Messenger konuşmalarını tek yerde yönetin.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'WhatsApp, Instagram ve Messenger konuşmalarını tek akışta göster',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /Allow 1-2 small native-color channel icons only when the channel itself is central to the message/i);
  assert.match(prompt, /WhatsApp green, Instagram gradient, Messenger blue/i);
  assert.match(prompt, /Prefer outline, knockout, stencil, or cutout glyph treatments instead of filled app-icon tiles/i);
  assert.match(prompt, /Instagram should read as a camera outline, gradient rim, or cutout glyph/i);
  assert.match(prompt, /Do not turn the whole palette colorful just because one or two icons use their native colors/i);
});

test('social post planner prompt gives light themes a soft tinted lift and requested channel accent cues', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'Instagram Inbox',
    description: 'Instagram DM conversations managed with AI support.',
    platform: 'Instagram',
    theme: 'light',
    category: 'product_overview',
    language: 'TR',
    focus: 'AI reply to Instagram',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /soft editorial tint field/i);
  assert.match(prompt, /localized pastel accent field/i);
  assert.match(prompt, /plain flat white board/i);
  assert.match(prompt, /Allow one small Instagram gradient outline camera glyph, gradient rim, or knockout\/cutout badge near the focal area/i);
  assert.match(prompt, /do not use a filled app-tile, solid gradient square, or generic rounded gradient blob/i);
  assert.match(prompt, /faint rose-lilac-peach tint behind that zone/i);
});

test('social post planner prompt keeps an explicitly requested single channel above broader product-channel context', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'AI reply to Instagram',
    extraInstruction: '',
    variationIndex: 0,
    strategyContextPromptText: `Source Product: WhatsApp AI Qualy
Current In-Scope Features:
- WhatsApp automation`,
    realityContextPromptText: `Shipped Product Facts:
- Messaging channels repeated across shipped files: WhatsApp, Instagram, Messenger.`,
  });

  assert.match(prompt, /CHANNEL PRIORITY:/i);
  assert.match(prompt, /Requested channels:\s+Instagram/i);
  assert.match(prompt, /Do not swap the requested channel focus to WhatsApp, Messenger, Telegram, or other surrounding product channels/i);
  assert.match(prompt, /If a single channel is explicitly requested, keep the visual centered on that channel unless the user explicitly asks for a multi-channel story/i);
});

test('social post planner prompt locks the four variations to the editorial crop system', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'AI can score leads',
    extraInstruction: '',
    variationIndex: 2,
  });

  assert.match(prompt, /2-layer editorial UI collage/i);
  assert.match(prompt, /connector path/i);
  assert.match(prompt, /2-3 modules together but keep them sparse/i);
});

test('social post planner prompt keeps the quiet fourth variation theme-locked and product-ui based', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'WhatsApp ciddi müşterileri öne çıkar',
    extraInstruction: '',
    variationIndex: 3,
  });

  assert.match(prompt, /Use more whitespace without abandoning the requested theme or product-UI base/i);
  assert.match(prompt, /Keep at least one crisp SaaS UI fragment, panel, or product card clearly present/i);
  assert.match(prompt, /Do not turn the quiet variation into photography, a real-world location scene, a map, or a bright document screenshot/i);
  assert.match(prompt, /Every variation must remain a rendered social page post visual with product UI or abstract SaaS interface structure/i);
  assert.match(prompt, /Never turn a variation into daylight photography, city\/building\/street imagery, map-like views, or a bright text-heavy screenshot/i);
});

test('social post planner prompt reserves clean space for Gemini-rendered copy without duplicating literal copy in the prompt field', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'WhatsApp ciddi müşterileri öne çıkar',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /final Gemini render request receives the exact headline and subheadline separately/i);
  assert.match(prompt, /Reserve a clean typography-safe zone/i);
  assert.match(prompt, /Do not include the literal headline\/subheadline text or a second copy lockup inside the planned prompt field/i);
  assert.match(prompt, /planned prompt should avoid extra readable UI text entirely/i);
});

test('social post planner prompt treats example labels as semantic guidance instead of literal on-canvas copy', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'Lead Scoring',
    description: 'Qualify conversations with simple lead categories.',
    platform: 'LinkedIn',
    theme: 'light',
    category: 'product_overview',
    language: 'TR',
    focus: 'AI can score leads',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /Any example words, labels, status names, chip text, or focus phrases are semantic guidance only/i);
  assert.match(prompt, /Do not instruct Gemini to render those words literally on canvas/i);
  assert.match(prompt, /Outside the Gemini-rendered headline\/subheadline lockup, avoid intentional readable microcopy/i);
  assert.match(prompt, /If supporting UI copy is intentionally visible, keep it short, sparse, and readable in Turkish/i);
  assert.match(prompt, /Prefer abstract skeleton lines, dots, and no-text placeholders for decorative dense UI chrome/i);
});

test('social post planner prompt keeps unavoidable supporting ui text Turkish while preferring no-text skeletons', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'Lead Scoring',
    description: 'Qualify conversations with simple lead categories.',
    platform: 'Instagram',
    theme: 'light',
    category: 'product_overview',
    language: 'TR',
    focus: 'Instagram mesajlarını otomatik yanıtla',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /Outside the Gemini-rendered headline\/subheadline lockup, avoid readable conversation, chat bubble, message, reply, label, callout, status chip, score indicator, and UI text/i);
  assert.match(prompt, /If any unavoidable visible UI text remains, it must be Turkish/i);
  assert.match(prompt, /Do not render mixed-language or pseudo-Turkish strings/i);
  assert.match(prompt, /Avoid readable English terms such as "Lead Scoring", "High Score", "Assistant", or "AI response"/i);
  assert.match(prompt, /Do not include Turkish ad copy inside the planned prompt field/i);
  assert.match(prompt, /If supporting chat or UI text is unavoidable, use short natural Turkish phrases/i);
  assert.doesNotMatch(prompt, /make the supporting UI text unreadable/i);
});

test('social post planner prompt avoids standalone logo placements while keeping ui marks non-focal', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'Lead Scoring',
    description: 'Qualify conversations with simple lead categories.',
    platform: 'LinkedIn',
    theme: 'dark',
    category: 'product_overview',
    language: 'TR',
    focus: 'AI can score leads',
    extraInstruction: '',
    variationIndex: 0,
  });

  assert.match(prompt, /Do not plan standalone decorative logo placements or make the composition revolve around a logo/i);
  assert.match(prompt, /If the product ui naturally contains a brand mark, it may appear there, but it should stay non-focal/i);
  assert.match(prompt, /Never introduce English ui labels or placeholder words when the selected language is Turkish/i);
});

test('social post planner prompt keeps dark reference-image variations from drifting into light canvases', () => {
  const prompt = buildSocialPostPlannerPrompt({
    productName: 'Qualy',
    featureName: 'AI Inbox',
    description: 'Unified inbox for support and sales teams.',
    platform: 'Instagram',
    theme: 'dark',
    category: 'new_feature',
    language: 'TR',
    focus: 'Özet sekmesini öne çıkar',
    extraInstruction: '',
    variationIndex: 0,
    hasReferenceImage: true,
  } as any);

  assert.match(prompt, /Treat the uploaded reference UI as the primary product surface source/i);
  assert.match(prompt, /Adapt white or light reference panels into dark graphite or ink surfaces/i);
  assert.match(prompt, /Do not produce a bright white page, spreadsheet, chart, table, axis plot, or light-mode dashboard/i);
  assert.match(prompt, /Use one localized accent, outline, glow, crop, or contrast lift to make the requested focus read first/i);
  assert.doesNotMatch(prompt, /Keep white or light panels crisp, solid, and product-real instead of turning them into smoked or frosted glass/i);
  assert.match(prompt, /Never preserve personal names, usernames, initials, or profile photos from the reference/i);
  assert.match(prompt, /Simplify or regenerate avatars into generic fictional profile markers/i);
  assert.match(prompt, /If an identity label must survive, replace it with a fictional localized placeholder or omit the non-essential label/i);
});

test('social post preview meta makes blog/article intent explicit in the card header', () => {
  assert.deepEqual(
    getSocialPostPreviewMeta({
      category: 'blog',
      language: 'TR',
      platform: 'Instagram',
      variationIndex: 1,
    }),
    {
      badge: 'BLOG / MAKALE',
      title: 'Varyasyon 2',
      subtitle: 'Instagram makale paylaşımı',
    }
  );

  assert.deepEqual(
    getSocialPostPreviewMeta({
      category: 'blog',
      language: 'EN',
      platform: 'LinkedIn',
      variationIndex: 0,
    }),
    {
      badge: 'BLOG / ARTICLE',
      title: 'Variation 1',
      subtitle: 'LinkedIn article share',
    }
  );
});
