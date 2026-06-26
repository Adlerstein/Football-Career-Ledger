import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportSummary, exportStateJson, parseImportJson } from '../src/import-export.js';
import { buildPromptSummary } from '../src/prompt.js';
import { exampleState } from './helpers.js';

test('exports and imports valid json', () => {
  const json = exportStateJson(exampleState());
  const parsed = parseImportJson(json);
  assert.equal(parsed.matches.length, 1);
  assert.equal(buildImportSummary(parsed).matches, 1);
});

test('export drops operation history to keep json lightweight', () => {
  const state = exampleState();
  state.operationHistory.unshift({
    id: 'operation-export-test',
    type: 'update_player',
    entityType: 'player',
    entityId: 'player',
    before: { name: 'before' },
    after: { name: 'after' },
    createdAt: '1998-09-01T00:00:00.000Z',
    undoneAt: null,
  });
  const exported = JSON.parse(exportStateJson(state));
  assert.deepEqual(exported.operationHistory, []);
});

test('rejects invalid import json without producing state', () => {
  assert.throws(() => parseImportJson('{bad'), /JSON 解析失败/);

  const bad = exampleState();
  bad.matches[0].seasonId = 'missing';
  assert.throws(() => parseImportJson(JSON.stringify(bad)), /不存在的赛季/);
});

test('prompt summary respects max length', () => {
  const summary = buildPromptSummary(exampleState(), { maxChars: 80 });
  assert.ok(summary.length <= 80);
});

test('prompt summary is structured and includes closed season details', () => {
  const state = exampleState();
  state.seasons[0] = {
    ...state.seasons[0],
    status: 'completed',
    endedAt: '1999-06-30',
    closedSummary: {
      calculatedTotals: {
        appearances: 2,
        starts: 1,
        minutes: 120,
        goals: 1,
        assists: 2,
      },
      teamOutcome: '青年联赛亚军',
      finalStanding: '第二名',
      roleAtEnd: 'starter',
      narrativeSummary: '站稳青年队主力轮换',
      teamHonors: ['青年联赛亚军'],
      individualHonors: ['助攻王'],
      closedAt: '1999-06-30T00:00:00.000Z',
    },
  };
  const summary = buildPromptSummary(state, { preset: 'standard', maxChars: 2000 });
  assert.match(summary, /\[球员\]/);
  assert.match(summary, /\[最近结束赛季\]/);
  assert.match(summary, /\[历史赛季\]/);
  assert.match(summary, /\| 赛季 \| 球队 \| 出场 \| 首发 \| 进球 \| 助攻 \| 成绩 \| 荣誉 \|/);
  assert.match(summary, /\| 1998\/99 \|/);
  assert.match(summary, /青年联赛亚军/);
  assert.match(summary, /助攻王/);
  assert.match(summary, /\[能力\]/);
  assert.doesNotMatch(summary, /能力倾向/);
});
