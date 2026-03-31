import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  generateCopyIdeas,
  generateMarketingCopy,
  generateVisualPromptPlan,
} from '../../src/server/openai';

function withTempStrategyDocs<T>(run: () => Promise<T>) {
  const previousCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketing-suite-visual-context-'));
  const appDir = path.join(tempRoot, 'marketing-suit');
  const docsDir = path.join(tempRoot, 'leadqualifier', 'docs');
  const landingDir = path.join(tempRoot, 'Qualy-lp');
  const landingComponentsDir = path.join(landingDir, 'components');

  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(landingComponentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsDir, 'PRD.md'),
    `# Qualy

> **Update Note (2026-03-28):** Added AI inbox routing.

### ✅ In Scope

| Feature | Description | Status |
| --- | --- | --- |
| AI Inbox | Shared support and sales inbox | Implemented |
| Team Assignment | Route conversations by owner | Implemented |
`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(docsDir, 'ROADMAP.md'),
    `- [x] Added deterministic routing
- [x] Shipped assignment visibility`,
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
    path.join(landingComponentsDir, 'Features.tsx'),
    `const currentScore = 8.6;
const scoreProgress = currentScore * 10;
const states = ['hot', 'warm', 'cold'];
`,
    'utf8'
  );

  process.chdir(appDir);

  return run().finally(() => {
    process.chdir(previousCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
}

test('generateMarketingCopy includes product strategy context in the visual-copy prompt', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'Smarter shared inbox',
                subheadline: 'Route every conversation with context.',
                cta: 'Try it',
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateMarketingCopy(
        'Qualy',
        'AI Inbox',
        'Unified inbox for support and sales teams.',
        'LinkedIn',
        'Feature announcement',
        'Professional',
        'EN'
      );
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
  assert.match(prompts[0] || '', /AI Inbox/);
  assert.match(prompts[0] || '', /Platform:\s+LinkedIn/i);
  assert.match(prompts[0] || '', /deterministic routing/i);
});

test('generateCopyIdeas includes product strategy context in the visual-copy ideation prompt', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headlines: ['AI Inbox for every team'],
                subheadlines: ['Assign and resolve faster'],
                ctas: ['See it'],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateCopyIdeas(
        'Qualy',
        'AI Inbox',
        'Unified inbox for support and sales teams.',
        'Instagram',
        'Feature announcement',
        'Professional',
        'EN'
      );
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
  assert.match(prompts[0] || '', /Team Assignment/);
  assert.match(prompts[0] || '', /Platform:\s+Instagram/i);
  assert.match(prompts[0] || '', /assignment visibility/i);
});

test('generateCopyIdeas forwards optional copy emphasis into the ideation prompt', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headlines: ['See what matters first'],
                subheadlines: ['Focus on the highest-intent conversations.'],
                ctas: ['Try Qualy'],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateCopyIdeas(
        'Qualy',
        'AI Inbox',
        'Unified inbox for support and sales teams.',
        'Instagram',
        'Product promotion',
        'Professional',
        'EN',
        'Lead kalitesini ve dönüşümü vurgula'
      );
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /USER COPY EMPHASIS:/);
  assert.match(prompts[0] || '', /Lead kalitesini ve dönüşümü vurgula/);
  assert.match(prompts[0] || '', /Use this emphasis to steer the headline, subheadline, and CTA/i);
});

test('generateMarketingCopy can explicitly disable CTA generation for visual-only layouts', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'Smarter shared inbox',
                subheadline: 'Route every conversation with context.',
                cta: '',
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateMarketingCopy(
        'Qualy',
        'AI Inbox',
        'Unified inbox for support and sales teams.',
        'Instagram',
        'Product promotion',
        'Professional',
        'EN',
        false
      );
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /CTA Enabled:\s+no/i);
  assert.match(prompts[0] || '', /return an empty string/i);
  assert.match(prompts[0] || '', /Do not invent a CTA/i);
});

test('generateVisualPromptPlan includes strategy context, platform, and house style guidance', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompt: 'Minimal Instagram poster for Qualy with one dominant signal object and short CTA.',
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateVisualPromptPlan({
        productName: 'Qualy',
        featureName: 'AI Inbox',
        description: 'Unified inbox for support and sales teams.',
        headline: 'Stop losing warm leads',
        subheadline: 'Prioritize conversations instantly.',
        cta: 'See Qualy',
        brandColor: '#84CC16',
        platform: 'Instagram',
        campaignType: 'Product promotion',
        aspectRatio: '4:5',
        tone: 'Professional',
        designStyle: 'Quiet Signal Editorial',
        theme: 'mixed',
        mode: 'Social Media Promo',
        language: 'EN',
        customInstruction: '',
        campaignFocus: 'Lead handoff speed',
        variationIndex: 0,
        hasScreenshots: false,
        hasReferenceImage: false,
        isMagicEdit: false,
      });
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /PRODUCT STRATEGY CONTEXT \(from PRD\/ROADMAP docs\):/);
  assert.match(prompts[0] || '', /LOCAL CODEBASE REALITY CONTEXT \(derived from nearby product code\):/);
  assert.match(prompts[0] || '', /0-10, not 0-100/i);
  assert.match(prompts[0] || '', /hot, warm, cold/i);
  assert.match(prompts[0] || '', /Platform:\s+Instagram/i);
  assert.match(prompts[0] || '', /HOUSE STYLE:\s+Quiet Signal/i);
  assert.match(prompts[0] || '', /one dominant subject/i);
});

test('generateVisualPromptPlan forbids CTA output when CTA is disabled', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompt: 'Minimal Instagram poster for Qualy with one dominant signal object.',
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateVisualPromptPlan({
        productName: 'Qualy',
        featureName: 'AI Inbox',
        description: 'Unified inbox for support and sales teams.',
        headline: 'Stop losing warm leads',
        subheadline: 'Prioritize conversations instantly.',
        cta: 'See Qualy',
        includeCta: false,
        brandColor: '#84CC16',
        platform: 'Instagram',
        campaignType: 'Product promotion',
        aspectRatio: '4:5',
        tone: 'Professional',
        designStyle: 'Quiet Signal Editorial',
        theme: 'mixed',
        mode: 'Social Media Promo',
        language: 'EN',
        customInstruction: '',
        campaignFocus: 'Lead handoff speed',
        variationIndex: 0,
        hasScreenshots: false,
        hasReferenceImage: false,
        isMagicEdit: false,
      });
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /headline and subheadline only/i);
  assert.match(prompts[0] || '', /CTA is disabled for this visual/i);
  assert.doesNotMatch(prompts[0] || '', /Call to Action \(CTA\) Button:/i);
});

test('generateCopyIdeas includes local codebase reality context in the visual-copy ideation prompt', async () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const prompts: string[] = [];

  process.env.OPENAI_API_KEY = 'sk-test';

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    prompts.push(String(body?.messages?.[1]?.content || ''));

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headlines: ['Prioritize real intent'],
                subheadlines: ['Use the shipped 0-10 score language.'],
                ctas: ['See Qualy'],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    await withTempStrategyDocs(async () => {
      await generateCopyIdeas(
        'Qualy',
        'AI Inbox',
        'Unified inbox for support and sales teams.',
        'Instagram',
        'Product promotion',
        'Professional',
        'EN'
      );
    });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }

  assert.match(prompts[0] || '', /LOCAL CODEBASE REALITY CONTEXT \(derived from nearby product code\):/);
  assert.match(prompts[0] || '', /0-10, not 0-100/i);
  assert.match(prompts[0] || '', /WhatsApp, Instagram, Messenger, and Telegram/i);
});
