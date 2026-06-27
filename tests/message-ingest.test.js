import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageIngestor, resolveMessageId, getMessageText, hasSuggestionBlock } from '../src/message-ingest.js';
import { confirmDraft } from '../src/ledger-actions.js';
import { createInitialState } from '../src/schema.js';

function suggestionBlock(type, payload) {
  return `<football_ledger_suggestion>${JSON.stringify({ type, payload })}</football_ledger_suggestion>`;
}

const MISC_PAYLOAD = { date: '1998-09-04', key: 'role', value: '替补', tags: ['队内角色'], notes: '' };
const MATCH_PAYLOAD = { seasonId: '1998-99', date: '1998-09-05', opponent: '对手' };
const CAREER_START_PAYLOAD = {
  date: '1998-07-01',
  openingText: '开场白正文……',
  player: {
    name: '张三',
    currentClub: '拜仁慕尼黑青年队',
    currentTeam: '拜仁慕尼黑青年队',
    primaryPosition: '中前卫',
    secondaryPositions: ['前腰'],
    careerStage: 'youth',
    squadRole: 'prospect',
    defaultCurrency: 'DEM',
  },
  season: { id: '1998-99', label: '1998/99', club: '拜仁慕尼黑青年队', startedAt: '1998-07-01', endedAt: null, status: 'active', notes: '开局赛季' },
  abilities: { pace: 68, shooting: 62, passing: 70, control: 70, defending: 58, physical: 66, awareness: 68 },
  notes: '开局建档',
};

function harness({ chat, enabled = true, chatId = 'chat-1' } = {}) {
  let state = createInitialState('1998-01-01T00:00:00.000Z');
  let onDraftsAddedCalls = 0;
  const ingestor = createMessageIngestor({
    getSettings: () => ({ enabled }),
    getChat: () => chat,
    getChatId: () => chatId,
    applyDrafts: (reducer) => { state = reducer(state); },
    onDraftsAdded: async () => { onDraftsAddedCalls += 1; },
  });
  return { ingestor, getState: () => state, getOnDraftsAddedCalls: () => onDraftsAddedCalls };
}

test('user message with suggestion block creates a pending draft', async () => {
  const chat = [{ is_user: true, mes: `开场白\n${suggestionBlock('miscellaneous', MISC_PAYLOAD)}` }];
  const { ingestor, getState, getOnDraftsAddedCalls } = harness({ chat });
  const added = await ingestor.processSuggestionMessage(0, 'sent');
  assert.equal(added, 1);
  const state = getState();
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].status, 'pending');
  assert.equal(state.drafts[0].type, 'miscellaneous');
  assert.equal(getOnDraftsAddedCalls(), 1);
});

test('system message with suggestion block is skipped', async () => {
  const chat = [{ is_system: true, mes: suggestionBlock('miscellaneous', MISC_PAYLOAD) }];
  const { ingestor, getState } = harness({ chat });
  const added = await ingestor.processSuggestionMessage(0, 'sent');
  assert.equal(added, 0);
  assert.equal(getState().drafts.length, 0);
});

test('the same message triggered twice does not duplicate drafts', async () => {
  const chat = [{ is_user: true, mes: suggestionBlock('miscellaneous', MISC_PAYLOAD) }];
  const { ingestor, getState } = harness({ chat });
  const first = await ingestor.processSuggestionMessage(0, 'sent');
  const second = await ingestor.processSuggestionMessage(0, 'received');
  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(getState().drafts.length, 1);
});

test('assistant message suggestion is still parsed (no regression)', async () => {
  const chat = [{ is_user: false, mes: suggestionBlock('match', MATCH_PAYLOAD) }];
  const { ingestor, getState } = harness({ chat });
  const added = await ingestor.processSuggestionMessage(0, 'received');
  assert.equal(added, 1);
  assert.equal(getState().drafts.length, 1);
  assert.equal(getState().drafts[0].type, 'match');
});

test('plain user message without a suggestion block creates nothing', async () => {
  const chat = [{ is_user: true, mes: '只是普通聊天，没有任何建议块。' }];
  const { ingestor, getState } = harness({ chat });
  const added = await ingestor.processSuggestionMessage(0, 'sent');
  assert.equal(added, 0);
  assert.equal(getState().drafts.length, 0);
});

test('opaque event payloads fall back to scanning recent messages', async () => {
  assert.equal(resolveMessageId({ foo: 'bar' }), null);
  assert.equal(resolveMessageId(undefined), null);
  assert.equal(resolveMessageId(null), null);
  assert.equal(resolveMessageId(0), 0);
  assert.equal(resolveMessageId('2'), '2');
  assert.equal(resolveMessageId({ messageId: 5 }), 5);

  const chat = [
    { is_user: true, mes: '普通消息' },
    { is_user: true, mes: suggestionBlock('miscellaneous', MISC_PAYLOAD) },
  ];
  const { ingestor, getState } = harness({ chat });
  const added = await ingestor.scanRecentMessagesForSuggestions(5, 'sent_scan');
  assert.equal(added, 1);
  assert.equal(getState().drafts.length, 1);
});

test('career_start user message becomes a pending draft without mutating formal state', async () => {
  const chat = [{ is_user: true, mes: suggestionBlock('career_start', CAREER_START_PAYLOAD) }];
  const { ingestor, getState } = harness({ chat });
  await ingestor.processSuggestionMessage(0, 'sent');
  const state = getState();
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].type, 'career_start');
  assert.equal(state.drafts[0].status, 'pending');

  // Formal account must remain untouched until the user confirms the draft.
  assert.equal(state.player.name, '');
  assert.equal(state.seasons.length, 0);
  assert.equal(state.abilities.history.length, 0);
  assert.equal(state.miscellaneous.length, 0);

  confirmDraft(state, state.drafts[0].id);
  assert.equal(state.drafts[0].status, 'confirmed');
  assert.equal(state.player.name, '张三');
  assert.ok(state.seasons.find((season) => season.id === '1998-99'));
  assert.equal(state.abilities.current.passing, 70);
});

test('disabled extension does not process suggestion messages', async () => {
  const chat = [{ is_user: true, mes: suggestionBlock('miscellaneous', MISC_PAYLOAD) }];
  const { ingestor, getState } = harness({ chat, enabled: false });
  const added = await ingestor.processSuggestionMessage(0, 'sent');
  assert.equal(added, 0);
  assert.equal(getState().drafts.length, 0);
});

test('text and detection helpers behave as expected', () => {
  assert.equal(getMessageText({ mes: 'a' }), 'a');
  assert.equal(getMessageText({ content: 'c' }), 'c');
  assert.equal(getMessageText({}), '');
  assert.ok(hasSuggestionBlock('x <football_ledger_suggestion> y'));
  assert.equal(hasSuggestionBlock('no tag here'), false);
});
