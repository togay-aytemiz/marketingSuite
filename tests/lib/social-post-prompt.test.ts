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
  assert.match(prompt, /headline lockup/i);
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
  assert.match(prompt, /If text is ever rendered later, it must be in Turkish/i);
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
  assert.match(prompt, /avoid flat pure black\/white emptiness/i);
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
  assert.match(prompt, /Allow one small Instagram gradient icon or badge near the focal area/i);
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
  assert.match(prompt, /If microcopy ever becomes unavoidable later, it must be in Turkish only/i);
  assert.match(prompt, /Keep UI panels, badges, profile cards, and score indicators free of readable microcopy/i);
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

test('social post planner prompt preserves white reference ui surfaces and localizes emphasis when a reference image exists', () => {
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
  assert.match(prompt, /Keep white or light panels crisp, solid, and product-real instead of turning them into smoked or frosted glass/i);
  assert.match(prompt, /Use one localized accent, outline, glow, crop, or contrast lift to make the requested focus read first/i);
  assert.match(prompt, /Do not reinterpret the source as a dark fantasy dashboard or generic glass cards/i);
  assert.match(prompt, /Never preserve personal names, usernames, initials, or profile photos from the reference/i);
  assert.match(prompt, /Blur, simplify, or regenerate avatars into generic fictional profile markers/i);
  assert.match(prompt, /If an identity label must survive, replace it with a fictional localized placeholder or make it unreadable/i);
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
