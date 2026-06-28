import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTurnCapsule } from '../src/reference/capsule.js';
import { createReferenceIndex, validateReferenceDataset } from '../src/reference/dataset.js';
import { ORCHESTRATOR_TOOL_NAME } from '../src/reference/constants.js';
import { registerOrchestratorTools } from '../src/reference/orchestrator-tools.js';
import { createPublicApi } from '../src/reference/public-api.js';
import { resolveTurnContext } from '../src/reference/turn-context.js';
import { createDatasetStore } from '../src/reference/storage.js';
import { createInjectionController } from '../src/reference/injection.js';
import { deriveSeasonIdFromIso, resolveMvuTime } from '../src/reference/mvu-time.js';

const sampleDataset = {
  schemaVersion: 1,
  meta: {
    datasetId: 'sample-epl-2024',
    title: 'Sample Premier League 2024-25',
    defaultSeasonId: '2024-25',
  },
  seasons: [
    { id: '2024-25', label: '2024-25' },
  ],
  competitions: [
    { id: 'premier-league', seasonId: '2024-25', name: 'Premier League' },
  ],
  teams: [
    { id: 'arsenal', name: 'Arsenal', aliases: ['Gunners'] },
    { id: 'chelsea', name: 'Chelsea', aliases: ['Blues'] },
    { id: 'liverpool', name: 'Liverpool', aliases: [] },
    { id: 'brentford', name: 'Brentford', aliases: [] },
  ],
  matches: [
    {
      id: 'pl-2024-r2-che-ars',
      seasonId: '2024-25',
      competitionId: 'premier-league',
      round: 'Round 2',
      date: '2024-08-13',
      homeTeamId: 'chelsea',
      awayTeamId: 'arsenal',
      score: { home: 1, away: 2 },
      sourceIds: ['fixture-feed'],
    },
    {
      id: 'pl-2024-r2-liv-bre',
      seasonId: '2024-25',
      competitionId: 'premier-league',
      round: 'Round 2',
      date: '2024-08-13',
      homeTeamId: 'liverpool',
      awayTeamId: 'brentford',
      score: { home: 3, away: 0 },
      sourceIds: ['fixture-feed'],
    },
  ],
  events: [
    {
      matchId: 'pl-2024-r2-che-ars',
      minute: 27,
      type: 'goal',
      teamId: 'arsenal',
      player: 'Kai Havertz',
      assist: 'Martin Odegaard',
    },
    {
      matchId: 'pl-2024-r2-che-ars',
      minute: 71,
      type: 'substitution',
      teamId: 'arsenal',
      playerOut: 'Gabriel Martinelli',
      playerIn: 'Leandro Trossard',
    },
  ],
  lineups: [
    {
      matchId: 'pl-2024-r2-che-ars',
      teamId: 'arsenal',
      starters: [{ player: 'Kai Havertz', position: 'ST' }],
      substitutes: [{ player: 'Leandro Trossard' }],
    },
  ],
  sources: [
    {
      id: 'fixture-feed',
      label: 'sample fixture feed',
      url: 'https://example.test/epl-2024',
      confidence: 'sample',
    },
  ],
};

const ledgerSnapshot = {
  player: {
    currentClub: 'Arsenal',
    currentSeasonId: '2024-25',
  },
};

test('validates and indexes a reference dataset for structured match queries', () => {
  const validation = validateReferenceDataset(sampleDataset);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.errors, []);

  const index = createReferenceIndex(sampleDataset);
  const rows = index.queryMatches({
    seasonId: '2024-25',
    team: 'Gunners',
    dateRange: ['2024-08-13', '2024-08-13'],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].matchId, 'pl-2024-r2-che-ars');
  assert.equal(rows[0].homeTeam, 'Chelsea');
  assert.equal(rows[0].awayTeam, 'Arsenal');
});

test('returns detailed events and lineups without exposing the full dataset', () => {
  const index = createReferenceIndex(sampleDataset);
  const detail = index.getMatchDetail({ matchId: 'pl-2024-r2-che-ars' });

  assert.equal(detail.match.matchId, 'pl-2024-r2-che-ars');
  assert.equal(detail.events.length, 2);
  assert.equal(detail.lineups.length, 1);
  assert.equal(detail.sources[0].id, 'fixture-feed');
  assert.equal(Object.hasOwn(detail, 'allMatches'), false);
});

test('resolves turn query time from current user intent instead of blindly using MVU state time', () => {
  const context = resolveTurnContext({
    userMessage: '三天后我们客场踢切尔西。',
    stateTime: '2024-08-10 上午',
    ledgerSnapshot,
  });

  assert.equal(context.state_time, '2024-08-10 上午');
  assert.equal(context.query_time, '2024-08-13');
  assert.equal(context.confidence, 'medium');
  assert.equal(context.team, 'Arsenal');
  assert.match(context.reason, /relative/i);
});

