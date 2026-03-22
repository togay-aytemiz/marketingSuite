import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('documents the official Qualy website in AGENTS instructions', () => {
  const agentsPath = path.join(process.cwd(), 'AGENTS.md');
  const source = readFileSync(agentsPath, 'utf8');

  assert.equal(source.includes('https://www.askqualy.com'), true);
  assert.equal(source.toLowerCase().includes('qualy.ai'), true);
});

test('openai blog and internal-link prompts enforce the official Qualy domain', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'server', 'openai.ts'), 'utf8');

  assert.equal(source.includes('https://www.askqualy.com'), true);
  assert.equal(source.includes('Never invent, guess, or substitute another Qualy domain'), true);
  assert.equal(source.includes('When the article references the product website or homepage'), true);
});

test('legacy gemini prompts also enforce the official Qualy domain', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'server', 'gemini.ts'), 'utf8');

  assert.equal(source.includes('https://www.askqualy.com'), true);
  assert.equal(source.includes('Never invent, guess, or substitute another Qualy domain'), true);
});
