import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldApplyBlogEditShortcut } from '../../src/lib/blog-edit-shortcuts';

test('applies blog edit only on Cmd/Ctrl+Enter shortcuts', () => {
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'Enter', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }),
    true
  );
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'Enter', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false }),
    true
  );
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }),
    false
  );
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'a', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }),
    false
  );
});

test('does not apply blog edit shortcut while composing or with modifier conflicts', () => {
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'Enter', metaKey: true, ctrlKey: false, shiftKey: false, altKey: true }),
    false
  );
  assert.equal(
    shouldApplyBlogEditShortcut({ key: 'Enter', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false }),
    false
  );
  assert.equal(
    shouldApplyBlogEditShortcut({
      key: 'Enter',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      isComposing: true,
    }),
    false
  );
});
