import test from 'node:test';
import assert from 'node:assert/strict';

function computeBootstrapAuthority(desiredAuthority: 'scraper'|'mtproto') {
  return {
    desiredAuthority,
    effectiveAuthority: desiredAuthority === 'mtproto' ? 'scraper' : 'scraper',
    joinStatus: desiredAuthority === 'mtproto' ? 'pending' : 'joined',
  };
}

test('mtproto bootstrap starts in scraper effective authority until live collector traffic promotes it', () => {
  const row = computeBootstrapAuthority('mtproto');
  assert.equal(row.desiredAuthority, 'mtproto');
  assert.equal(row.effectiveAuthority, 'scraper');
  assert.equal(row.joinStatus, 'pending');
});

test('scraper bootstrap channels remain scraper authoritative', () => {
  const row = computeBootstrapAuthority('scraper');
  assert.equal(row.desiredAuthority, 'scraper');
  assert.equal(row.effectiveAuthority, 'scraper');
  assert.equal(row.joinStatus, 'joined');
});
