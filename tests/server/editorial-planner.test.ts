import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEditorialPlanningSnapshot,
  normalizePlanningLanguage,
} from '../../src/server/editorial-planner';

test('normalizes planning language for topic and blog routes', () => {
  assert.equal(normalizePlanningLanguage('TR'), 'TR');
  assert.equal(normalizePlanningLanguage('EN'), 'EN');
  assert.equal(normalizePlanningLanguage('BOTH'), 'BOTH');
  assert.equal(normalizePlanningLanguage('something-else'), 'TR');
});

test('deduplicates translation pairs by translationKey for BOTH while preserving category id', () => {
  const snapshot = buildEditorialPlanningSnapshot(
    [
      {
        _id: 'post.same.tr',
        title: 'TR Baslik',
        slug: { current: 'same-post-tr' },
        translationKey: 'same-post',
        language: 'tr',
        publishedAt: '2026-03-20T09:00:00.000Z',
        category: { _id: 'cat-a', title: 'Mesajlasma' },
      },
      {
        _id: 'post.same.en',
        title: 'EN Title',
        slug: { current: 'same-post-en' },
        translationKey: 'same-post',
        language: 'en',
        publishedAt: '2026-03-21T09:00:00.000Z',
        category: { _id: 'cat-a', title: 'Messaging' },
      },
      {
        _id: 'post.other.tr',
        title: 'Diger Yazi',
        slug: { current: 'diger-yazi' },
        translationKey: 'other-post',
        language: 'tr',
        publishedAt: '2026-03-19T09:00:00.000Z',
        category: { _id: 'cat-b', title: 'Otomasyon' },
      },
    ],
    [
      { _id: 'cat-a', title: 'Mesajlasma' as const },
      { _id: 'cat-b', title: 'Otomasyon' as const },
    ],
    'BOTH'
  );

  assert.equal(snapshot.recentPosts.length, 2);
  assert.equal(snapshot.recentPosts[0]?.title, 'EN Title');
  assert.equal(snapshot.recentPosts[0]?.slug, 'same-post-en');
  assert.equal(snapshot.recentPosts[0]?.language, 'en');
  assert.equal(snapshot.recentPosts[0]?.categoryId, 'cat-a');
  assert.equal(snapshot.recentPosts[1]?.title, 'Diger Yazi');
  assert.equal(snapshot.recentPosts[1]?.slug, 'diger-yazi');
  assert.equal(snapshot.recentPosts[1]?.language, 'tr');
  assert.deepEqual(snapshot.sanityCategories, [
    { id: 'cat-a', name: 'Mesajlasma' },
    { id: 'cat-b', name: 'Otomasyon' },
  ]);
});

test('filters posts by requested language before deduping translation pairs', () => {
  const snapshot = buildEditorialPlanningSnapshot(
    [
      {
        _id: 'post.same.tr',
        title: 'TR Baslik',
        slug: { current: 'same-post-tr' },
        translationKey: 'same-post',
        language: 'tr',
        publishedAt: '2026-03-20T09:00:00.000Z',
        category: { _id: 'cat-a', title: 'Mesajlasma' },
      },
      {
        _id: 'post.same.en',
        title: 'EN Title',
        slug: { current: 'same-post-en' },
        translationKey: 'same-post',
        language: 'en',
        publishedAt: '2026-03-21T09:00:00.000Z',
        category: { _id: 'cat-a', title: 'Messaging' },
      },
      {
        _id: 'post.tr.only',
        title: 'Sadece Turkce',
        slug: { current: 'sadece-turkce' },
        language: 'tr',
        publishedAt: '2026-03-18T09:00:00.000Z',
        category: { _id: 'cat-b', title: 'Otomasyon' },
      },
    ],
    [{ _id: 'cat-a', title: 'Messaging' as const }],
    'EN'
  );

  assert.deepEqual(
    snapshot.recentPosts.map((post) => post.title),
    ['EN Title']
  );
  assert.deepEqual(snapshot.recentPostTitles, ['EN Title']);
});

test('falls back to slug or id when translation key is missing', () => {
  const snapshot = buildEditorialPlanningSnapshot(
    [
      {
        _id: 'post-1',
        title: 'Slug First',
        slug: { current: 'shared-slug' },
        language: 'tr',
        publishedAt: '2026-03-20T09:00:00.000Z',
      },
      {
        _id: 'post-2',
        title: 'Slug Second',
        slug: { current: 'shared-slug' },
        language: 'tr',
        publishedAt: '2026-03-22T09:00:00.000Z',
      },
      {
        _id: 'post-3',
        title: 'Unique By Id',
        slug: { current: '' },
        language: 'tr',
        publishedAt: '2026-03-19T09:00:00.000Z',
      },
    ],
    [],
    'TR'
  );

  assert.deepEqual(
    snapshot.recentPosts.map((post) => post.title),
    ['Slug Second', 'Unique By Id']
  );
});
