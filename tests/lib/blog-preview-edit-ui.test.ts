import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('blog preview edit composer uses a multiline textarea with shortcut guidance', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'components', 'BlogPreview.tsx'), 'utf8');

  assert.match(source, /<textarea[\s\S]*value=\{editInstruction\}/);
  assert.match(source, /Cmd\/Ctrl\+Enter to apply/i);
  assert.doesNotMatch(source, /<input[\s\S]*value=\{editInstruction\}/);
});
