import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('visual AI Ideas are not blocked by empty manual product details', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.doesNotMatch(source, /if \(isProductDetailsEmpty\) return;/);
  assert.doesNotMatch(source, /disabled=\{isGeneratingCopy \|\| isProductDetailsEmpty \|\| !openAiConfigured\}/);
  assert.doesNotMatch(source, /Please enter Product Details in Settings first/);
});

test('visual AI Ideas expose an optional emphasis input and pass it into copy generation', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /What should AI emphasize\?/);
  assert.match(source, /Leave blank to let AI decide/);
  assert.match(source, /aiIdeasDirection/);
  assert.match(source, /generateCopyIdeas\([\s\S]*aiIdeasDirection/);
});

test('visual AI Ideas auto-fill the current headline, subheadline, and CTA from the first suggestion set', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /headline:\s*ideas\.headlines\[0\]\s*\|\|\s*prev\.headline/);
  assert.match(source, /subheadline:\s*ideas\.subheadlines\[0\]\s*\|\|\s*prev\.subheadline/);
  assert.match(source, /cta:\s*prev\.includeCta\s*\?\s*ideas\.ctas\[0\]\s*\|\|\s*prev\.cta\s*:\s*prev\.cta/);
});

test('CTA field exposes an include toggle and disables text input when unchecked', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /Include CTA/);
  assert.match(source, /checked=\{state\.includeCta\}/);
  assert.match(source, /disabled=\{!state\.includeCta\}/);
});
