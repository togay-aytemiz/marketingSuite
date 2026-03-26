import test from 'node:test';
import assert from 'node:assert/strict';

import {
  preferInternalLinkTargets,
  preferNonEmptyArray,
  shouldRequireEditorialCategories,
  shouldLoadEditorialSnapshot,
} from '../../src/lib/editorial-request-fallback';

test('shouldLoadEditorialSnapshot includes all blog planning and linking actions', () => {
  assert.equal(shouldLoadEditorialSnapshot('generate-topic-ideas'), true);
  assert.equal(shouldLoadEditorialSnapshot('generate-blog-post'), true);
  assert.equal(shouldLoadEditorialSnapshot('add-internal-links'), true);
  assert.equal(shouldLoadEditorialSnapshot('edit-blog-post'), true);
  assert.equal(shouldLoadEditorialSnapshot('generate-social-posts'), false);
});

test('shouldRequireEditorialCategories stays limited to generation actions', () => {
  assert.equal(shouldRequireEditorialCategories('generate-topic-ideas'), true);
  assert.equal(shouldRequireEditorialCategories('generate-blog-post'), true);
  assert.equal(shouldRequireEditorialCategories('add-internal-links'), false);
  assert.equal(shouldRequireEditorialCategories('edit-blog-post'), false);
});

test('preferNonEmptyArray falls back when the preferred array is empty', () => {
  assert.deepEqual(preferNonEmptyArray([], [{ slug: 'fallback' }]), [{ slug: 'fallback' }]);
  assert.deepEqual(preferNonEmptyArray(undefined, [{ slug: 'fallback' }]), [{ slug: 'fallback' }]);
  assert.deepEqual(preferNonEmptyArray([{ slug: 'primary' }], [{ slug: 'fallback' }]), [{ slug: 'primary' }]);
});

test('preferInternalLinkTargets keeps the first non-empty source and filters out entries without slugs', () => {
  assert.deepEqual(
    preferInternalLinkTargets(
      [{ title: 'Bad', slug: '' }, { title: 'Good', slug: 'good-slug', language: 'tr' }],
      [{ title: 'Fallback', slug: 'fallback-slug' }]
    ),
    [{ title: 'Good', slug: 'good-slug', language: 'tr' }]
  );

  assert.deepEqual(
    preferInternalLinkTargets([], [{ title: 'Fallback', slug: 'fallback-slug' }]),
    [{ title: 'Fallback', slug: 'fallback-slug' }]
  );
});
