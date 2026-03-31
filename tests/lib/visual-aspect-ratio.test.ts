import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  calculateCenteredAspectCrop,
  getGeminiImageConfigAspectRatio,
} from '../../src/lib/visual-aspect-ratio';

test('maps the unsupported 4:5 request to Gemini-safe 3:4 generation', () => {
  assert.equal(getGeminiImageConfigAspectRatio('1:1'), '1:1');
  assert.equal(getGeminiImageConfigAspectRatio('4:5'), '3:4');
  assert.equal(getGeminiImageConfigAspectRatio('16:9'), '16:9');
});

test('calculates a centered crop that converts 3:4 output into exact 4:5', () => {
  assert.deepEqual(calculateCenteredAspectCrop(300, 400, '4:5'), {
    sourceX: 0,
    sourceY: 12,
    sourceWidth: 300,
    sourceHeight: 375,
    outputWidth: 300,
    outputHeight: 375,
  });
});

test('app fits generated visuals back to the requested aspect ratio before storing them', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');

  assert.match(source, /fitGeneratedVisualToAspectRatio\(/);
});
