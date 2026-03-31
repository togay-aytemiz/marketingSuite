import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildVisualRealityContextPromptText,
  getVisualRealityContextSnapshot,
} from '../../src/server/visual-reality-context';

test('buildVisualRealityContextPromptText renders concise local-product reality facts', () => {
  const prompt = buildVisualRealityContextPromptText({
    sourcePaths: ['/tmp/leadqualifier', '/tmp/Qualy-lp'],
    facts: [
      'Lead scoring uses a 0-10 scale in shipped product surfaces.',
      'Lead priority states are hot, warm, and cold.',
      'Channels repeated across product files: WhatsApp, Instagram, Messenger, Telegram.',
    ],
  });

  assert.match(prompt, /0-10 scale/i);
  assert.match(prompt, /hot, warm, and cold/i);
  assert.match(prompt, /WhatsApp, Instagram, Messenger, Telegram/i);
});

test('getVisualRealityContextSnapshot discovers score scale and channels from nearby repos', () => {
  const previousCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketing-suite-visual-reality-'));
  const appDir = path.join(tempRoot, 'marketing-suit');
  const productDir = path.join(tempRoot, 'leadqualifier');
  const landingDir = path.join(tempRoot, 'Qualy-lp');

  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(path.join(productDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(landingDir, 'components'), { recursive: true });

  fs.writeFileSync(
    path.join(productDir, 'docs', 'PRD.md'),
    `# Qualy

**Lead Score (0-10):**
- Decisive booking intent: +3

- Status model: hot / warm / cold
- Intent stage values: none, informational_commercial, qualification, booking_ready
`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(landingDir, 'LanguageContext.tsx'),
    `export const hero = {
  subheadline: "Qualy automates repetitive WhatsApp, Instagram, Messenger, and Telegram conversations with Skills + Knowledge Base, scores intent 1-10, and hands chats to your team at the right moment."
};
`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(landingDir, 'components', 'Features.tsx'),
    `const currentScore = 8.6;
const scoreProgress = currentScore * 10;
const labels = ['hot', 'warm', 'cold'];
`,
    'utf8'
  );

  process.chdir(appDir);

  try {
    const snapshot = getVisualRealityContextSnapshot();

    assert.equal(snapshot.available, true);
    assert.match(snapshot.promptText, /0-10, not 0-100/i);
    assert.match(snapshot.promptText, /hot, warm, cold/i);
    assert.match(snapshot.promptText, /WhatsApp, Instagram, Messenger, and Telegram/i);
    assert.match(snapshot.promptText, /Skills \+ Knowledge Base/i);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
