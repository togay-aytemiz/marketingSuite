import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('visual prompt preview modal includes both OpenAI and Gemini prompt sections', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx'), 'utf8');

  assert.match(source, /OpenAI Planner Brief/);
  assert.match(source, /Gemini Render Prompt/);
  assert.match(source, /OpenAI Planned Prompt/);
  assert.match(source, /planVisualPrompt\(/);
  assert.match(source, /buildGeminiRenderPrompt\(/);
});
