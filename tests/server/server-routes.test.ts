import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('server forwards social post reference-image context into the OpenAI planner', () => {
  const source = readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

  assert.match(
    source,
    /case 'plan-social-post-prompt':[\s\S]*hasReferenceImage:\s*req\.body\.hasReferenceImage[\s\S]*break;/
  );
});
