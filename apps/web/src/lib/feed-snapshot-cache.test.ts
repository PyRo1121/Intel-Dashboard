import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSessionSnapshot, saveSessionSnapshot } from './feed-snapshot-cache.ts';

test('session snapshot cache stores and reloads fresh values', () => {
  const store = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  try {
    saveSessionSnapshot('telegram', { value: 1 });
    assert.deepEqual(loadSessionSnapshot('telegram', 60_000), { value: 1 });
  } finally {
    // @ts-expect-error restore
    globalThis.window = previousWindow;
  }
});

test('session snapshot cache ignores stale values', () => {
  const store = new Map();
  const previousWindow = globalThis.window;
  const now = Date.now();
  globalThis.window = { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  store.set('telegram', JSON.stringify({ savedAt: now - 120_000, value: { stale: true } }));
  try {
    assert.equal(loadSessionSnapshot('telegram', 30_000), null);
  } finally {
    // @ts-expect-error restore
    globalThis.window = previousWindow;
  }
});
