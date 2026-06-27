import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMatch,
  addSeason,
  addTransaction,
  applyAbilityChange,
  closeSeason,
  confirmDraft,
  createDraft,
  createNextSeason,
  deleteSeason,
  setInitialAbilities,
  undoLastOperation,
  updateAbilityHistory,
  updateDraft,
  updateSeason,
} from '../src/ledger-actions.js';
import { parseSeasonInput } from '../src/season-utils.js';
import { addSuggestionDrafts, parseSuggestionBlocks } from '../src/suggestions.js';
import { getFinanceSummary, summarizeSeason } from '../src/selectors.js';
import { createInitialState, migrateState } from '../src/schema.js';
import { validateState } from '../src/validation.js';
import { exampleState } from './helpers.js';

test('migrates v1 data to v2 without losing core records', () => {
  const oldState = exampleState();
  oldState.schemaVersion = 1;
  delete oldState.player.currentTeam;
  delete oldState.matches[0].meta;
  oldState.customUserField = { keep: true };
  const state = migrateState(oldState);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.matches.length, 1);
  assert.equal(state.matches[0].assists, 1);
  assert.equal(state.matches[0].meta.source.type, 'migration');
  assert.deepEqual(state.customUserField, { keep: true });
  assert.doesNotThrow(() => validateState(state));
});

test('match CRUD updates derived season summary', () => {
  const state = exampleState();
  addMatch(state, {
    seasonId: '1998-99',
    date: '1998-09-02',
    competition: '青年联赛',
    club: '拜仁慕尼黑青年队',
    opponent: '多特蒙德青年队',
    homeAway: 'home',
    goalsFor: 3,
    goalsAgainst: 1,
    started: false,
    minutes: 20,
    goals: 1,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    rating: 7.2,
    notable: false,
    notes: '',
  });
  const summary = summarizeSeason(state, '1998-99');
  assert.equal(summary.matchCount, 2);
  assert.equal(summary.goals, 1);
});

test('season template and slash input normalize to stable season ids', () => {
  assert.deepEqual(parseSeasonInput('1998/1999'), {
    id: '1998-99',
    label: '1998/99',
    startedAt: '1998-07-01',
    endedAt: '1999-06-30',
  });
  const state = createInitialState('1998-01-01T00:00:00.000Z');
  addSeason(state, {
    id: '1998/99',
    club: '一线队',
    status: 'active',
  });
  assert.equal(state.seasons[0].id, '1998-99');
  assert.equal(state.seasons[0].label, '1998/99');
  assert.equal(state.player.currentSeasonId, '1998-99');
  assert.equal(state.player.currentTeam, '一线队');
});

test('next season creation requires closing active season first', () => {
  const state = exampleState();
  assert.throws(() => createNextSeason(state, {
    id: '1999-00',
    club: '拜仁慕尼黑预备队',
    startedAt: '1999-07-01',
  }), /先结束当前活动赛季/);
});

test('finance balance is calculated from opening balances and transactions', () => {
  const state = exampleState();
  addTransaction(state, {
    date: '1998-09-02',
    direction: 'expense',
    category: 'food',
    amountMinor: 3000,
    currency: 'DEM',
    description: '生活费',
  });
  const balance = getFinanceSummary(state).balances.find((item) => item.currency === 'DEM');
  assert.equal(balance.amountMinor, 25000);
});

test('ability change records history and can be undone', () => {
  const state = exampleState();
  applyAbilityChange(state, {
    date: '1998-09-03',
    ability: 'passing',
    delta: 1,
    reason: '连续比赛承担组织职责',
  });
  assert.equal(state.abilities.current.passing, 68);
  assert.equal(state.abilities.history[0].before, 67);
  undoLastOperation(state);
  assert.equal(state.abilities.current.passing, 67);
});

test('initial abilities can be set without creating growth history', () => {
  const state = createInitialState('1998-01-01T00:00:00.000Z');
  setInitialAbilities(state, {
    date: '1998-01-01',
    reason: '开档基础能力',
    values: {
      pace: 61,
      shooting: 52,
      passing: 67,
      control: 65,
      defending: 56,
      physical: 58,
      awareness: 101,
    },
  });
  assert.equal(state.abilities.current.passing, 67);
  assert.equal(state.abilities.current.awareness, 99);
  assert.equal(state.abilities.history.length, 0);
  assert.equal(state.operationHistory[0].type, 'set_initial_abilities');
  undoLastOperation(state);
  assert.equal(state.abilities.current.passing, 0);
});

