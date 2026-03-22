import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSanityPublishMessage } from '../../src/lib/blog-publish-feedback';

test('clarifies that a successful site refresh only updates the local Qualy project', () => {
  const message = buildSanityPublishMessage({
    attempted: true,
    succeeded: true,
    projectPath: '/Users/togay/Desktop/Qualy-lp',
    message: 'Qualy blog artifacts refreshed.',
  });

  assert.equal(
    message,
    "Sanity'e gonderildi. /Users/togay/Desktop/Qualy-lp altindaki local Qualy blog dosyalari yenilendi. Canli sitede gormek icin ayrica deploy etmen gerekir."
  );
});

test('surfaces local refresh failures without hiding the Sanity publish success', () => {
  const message = buildSanityPublishMessage({
    attempted: true,
    succeeded: false,
    projectPath: '/Users/togay/Desktop/Qualy-lp',
    message: 'spawn ENOENT',
  });

  assert.equal(
    message,
    "Sanity'e gonderildi. /Users/togay/Desktop/Qualy-lp altindaki local blog refresh basarisiz: spawn ENOENT"
  );
});

test('returns the base success message when no local refresh was attempted', () => {
  const message = buildSanityPublishMessage({
    attempted: false,
    succeeded: false,
    projectPath: null,
    message: 'Qualy blog project path is not configured.',
  });

  assert.equal(message, "Sanity'e gonderildi.");
});