test('explicit dates override the previously committed MVU time', () => {
  const context = resolveTurnContext({
    userMessage: '直接跳到2024-08-13，准备踢切尔西。',
    stateTime: '2024-08-10 上午',
    ledgerSnapshot,
  });

  assert.equal(context.query_time, '2024-08-13');
  assert.equal(context.confidence, 'high');
  assert.match(context.reason, /explicit/i);
});

test('ambiguous next-round requests stay low confidence instead of inventing an exact date', () => {
  const context = resolveTurnContext({
    userMessage: '下一轮之前看看同时期发生了什么。',
    stateTime: '2024-08-10 上午',
    ledgerSnapshot,
  });

  assert.equal(context.query_time, null);
  assert.equal(context.confidence, 'low');
  assert.equal(context.round, 'next');
});

test('public API builds a compact turn capsule for orchestration', async () => {
  const api = createPublicApi({ loadDataset: async () => sampleDataset });
  const capsule = await api.buildTurnCapsule({
    userMessage: '三天后我们客场踢切尔西。',
    stateTime: '2024-08-10 上午',
    ledgerSnapshot,
  });

  assert.equal(capsule.readonly, true);
  assert.equal(capsule.state_time, '2024-08-10 上午');
  assert.equal(capsule.query_time, '2024-08-13');
  assert.equal(capsule.matches[0].matchId, 'pl-2024-r2-che-ars');
  assert.ok(capsule.nearby_matches.some((match) => match.matchId === 'pl-2024-r2-liv-bre'));
  assert.ok(JSON.stringify(capsule).length < 3000);
});

test('public API reports loaded dataset status without exposing raw data', async () => {
  const api = createPublicApi({ loadDataset: async () => sampleDataset });
  const status = await api.getReferenceStatus();
  const datasets = await api.listDatasets();

  assert.equal(status.ok, true);
  assert.equal(status.datasetId, 'sample-epl-2024');
  assert.equal(status.matchCount, 2);
  assert.equal(Object.hasOwn(status, 'matches'), false);
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0].datasetId, 'sample-epl-2024');
});

test('standalone capsule builder returns warnings when no match is found', () => {
  const index = createReferenceIndex(sampleDataset);
  const turnContext = resolveTurnContext({
    userMessage: '2024-08-14 看看有没有我们的比赛。',
    stateTime: '2024-08-10 上午',
    ledgerSnapshot,
  });

  const capsule = buildTurnCapsule({ index, turnContext });

  assert.deepEqual(capsule.matches, []);
  assert.ok(capsule.warnings.some((warning) => warning.includes('No reference match')));
});

test('query and capsule limits are capped even when callers request large payloads', () => {
  const manyMatches = Array.from({ length: 50 }, (_, index) => ({
    id: `bulk-${index}`,
    seasonId: '2024-25',
    competitionId: 'premier-league',
    round: 'Round 9',
    date: '2024-09-01',
    homeTeamId: index % 2 === 0 ? 'arsenal' : 'chelsea',
    awayTeamId: index % 2 === 0 ? 'chelsea' : 'arsenal',
    score: { home: 0, away: 0 },
    sourceIds: ['fixture-feed'],
  }));
  const index = createReferenceIndex({ ...sampleDataset, matches: [...sampleDataset.matches, ...manyMatches] });

  const queried = index.queryMatches({ seasonId: '2024-25', limit: 999 });
  const capsule = buildTurnCapsule({
    index,
    turnContext: {
      state_time: '2024-09-01 上午',
      query_time: '2024-09-01',
      dateRange: ['2024-09-01', '2024-09-01'],
      seasonId: '2024-25',
      confidence: 'medium',
    },
    options: { limit: 999, nearbyLimit: 999 },
  });

  assert.equal(queried.length, 10);
  assert.ok(capsule.matches.length <= 10);
  assert.ok(capsule.nearby_matches.length <= 10);
});

test('orchestrator tool registration retries on APP_READY when orchestrator arrives late', async () => {
  let handler = null;
  let orchestrator = null;
  let registeredSpec = null;
  const context = {
    eventTypes: { APP_READY: 'APP_READY' },
    eventSource: {
      on(eventName, callback) {
        if (eventName === 'APP_READY') handler = callback;
      },
    },
    getExtensionApi(name) {
      if (name === 'orchestrator') return orchestrator;
      return undefined;
    },
  };
  const api = { buildTurnCapsule: async () => ({ readonly: true }) };

  assert.equal(registerOrchestratorTools(context, api), false);
  orchestrator = {
    registerOrchestrationTool(spec) {
      registeredSpec = spec;
    },
  };
  assert.equal(typeof handler, 'function');
  await handler();

  assert.equal(registeredSpec.name, ORCHESTRATOR_TOOL_NAME);
  assert.equal(registeredSpec.mode, 'read');
});