test('initial abilities cannot overwrite existing ability history', () => {
  const state = exampleState();
  assert.throws(() => setInitialAbilities(state, {
    values: { passing: 70 },
  }), /已有能力历史/);
});

test('ability history can be edited', () => {
  const state = exampleState();
  const id = state.abilities.history[0].id;
  updateAbilityHistory(state, id, {
    date: '1998-09-02',
    ability: 'passing',
    before: 66,
    after: 68,
    reason: '复评修正',
  });
  assert.equal(state.abilities.history.find((item) => item.id === id).after, 68);
  assert.equal(state.abilities.current.passing, 68);
});

test('parses multiple suggestion blocks and deduplicates drafts', () => {
  const state = exampleState();
  const text = `
叙事正文。
<football_ledger_suggestion>{"type":"miscellaneous","payload":{"date":"1998-09-04","key":"role","value":"替补","tags":["队内角色"],"notes":""}}</football_ledger_suggestion>
<football_ledger_suggestion>{"type":"bad","payload":{}}</football_ledger_suggestion>`;
  const blocks = parseSuggestionBlocks(text, { chatId: 'chat', messageId: 'm1', swipeId: 0 });
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].status, 'invalid');
  const first = addSuggestionDrafts(state, text, { chatId: 'chat', messageId: 'm1', swipeId: 0 });
  const second = addSuggestionDrafts(state, text, { chatId: 'chat', messageId: 'm1', swipeId: 0 });
  assert.equal(first.added, 2);
  assert.equal(second.added, 0);
  assert.equal(state.drafts.length, 2);
});

test('draft payload, type and status can be edited', () => {
  const state = exampleState();
  createDraft(state, {
    type: 'miscellaneous',
    status: 'invalid',
    payload: {},
    source: { messageId: 'm-edit', swipeId: 0, suggestionIndex: 0, contentHash: 'edit' },
  });
  const draftId = state.drafts[0].id;
  updateDraft(state, draftId, {
    type: 'miscellaneous',
    status: 'pending',
    payload: { date: '1998-09-06', key: 'role', value: '轮换', tags: [], notes: '' },
    validationErrors: [],
  });
  assert.equal(state.drafts[0].status, 'pending');
  assert.equal(state.drafts[0].payload.value, '轮换');
});

test('confirm draft writes formal record and undo restores previous state', () => {
  const state = exampleState();
  createDraft(state, {
    type: 'match',
    status: 'pending',
    payload: {
      seasonId: '1998-99',
      date: '1998-09-05',
      competition: '青年联赛',
      club: '拜仁慕尼黑青年队',
      opponent: '勒沃库森青年队',
      homeAway: 'away',
      goalsFor: 1,
      goalsAgainst: 1,
      started: true,
      minutes: 90,
      goals: 0,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
      rating: 7,
      notable: false,
      notes: '',
    },
    source: { messageId: 'm2', swipeId: 0, suggestionIndex: 0, contentHash: 'x' },
  });
  const draftId = state.drafts[0].id;
  confirmDraft(state, draftId);
  assert.equal(state.drafts[0].status, 'confirmed');
  assert.equal(state.matches.length, 2);
  undoLastOperation(state);
  assert.equal(state.matches.length, 1);
  assert.equal(state.drafts.find((draft) => draft.id === draftId).status, 'pending');
});

test('failed draft confirmation does not write formal records', () => {
  const state = exampleState();
  createDraft(state, {
    type: 'match',
    status: 'pending',
    payload: {
      seasonId: 'missing',
      date: '1998-09-05',
      opponent: '无效赛季',
    },
    source: { messageId: 'm3', swipeId: 0, suggestionIndex: 0, contentHash: 'bad' },
  });
  const draftId = state.drafts[0].id;
  confirmDraft(state, draftId);
  assert.equal(state.matches.length, 1);
  assert.equal(state.drafts.find((draft) => draft.id === draftId).status, 'invalid');
});

