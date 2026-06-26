import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromptSummary } from '../src/prompt.js';
import { queryMatches, summarizeSeason } from '../src/selectors.js';
import { validateState } from '../src/validation.js';
import { makeManyMatches } from './helpers.js';

test('handles 500 matches with bounded queries and summaries', () => {
  const state = makeManyMatches(500);
  assert.doesNotThrow(() => validateState(state));

  const summary = summarizeSeason(state, '1998-99');
  assert.equal(summary.matchCount, 500);
  assert.equal(summary.appearances, 500);

  const cupRows = queryMatches(state, { competition: '杯赛', limit: 25 });
  assert.equal(cupRows.length, 25);

  const prompt = buildPromptSummary(state, { maxChars: 1000, recentMatchLimit: 3 });
  assert.ok(prompt.length <= 1000);
  assert.ok(!prompt.includes('对手100'));
});
