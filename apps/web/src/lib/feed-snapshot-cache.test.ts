import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSessionSnapshot, saveSessionSnapshot } from './feed-snapshot-cache.ts';

function createStorageShim(store: Map<string, string>): Storage {
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test('session snapshot cache stores and reloads fresh values', () => {
  const store = new Map<string, string>();
  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage: createStorageShim(store) } as Window & typeof globalThis;
  try {
    saveSessionSnapshot('telegram', { value: 1 });
    assert.deepEqual(loadSessionSnapshot('telegram', 60_000), { value: 1 });
  } finally {
    globalThis.window = previousWindow;
  }
});

test('session snapshot cache ignores stale values', () => {
  const store = new Map<string, string>();
  const previousWindow = globalThis.window;
  const now = Date.now();
  globalThis.window = { sessionStorage: createStorageShim(store) } as Window & typeof globalThis;
  store.set('telegram', JSON.stringify({ savedAt: now - 120_000, value: { stale: true } }));
  try {
    assert.equal(loadSessionSnapshot('telegram', 30_000), null);
  } finally {
    globalThis.window = previousWindow;
  }
});