test('dataset store imports, lists, exports, and deletes readable json without IndexedDB', async () => {
  const store = createDatasetStore({ indexedDBFactory: null });

  const status = await store.importDatasetFromJson(sampleDataset);
  assert.equal(status.datasetId, 'sample-epl-2024');
  assert.equal(status.matchCount, 2);

  const datasets = await store.listDatasets();
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0].datasetId, 'sample-epl-2024');

  const exported = await store.exportDataset('sample-epl-2024');
  assert.deepEqual(exported.meta, sampleDataset.meta);

  assert.equal(await store.deleteDataset('sample-epl-2024'), true);
  assert.equal((await store.listDatasets()).length, 0);
});

test('public API can use an imported active dataset and panel profile', async () => {
  const store = createDatasetStore({ indexedDBFactory: null });
  const settings = {
    activeDatasetId: '',
    currentSeasonId: '2024-25',
    currentTeam: 'Arsenal',
    currentDate: '2024-08-10',
  };
  const api = createPublicApi({
    loadDataset: async () => sampleDataset,
    datasetStore: store,
    getSettings: () => settings,
    saveSettings: (next) => Object.assign(settings, next),
  });

  await api.importDatasetFromJson(sampleDataset);
  assert.equal(settings.activeDatasetId, 'sample-epl-2024');

  const capsule = await api.previewNextCapsule({
    userMessage: '三天后看看比赛参考',
    options: { nearbyDays: 0 },
  });

  assert.equal(capsule.query_time, '2024-08-13');
  assert.equal(capsule.matches[0].matchId, 'pl-2024-r2-che-ars');
});

test('one-shot injection arms, injects once, and clears prompt on generation lifecycle', async () => {
  const events = new Map();
  const prompts = [];
  const settings = {
    enabled: true,
    nextInjectionArmed: false,
    currentSeasonId: '2024-25',
    currentTeam: 'Arsenal',
    currentDate: '2024-08-10',
    promptMaxChars: 2000,
    nearbyDays: 0,
  };
  const context = {
    constants: {
      promptTypes: { NONE: 0, IN_CHAT: 1 },
      promptRoles: { SYSTEM: 0 },
    },
    eventTypes: {
      GENERATION_CONTEXT_READY: 'context_ready',
      GENERATION_ENDED: 'ended',
      GENERATION_STOPPED: 'stopped',
      CHAT_CHANGED: 'chat_changed',
    },
    eventSource: {
      on(name, handler) {
        events.set(name, handler);
      },
    },
    setExtensionPrompt(key, value, position, depth, scan, role) {
      prompts.push({ key, value, position, depth, scan, role });
    },
  };
  const controller = createInjectionController({
    context,
    settings,
    saveSettings: () => {},
    buildCapsule: async () => ({ readonly: true, matches: [{ matchId: 'm1' }] }),
    getUserMessage: () => 'next match',
  });

  controller.registerEvents();
  const preview = await controller.armNextInjection();
  assert.equal(preview.readonly, true);
  assert.equal(settings.nextInjectionArmed, true);

  await events.get('context_ready')();
  assert.equal(settings.nextInjectionArmed, false);
  assert.ok(prompts.at(-1).value.includes('m1'));

  await events.get('context_ready')();
  assert.equal(prompts.filter((prompt) => prompt.value.includes('m1')).length, 1);

  events.get('ended')();
  assert.equal(prompts.at(-1).value, '');
});

test('derives the football season from an ISO date (Jul–Jun split)', () => {
  assert.equal(deriveSeasonIdFromIso('2005-02-17'), '2004-05');
  assert.equal(deriveSeasonIdFromIso('2005-08-10'), '2005-06');
  assert.equal(deriveSeasonIdFromIso('not-a-date'), '');
});

test('resolves MVU world time, rejecting vague or out-of-range hallucinations', () => {
  const ctx = (value) => ({ chatMetadata: { variables: { 世界: { 当前时间: value } } } });

  const ok = resolveMvuTime(ctx('2005-02-17 早晨'));
  assert.equal(ok.ok, true);
  assert.equal(ok.iso, '2005-02-17');
  assert.equal(ok.seasonId, '2004-05');

  assert.equal(resolveMvuTime(ctx('赛季中期')).reason, 'unparsed');
  assert.equal(resolveMvuTime(ctx('1850-01-01')).reason, 'out-of-range');
  assert.equal(resolveMvuTime(ctx('')).reason, 'none');
  assert.equal(resolveMvuTime({}).reason, 'none');
});
