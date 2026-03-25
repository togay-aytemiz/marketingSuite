import test from 'node:test';
import assert from 'node:assert/strict';

import { syncDraftTitleHeading } from '../../src/lib/blog-title-sync';

test('syncDraftTitleHeading replaces the leading heading when it matches the previous title', () => {
  const result = syncDraftTitleHeading(
    '# Eski Başlık\n\nGiriş paragrafı.\n\n## İlk Bölüm\n\nDetaylar.',
    'Eski Başlık',
    'Yeni Başlık'
  );

  assert.equal(result, '# Yeni Başlık\n\nGiriş paragrafı.\n\n## İlk Bölüm\n\nDetaylar.');
});

test('syncDraftTitleHeading leaves the content unchanged when the leading heading differs', () => {
  const content = '## Giriş\n\nParagraf.\n\n## Bölüm\n\nDetay.';
  const result = syncDraftTitleHeading(content, 'Eski Başlık', 'Yeni Başlık');

  assert.equal(result, content);
});
