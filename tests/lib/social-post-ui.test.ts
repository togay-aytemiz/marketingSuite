import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('app exposes a third top-level tab for social posts', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(source, /socialPosts/);
  assert.match(source, /Social Posts/);
});

test('social post sidebar exposes the requested controls without redundant flow explanation cards', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'SocialPostSidebar.tsx'), 'utf8');

  assert.match(source, /Yeni özellik/);
  assert.match(source, /Genel ürün tanıtımı/);
  assert.match(source, /Blog/);
  assert.match(source, /Dark/);
  assert.match(source, /Light/);
  assert.match(source, /Türkçe/);
  assert.match(source, /English/);
  assert.match(source, /Yazı Dili/);
  assert.match(source, /Focus \/ Extra Direction/);
  assert.match(source, /Optional UI Source/);
  assert.match(source, /Blog Metni/);
  assert.match(source, /Plan shared copy/);
  assert.doesNotMatch(source, /Plan 4 copy/);
  assert.match(source, /Generate 4 visuals/);
  assert.match(source, /Shared Headline/);
  assert.match(source, /Shared Subheadline/);
  assert.match(source, /nextHeadlines\.fill\(value\)/);
  assert.match(source, /nextSubheadlines\.fill\(value\)/);
  assert.match(source, /state\.socialPostCategory === 'blog'/);
  assert.doesNotMatch(source, /socialPostImageInstructions\[index\]/);
  assert.doesNotMatch(source, /Gemini should use it as UI source material for the final marketing visual/i);
  assert.doesNotMatch(source, /simplified UI cards, crops, or interface fragments inside the composition/i);
  assert.doesNotMatch(source, /Boş bırakırsan AI focus ve visual hint'i kendi belirler/i);
  assert.doesNotMatch(source, /Tek bir ana brief gir\. Sistem aynı brief’i kullanıp 4 farklı varyasyon prompt üretecek\./i);
  assert.doesNotMatch(source, /Social Post Flow/);
  assert.doesNotMatch(source, /OpenAI builds the Gemini-ready prompt/i);
  assert.doesNotMatch(source, /Logo seçimi temaya göre otomatik yapılır/i);
  assert.doesNotMatch(source, /OpenAI planner prompt \+ Gemini render zinciri aktif/i);
});

test('social post app wiring separates copy planning from visual rendering', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(appSource, /handlePlanSocialPosts/);
  assert.match(appSource, /handleGenerateSocialPostVisuals/);
  assert.match(appSource, /onPlanCopy=\{handlePlanSocialPosts\}/);
  assert.match(appSource, /onGenerateVisuals=\{handleGenerateSocialPostVisuals\}/);
});

test('social post app composites the shared lockup onto generated text-free base images', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(appSource, /composeSocialPostVisualWithCopy/);
  assert.match(appSource, /socialPostBaseVisualsRef/);
  assert.match(appSource, /const baseVisual = fittedVisual \|\| visual/);
  assert.match(appSource, /headline:\s*plannedHeadline/);
  assert.match(appSource, /subheadline:\s*plannedSubheadline/);
});

test('social post planning reuses one shared headline and subheadline across all visual variations', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(appSource, /let sharedHeadline/);
  assert.match(appSource, /let sharedSubheadline/);
  assert.match(appSource, /nextHeadlines\[i\] = sharedHeadline/);
  assert.match(appSource, /nextSubheadlines\[i\] = sharedSubheadline/);
  assert.match(appSource, /state\.socialPostHeadlinePlans\.find/);
  assert.match(appSource, /state\.socialPostSubheadlinePlans\.find/);
});

test('social post magic edit replans the visual prompt from the user feedback before rendering', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(appSource, /const magicEditPlan = await planSocialPostPrompt/);
  assert.match(appSource, /extraInstruction:\s*comment/);
  assert.match(appSource, /magicEditPlan\?\.prompt\?\.trim\(\)/);
  assert.match(appSource, /const previousBaseVisual = state\.socialPostFinalVisuals\[index\]/);
  assert.match(appSource, /previousImage:\s*previousBaseVisual \|\| undefined/);
});

test('social post sidebar mirrors visual creator style with collapsible sections', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'SocialPostSidebar.tsx'), 'utf8');

  assert.match(source, /expandedSections/);
  assert.match(source, /toggleSection/);
  assert.match(source, /ChevronDown/);
  assert.match(source, /ChevronRight/);
  assert.match(source, /toggleSection\('setup'\)/);
  assert.match(source, /toggleSection\('prompt'\)/);
  assert.match(source, /toggleSection\('variations'\)/);
  assert.match(source, /toggleSection\('output'\)/);
  assert.match(source, /setup:\s*false/);
  assert.match(source, /prompt:\s*true/);
  assert.match(source, /variations:\s*false/);
  assert.match(source, /output:\s*false/);
});
