import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmDraft, createDraft, hasConfirmedCareerStart, undoLastOperation } from '../src/ledger-actions.js';
import { getSuggestionSchema, parseSuggestionBlocks } from '../src/suggestions.js';
import { createInitialState } from '../src/schema.js';
import { createPublicApi } from '../src/public-api.js';
import { validateState } from '../src/validation.js';
import { exampleState } from './helpers.js';

const CAREER_START_PAYLOAD = {
  date: '1998-07-01',
  openingText: '开场白正文……',
  player: {
    name: '张三',
    currentClub: '拜仁慕尼黑青年队',
    currentTeam: '拜仁慕尼黑青年队',
    primaryPosition: '中前卫／全能中场',
    secondaryPositions: ['前腰'],
    careerStage: 'youth',
    squadRole: 'prospect',
    defaultCurrency: 'DEM',
  },
  season: {
    id: '1998-99',
    label: '1998/99',
    club: '拜仁慕尼黑青年队',
    startedAt: '1998-07-01',
    endedAt: null,
    status: 'active',
    notes: '开局赛季',
  },
  abilities: {
    pace: 68,
    shooting: 62,
    passing: 70,
    control: 70,
    defending: 58,
    physical: 66,
    awareness: 68,
  },
  notes: '开局建档',
};

function freshState() {
  return createInitialState('1998-01-01T00:00:00.000Z');
}

function addCareerStartDraft(state, payload = CAREER_START_PAYLOAD, contentHash = 'cs') {
  createDraft(state, {
    type: 'career_start',
    status: 'pending',
    payload,
    source: { messageId: 'm', swipeId: 0, suggestionIndex: 0, contentHash },
  });
  return state.drafts.find((draft) => draft.type === 'career_start').id;
}

test('parseSuggestionBlocks parses career_start as a pending draft', () => {
  const text = `开局叙事。\n<football_ledger_suggestion>${JSON.stringify({ type: 'career_start', payload: CAREER_START_PAYLOAD })}</football_ledger_suggestion>`;
  const blocks = parseSuggestionBlocks(text, { chatId: 'chat', messageId: 'm1', swipeId: 0 });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'career_start');
  assert.equal(blocks[0].status, 'pending');
  assert.deepEqual(blocks[0].validationErrors, []);
});

test('getSuggestionSchema returns a valid career_start schema', () => {
  const schema = getSuggestionSchema('career_start');
  assert.equal(schema.type, 'career_start');
  assert.ok(schema.payload.player);
  assert.ok(schema.payload.season);
  assert.equal(Object.keys(schema.payload.abilities).length, 7);
});

test('confirm career_start writes player, season, abilities and opening text', () => {
  const state = freshState();
  const draftId = addCareerStartDraft(state, CAREER_START_PAYLOAD, 'cs-ok');
  confirmDraft(state, draftId);

  assert.equal(state.drafts.find((draft) => draft.id === draftId).status, 'confirmed');

  assert.equal(state.player.name, '张三');
  assert.equal(state.player.currentClub, '拜仁慕尼黑青年队');
  assert.equal(state.player.currentTeam, '拜仁慕尼黑青年队');
  assert.equal(state.player.primaryPosition, '中前卫／全能中场');
  assert.deepEqual(state.player.secondaryPositions, ['前腰']);

  const season = state.seasons.find((item) => item.id === '1998-99');
  assert.ok(season);
  assert.equal(season.status, 'active');
  assert.equal(state.player.currentSeasonId, '1998-99');

  assert.equal(state.abilities.current.passing, 70);
  assert.equal(state.abilities.current.awareness, 68);
  assert.equal(state.abilities.history.length, 0);

  const opening = state.miscellaneous.find((item) => item.key === 'career_opening');
  assert.ok(opening);
  assert.equal(opening.value, '开场白正文……');

  const marker = state.miscellaneous.find((item) => item.key === 'career_start');
  assert.ok(marker);
  assert.equal(marker.value, '1998-07-01');
  assert.ok(hasConfirmedCareerStart(state));

  assert.doesNotThrow(() => validateState(state));
});

test('career_start derives season id and clamps abilities when season missing', () => {
  const state = freshState();
  const payload = {
    date: '1998-08-15',
    player: { name: '李四', currentClub: '科隆青年队', primaryPosition: '前锋' },
    abilities: { pace: 120, shooting: -5, passing: 60.7, control: 60, defending: 60, physical: 60, awareness: 60 },
    notes: '开局建档',
  };
  const draftId = addCareerStartDraft(state, payload, 'cs-derive');
  confirmDraft(state, draftId);
  assert.equal(state.drafts.find((draft) => draft.id === draftId).status, 'confirmed');
  assert.ok(state.seasons.find((item) => item.id === '1998-99'));
  assert.equal(state.player.currentTeam, '科隆青年队');
  assert.equal(state.abilities.current.pace, 99);
  assert.equal(state.abilities.current.shooting, 0);
  assert.equal(state.abilities.current.passing, 60);
});