test('season closure stores calculated totals and next season can be created', () => {
  const state = exampleState();
  closeSeason(state, '1998-99', {
    finalStanding: '青年联赛中游',
    roleAtEnd: '青年队主力',
    narrativeSummary: '完成适应期',
    teamHonors: '',
    individualHonors: '',
  });
  const closed = state.seasons.find((season) => season.id === '1998-99');
  assert.equal(closed.status, 'completed');
  assert.equal(closed.closedSummary.calculatedTotals.assists, 1);
  assert.equal(closed.closedSummary.teamOutcome, '1次出场，1次首发，88分钟，0球，1次助攻');
  createNextSeason(state, {
    id: '1999-00',
    label: '1999/00',
    club: '拜仁慕尼黑预备队',
    currentClub: '拜仁慕尼黑',
    currentTeam: '拜仁慕尼黑预备队',
    startedAt: '1999-07-01',
  });
  assert.equal(state.player.currentSeasonId, '1999-00');
  assert.equal(state.player.currentClub, '拜仁慕尼黑');
  assert.equal(state.player.currentTeam, '拜仁慕尼黑预备队');
  assert.equal(state.seasons.find((season) => season.id === '1999-00').club, '拜仁慕尼黑预备队');
  assert.equal(state.operationHistory[0].after, null);
});

test('next season creation supports transfers to another club and team', () => {
  const state = exampleState();
  closeSeason(state, '1998-99', {});
  createNextSeason(state, {
    id: '1999-00',
    label: '1999/00',
    club: '斯图加特一线队',
    currentClub: '斯图加特',
    currentTeam: '斯图加特一线队',
    startedAt: '1999-07-01',
  });
  assert.equal(state.player.currentClub, '斯图加特');
  assert.equal(state.player.currentTeam, '斯图加特一线队');
  assert.equal(state.seasons.find((season) => season.id === '1999-00').club, '斯图加特一线队');
});

test('season deletion refuses existing match references', () => {
  const state = exampleState();
  assert.throws(() => deleteSeason(state, '1998-99'), /仍有比赛记录/);
});

test('manual season totals override match aggregation in summarizeSeason', () => {
  const state = exampleState();
  const auto = summarizeSeason(state, '1998-99');
  assert.equal(auto.hasManualTotals, false);
  // Override goals and assists; leave the rest to auto aggregation.
  updateSeason(state, '1998-99', { manualTotals: { goals: 25, assists: 18 } });
  const summary = summarizeSeason(state, '1998-99');
  assert.equal(summary.goals, 25);
  assert.equal(summary.assists, 18);
  assert.equal(summary.hasManualTotals, true);
  // Non-overridden fields keep the calculated values.
  assert.equal(summary.appearances, auto.appearances);
  assert.equal(summary.minutes, auto.minutes);
  // Pure aggregation stays available for the UI hint.
  assert.equal(summary.autoTotals.goals, auto.goals);
  assert.equal(summary.autoTotals.assists, auto.assists);
});

test('blank manual totals clear the override and fall back to auto', () => {
  const state = exampleState();
  updateSeason(state, '1998-99', { manualTotals: { goals: 25 } });
  assert.equal(summarizeSeason(state, '1998-99').goals, 25);
  // Empty strings normalize to null → no override stored.
  updateSeason(state, '1998-99', { manualTotals: { goals: '', assists: '' } });
  const season = state.seasons.find((item) => item.id === '1998-99');
  assert.equal(season.manualTotals, null);
  assert.equal(summarizeSeason(state, '1998-99').hasManualTotals, false);
});

test('closeSeason applies manual totals to the stored closed summary', () => {
  const state = exampleState();
  closeSeason(state, '1998-99', {
    finalStanding: '青年联赛中游',
    manualTotals: { goals: 30, assists: 20, appearances: 12 },
  });
  const closed = state.seasons.find((season) => season.id === '1998-99');
  assert.equal(closed.status, 'completed');
  assert.equal(closed.manualTotals.goals, 30);
  assert.equal(closed.closedSummary.calculatedTotals.goals, 30);
  assert.equal(closed.closedSummary.calculatedTotals.assists, 20);
  assert.equal(closed.closedSummary.calculatedTotals.appearances, 12);
  assert.match(closed.closedSummary.teamOutcome, /30球/);
  // Undo restores the season without the override.
  undoLastOperation(state);
  const restored = state.seasons.find((season) => season.id === '1998-99');
  assert.equal(restored.status, 'active');
  assert.equal(restored.manualTotals, null);
});
