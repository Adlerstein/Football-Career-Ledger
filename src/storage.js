import { EXTENSION_ID } from './constants.js';
import { createInitialState, migrateState, nowIso, touchState } from './schema.js';
import { validateState } from './validation.js';

export function hasActiveChat(context) {
  return Boolean(context?.getCurrentChatId?.() || context?.characterId !== undefined || context?.groupId);
}

export async function readLedgerState(context) {
  if (!context?.getChatState) {
    throw new Error('Luker Chat State API 不可用');
  }
  const raw = await context.getChatState(EXTENSION_ID);
  return migrateState(raw);
}

export async function writeLedgerState(context, reducer) {
  if (!context?.updateChatState) {
    throw new Error('Luker updateChatState API 不可用');
  }

  let nextState = null;
  const target = typeof context.resolveChatStateTarget === 'function'
    ? context.resolveChatStateTarget(null)
    : null;
  const result = await context.updateChatState(EXTENSION_ID, (current) => {
    const previous = migrateState(current);
    const reduced = reducer(previous);
    nextState = touchState(reduced || previous);
    validateState(nextState);
    return nextState;
  });

  if (!result || result.ok === false) {
    const reason = target ? JSON.stringify(result) : '当前没有可写入的活动聊天。请先打开一个角色聊天或群聊。';
    throw new Error(`Chat State 写入失败：${reason}`);
  }
  return result.state ? migrateState(result.state) : nextState;
}

export async function replaceLedgerState(context, state) {
  validateState(state);
  return writeLedgerState(context, () => touchState(state));
}

export async function clearLedgerState(context) {
  if (!context?.deleteChatState) {
    throw new Error('Luker deleteChatState API 不可用');
  }
  const result = await context.deleteChatState(EXTENSION_ID);
  const ok = typeof result === 'boolean' ? result : Boolean(result?.ok);
  if (!ok) {
    throw new Error('Chat State 删除失败');
  }
  return createInitialState(nowIso());
}

export function createId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function copyBranchState(context, payload) {
  if (!payload?.sourceTarget || !payload?.targetTarget) return false;
  const sourceState = await context.getChatState(EXTENSION_ID, { target: payload.sourceTarget });
  if (!sourceState) return false;
  const migrated = migrateState(sourceState);
  const result = await context.updateChatState(EXTENSION_ID, () => ({
    ...migrated,
    meta: {
      ...migrated.meta,
      updatedAt: nowIso(),
      branchSourceMesId: payload.mesId,
      branchName: payload.branchName,
    },
  }), { target: payload.targetTarget });
  return Boolean(result && result.ok !== false);
}

export function upsertById(items, item) {
  const index = items.findIndex((row) => row.id === item.id);
  if (index >= 0) {
    return items.map((row, rowIndex) => rowIndex === index ? item : row);
  }
  return [item, ...items];
}
