import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureFinalCallToAction, hasFinalCallToAction } from '../../src/lib/blog-call-to-action';

test('appends the final CTA heading and body for Turkish content', () => {
  const content = ensureFinalCallToAction('## Giriş\n\nMetin.', 'TR', 'Qualy', 'WhatsApp otomasyonu');

  assert.equal(content.includes('## Sonraki Adım'), true);
  assert.equal(hasFinalCallToAction(content, 'TR'), true);
  assert.equal(content.trim().endsWith('ekibimizle iletişime geçebilirsin.'), true);
});

test('replaces any trailing CTA block instead of duplicating it', () => {
  const content = ensureFinalCallToAction(
    '## Giriş\n\nMetin.\n\n## Sonraki Adım\n\nEski CTA metni.',
    'TR',
    'Qualy',
    'satış otomasyonu'
  );

  assert.equal(content.match(/## Sonraki Adım/g)?.length, 1);
  assert.equal(content.includes('Eski CTA metni.'), false);
});
