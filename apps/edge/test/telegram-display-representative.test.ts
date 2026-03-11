import test from 'node:test';
import assert from 'node:assert/strict';

function pickRepresentative(sources: Array<{datetimeMs:number; channel:string; subscriberValueScore:number; media:any[]; imageTextEn?:string;}>, scores: Map<string, number>, nowMs:number) {
  const freshnessWeight = (datetimeMs:number) => {
    if (!Number.isFinite(datetimeMs) || datetimeMs <= 0) return 0;
    const ageMs = Math.max(0, nowMs - datetimeMs);
    if (ageMs <= 20 * 60 * 1000) return 3;
    if (ageMs <= 2 * 60 * 60 * 1000) return 2;
    return 1;
  };
  return [...sources].sort((left, right) => {
    const leftFreshness = freshnessWeight(left.datetimeMs);
    const rightFreshness = freshnessWeight(right.datetimeMs);
    if (rightFreshness !== leftFreshness) return rightFreshness - leftFreshness;
    const leftScore = scores.get(left.channel) ?? left.subscriberValueScore ?? 0;
    const rightScore = scores.get(right.channel) ?? right.subscriberValueScore ?? 0;
    if (rightScore !== leftScore) return rightScore - leftScore;
    const leftEvidence = (left.media.length > 0 ? 2 : 0) + (((left.imageTextEn || '').trim().length > 0) ? 1 : 0);
    const rightEvidence = (right.media.length > 0 ? 2 : 0) + (((right.imageTextEn || '').trim().length > 0) ? 1 : 0);
    if (rightEvidence !== leftEvidence) return rightEvidence - leftEvidence;
    return right.datetimeMs - left.datetimeMs;
  })[0];
}

test('display representative prefers a fresher strong source over an older historically stronger one', () => {
  const nowMs = Date.UTC(2026,2,10,20,0,0);
  const older = { datetimeMs: nowMs - 7 * 60 * 60 * 1000, channel: 'oldalpha', subscriberValueScore: 95, media: [], imageTextEn: '' };
  const fresher = { datetimeMs: nowMs - 5 * 60 * 1000, channel: 'freshbeta', subscriberValueScore: 88, media: [{type:'photo'}], imageTextEn: '' };
  const picked = pickRepresentative([older, fresher], new Map([['oldalpha', 98], ['freshbeta', 84]]), nowMs);
  assert.equal(picked.channel, 'freshbeta');
});
