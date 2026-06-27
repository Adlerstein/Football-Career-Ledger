import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTENSION_ID } from '../src/constants.js';
import { createInitialState } from '../src/schema.js';
import { clearLedgerState, copyBranchState, readLedgerState, writeLedgerState } from '../src/storage.js';

function makeMetadataContext(initialState) {
  const saves = [];
  const context = {
    chatMetadata: initialState ? { [EXTENSION_ID]: structuredClone(initialState) } : {},
    saveMetadata: async () => {
      saves.push(structuredClone(context.chatMetadata));
    },
  };
  return { context, saves };
}

test('reads and writes ledger state through SillyTavern chat metadata when Chat State is unavailable', async () => {
  const initialState = createInitialState('1998-01-01T00:00:00.000Z');
  initialState.player.name = '张三';
  const { context, saves } = makeMetadataContext(initialState);

  const before = await readLedgerState(context);
  assert.equal(before.player.name, '张三');

  const after = await writeLedgerState(context, (state) => ({
    ...state,
    player: { ...state.player, name: '李四' },
  }));

  assert.equal(after.player.name, '李四');
  assert.equal(context.chatMetadata[EXTENSION_ID].player.name, '李四');
  assert.equal(saves.length, 1);
});

test('clears ledger state through SillyTavern chat metadata when deleteChatState is unavailable', async () => {
  const initialState = createInitialState('1998-01-01T00:00:00.000Z');
  initialState.player.name = '张三';
  const { context, saves } = makeMetadataContext(initialState);

  const fresh = await clearLedgerState(context);

  assert.equal(fresh.player.name, '');
  assert.equal(context.chatMetadata[EXTENSION_ID].player.name, '');
  assert.equal(saves.length, 1);
});

test('skips branch state copy when Chat State target APIs are unavailable', async () => {
  const copied = await copyBranchState({ chatMetadata: {}, saveMetadata: async () => {} }, {
    sourceTarget: { chatId: 'a' },
    targetTarget: { chatId: 'b' },
  });

  assert.equal(copied, false);
});
