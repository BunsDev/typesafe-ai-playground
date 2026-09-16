// @ts-nocheck
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mod = import('../src/extraction/extraction.ts');
const sample = 'INVOICE\nVendor: Northstar Studio LLC\nInvoice date: 2026-09-01\nDue date: 2026-10-01\nSubtotal: $1,000.00\nTotal: $1,250.00';
test('candidates are exact source spans with grounded evidence', async () => {
  const { extractCandidates } = await mod;
  const candidates = extractCandidates(sample);
  for (const field of Object.values(candidates)) for (const c of field) {
    assert.equal(sample.slice(c.start, c.end), c.value);
    assert.ok(sample.includes(c.evidence));
  }
  assert.deepEqual(candidates.date.map(c => c.value), ['2026-09-01', '2026-10-01']);
  assert.ok(candidates.counterparty.some(c => c.value === 'Northstar Studio LLC'));
  assert.equal(candidates.amount.length, 2);
  assert.equal(candidates.document_type[0].value, 'INVOICE');
});
test('empty candidates return null without a request or invented probability', async () => {
  const { rankWithJev } = await mod;
  const result = await rankWithJev('date', [], 'No date here.', { transport: () => assert.fail('network') });
  assert.equal(result.value, null); assert.equal(result.probability, null);
  assert.equal(result.status, 'no_candidates');
});
test('closed set includes null and selection maps to source evidence', async () => {
  const { extractCandidates, rankWithJev } = await mod;
  const candidates = extractCandidates(sample).amount;
  const result = await rankWithJev('amount', candidates, sample, { transport: async payload => {
    assert.equal(payload.state.source, sample);
    assert.ok(payload.questions.extraction.criteria.null);
    assert.deepEqual(Object.keys(payload.questions.extraction.criteria), ['c0', 'c1', 'null']);
    return { answers: { extraction: { choice: 'c1', probabilities: { c1: 0.91 }, confidence: 0.8 } } };
  } });
  assert.equal(result.value, '$1,250.00'); assert.equal(result.probability, 0.91);
  assert.ok(result.evidence.includes('Total:'));
});
test('unknown choices and malformed probabilities are rejected', async () => {
  const { extractCandidates, rankWithJev } = await mod;
  for (const answer of [{choice:'invented'}, {choice:'c0', probabilities:{c0:null}}, {choice:'c0', probabilities:{c0:2}}]) {
    await assert.rejects(rankWithJev('date', extractCandidates(sample).date, sample, {transport: async () => ({answers:{extraction:answer}})}));
  }
});
test('null remains null, including evidence', async () => {
  const { extractCandidates, rankWithJev } = await mod;
  const r = await rankWithJev('date', extractCandidates(sample).date, sample, {transport: async () => ({answers:{extraction:{choice:'null', probabilities:{null:0.7}}}})});
  assert.equal(r.value, null); assert.equal(r.evidence, null); assert.equal(r.probability, 0.7);
});
test('selected fields only; failures do not erase successful rows', async () => {
  const { runExtraction } = await mod;
  const r = await runExtraction(sample, {fields:['date','amount'], transport: async payload => {
    if (payload.state.field === 'date') throw Error('Service unavailable');
    return {answers:{extraction:{choice:'c0', probabilities:{c0:0.8}}}};
  }});
  assert.equal(r.length, 2); assert.equal(r[0].status,'error'); assert.equal(r[1].status,'ranked');
});
