import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicApi } from '../src/public-api.js';
import { createDraft } from '../src/ledger-actions.js';
import { buildPromptSummary } from '../src/prompt.js';
import { getActiveContract, getFinanceSummary, queryMatches, summarizeSeason } from '../src/selectors.js';
import { exampleState } from './helpers.js';

test('calculates season summary from matches', () => {
  const summary = summarizeSeason(exampleState(), '1998-99');
  assert.equal(summary.appearances, 1);
  assert.equal(summary.starts, 1);
  assert.equal(summary.minutes, 88);
  assert.equal(summary.goals, 0);
  assert.equal(summary.assists, 1);
  assert.equal(summary.averageRating, 7.4);
});

test('selects active contract', () => {
  const contract = getActiveContract(exampleState());
  assert.equal(contract.club, '拜仁慕尼黑');
});

test('calculates multi-currency balances', () => {
  const state = exampleState();
  state.finance.openingBalances.push({ currency: 'EUR', amountMinor: 200 });
  state.finance.transactions.push({
    id: 'expense-1',
    date: '1998-08-22',
    type: 'expense',
    category: 'food',
    amountMinor: 50,
    currency: 'EUR',
    description: '',
    relatedContractId: null,
    notes: '',
  });
  const summary = getFinanceSummary(state);
  assert.deepEqual(summary.balances.find((row) => row.currency === 'EUR'), { currency: 'EUR', amountMinor: 150 });
});

test('query matches supports filters and safe limits', () => {
  const state = exampleState();
  const rows = queryMatches(state, { seasonId: '1998-99', notableOnly: true, limit: 5000 });
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0], state.matches[0]);
});

test('public api returns isolated objects', async () => {
  const state = exampleState();
  const api = createPublicApi(async () => state);
  assert.equal(api.apiVersion, 2);
  const snapshot = await api.getSnapshot();
  snapshot.player.name = 'changed';
  assert.notEqual(state.player.name, 'changed');
  assert.equal(await api.getBalance('DEM'), 28000);
  assert.ok(Array.isArray(await api.getAllBalances()));
  assert.equal(await api.getPendingDraftCount(), 0);
  assert.ok(await api.getSuggestionSchema('match'));
  assert.equal(typeof await api.getPromptPresetSummary('minimal'), 'string');
});

test('prompt presets do not inject pending draft facts', () => {
  const state = exampleState();
  createDraft(state, {
    type: 'match',
    status: 'pending',
    payload: { opponent: '不应进入事实摘要', goals: 9 },
    source: { messageId: 'm1', swipeId: 0, suggestionIndex: 0, contentHash: 'hash' },
  });
  const summary = buildPromptSummary(state, { preset: 'full', maxChars: 2000 });
  assert.match(summary, /当前有 1 条待确认账本草稿/);
  assert.doesNotMatch(summary, /不应进入事实摘要/);
});