test('confirm career_start fails and stays invalid when ability history exists', () => {
  const state = exampleState();
  const beforeName = state.player.name;
  const beforePassing = state.abilities.current.passing;
  const beforeSeasons = JSON.stringify(state.seasons);
  const draftId = addCareerStartDraft(state, CAREER_START_PAYLOAD, 'cs-existing');
  confirmDraft(state, draftId);

  const draft = state.drafts.find((item) => item.id === draftId);
  assert.equal(draft.status, 'invalid');
  assert.ok(draft.validationErrors.length > 0);
  assert.equal(state.player.name, beforeName);
  assert.equal(state.abilities.current.passing, beforePassing);
  assert.equal(JSON.stringify(state.seasons), beforeSeasons);
});

test('undo career_start confirmation restores player, seasons, abilities and miscellaneous', () => {
  const state = freshState();
  const beforePlayer = JSON.stringify(state.player);
  const beforeSeasons = JSON.stringify(state.seasons);
  const beforeAbilities = JSON.stringify(state.abilities);
  const beforeMisc = JSON.stringify(state.miscellaneous);
  const draftId = addCareerStartDraft(state, CAREER_START_PAYLOAD, 'cs-undo');
  confirmDraft(state, draftId);
  undoLastOperation(state);

  assert.equal(JSON.stringify(state.player), beforePlayer);
  assert.equal(JSON.stringify(state.seasons), beforeSeasons);
  assert.equal(JSON.stringify(state.abilities), beforeAbilities);
  assert.equal(JSON.stringify(state.miscellaneous), beforeMisc);
  assert.equal(state.drafts.find((item) => item.id === draftId).status, 'pending');
});

test('public API stays read-only and exposes no write functions', () => {
  const state = freshState();
  const api = createPublicApi(async () => state);
  assert.ok(Object.isFrozen(api));
  assert.equal(typeof api.applyCareerStart, 'undefined');
  assert.equal(typeof api.confirmDraft, 'undefined');
  assert.equal(typeof api.setInitialAbilities, 'undefined');
  assert.equal(typeof api.updatePlayerStatus, 'undefined');
  assert.equal(typeof api.addSeason, 'undefined');
  assert.equal(typeof api.getSnapshot, 'function');
  assert.equal(typeof api.getPlayer, 'function');
  assert.equal(typeof api.hasConfirmedCareerStart, 'undefined');
});

test('second career_start confirmation fails and does not mutate the ledger', () => {
  const state = freshState();
  const firstId = addCareerStartDraft(state, CAREER_START_PAYLOAD, 'cs-first');
  confirmDraft(state, firstId);
  assert.ok(hasConfirmedCareerStart(state));

  const secondPayload = {
    ...CAREER_START_PAYLOAD,
    player: { ...CAREER_START_PAYLOAD.player, name: '王五' },
    abilities: { pace: 10, shooting: 10, passing: 10, control: 10, defending: 10, physical: 10, awareness: 10 },
  };
  createDraft(state, {
    type: 'career_start',
    status: 'pending',
    payload: secondPayload,
    source: { messageId: 'm2', swipeId: 0, suggestionIndex: 1, contentHash: 'cs-second' },
  });
  const secondId = state.drafts.find((draft) => draft.source.contentHash === 'cs-second').id;

  const playerBefore = JSON.stringify(state.player);
  const seasonsBefore = JSON.stringify(state.seasons);
  const abilitiesBefore = JSON.stringify(state.abilities);
  const miscBefore = JSON.stringify(state.miscellaneous);

  confirmDraft(state, secondId);

  const secondDraft = state.drafts.find((draft) => draft.id === secondId);
  assert.equal(secondDraft.status, 'invalid');
  assert.ok(secondDraft.validationErrors.some((message) => message.includes('已完成开局建档')));

  // 第二次确认必须完全无副作用。
  assert.equal(JSON.stringify(state.player), playerBefore);
  assert.equal(JSON.stringify(state.seasons), seasonsBefore);
  assert.equal(JSON.stringify(state.abilities), abilitiesBefore);
  assert.equal(JSON.stringify(state.miscellaneous), miscBefore);
  assert.equal(state.player.name, '张三');
  assert.equal(state.abilities.current.passing, 70);
});

test('undoing the first career_start removes the marker and allows reconfirmation', () => {
  const state = freshState();
  const firstId = addCareerStartDraft(state, CAREER_START_PAYLOAD, 'cs-undo-marker');
  confirmDraft(state, firstId);
  assert.ok(hasConfirmedCareerStart(state));

  undoLastOperation(state);
  assert.equal(hasConfirmedCareerStart(state), false);
  assert.equal(state.drafts.find((draft) => draft.id === firstId).status, 'pending');

  // 撤销后允许重新确认同一开局建档。
  confirmDraft(state, firstId);
  assert.equal(state.drafts.find((draft) => draft.id === firstId).status, 'confirmed');
  assert.ok(hasConfirmedCareerStart(state));
  assert.equal(state.player.name, '张三');
});

test('career_start marker is written even when openingText is empty', () => {
  const state = freshState();
  const payload = {
    ...CAREER_START_PAYLOAD,
    openingText: '',
    notes: '',
  };
  const draftId = addCareerStartDraft(state, payload, 'cs-no-opening');
  confirmDraft(state, draftId);

  assert.equal(state.miscellaneous.find((item) => item.key === 'career_opening'), undefined);
  const marker = state.miscellaneous.find((item) => item.key === 'career_start');
  assert.ok(marker);
  assert.equal(marker.notes, '开局建档已确认');
  assert.ok(hasConfirmedCareerStart(state));
});

