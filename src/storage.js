import { EXTENSION_ID } from './constants.js';
import { createInitialState, migrateState, nowIso, touchState } from './schema.js';
import { validateState } from './validation.js';

function canUseChatState(context) {
  return typeof context?.getChatState === 'function';
}

function canUseChatMetadata(context) {
  return context?.chatMetadata && typeof context.saveMetadata === 'function';
}

export async function readLedgerState(context) {
  if (canUseChatState(context)) {
    const raw = await context.getChatState(EXTENSION_ID);
    return migrateState(raw);
  }

  if (canUseChatMetadata(context)) {
    return migrateState(context.chatMetadata[EXTENSION_ID]);
  }

  throw new Error('SillyTavern/Luker 聊天状态 API 不可用');
}

export async function writeLedgerState(context, reducer) {
  if (typeof context?.updateChatState === 'function') {
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
      const reason = target ? JSON.stringify(result) : '现在没有可写入的聊天，先打开一个角色聊天或群聊。';
      throw new Error(`Chat State 写入失败：${reason}`);
    }
    return result.state ? migrateState(result.state) : nextState;
  }

  if (canUseChatMetadata(context)) {
    const previous = migrateState(context.chatMetadata[EXTENSION_ID]);
    const reduced = reducer(previous);
    const nextState = touchState(reduced || previous);
    validateState(nextState);
    context.chatMetadata[EXTENSION_ID] = nextState;
    await context.saveMetadata();
    return nextState;
  }

  throw new Error('SillyTavern/Luker 聊天状态写入 API 不可用');
}

export async function replaceLedgerState(context, state) {
  validateState(state);
  return writeLedgerState(context, () => touchState(state));
}

export async function clearLedgerState(context) {
  const fresh = createInitialState(nowIso());
  // Overwrite with a fresh state first: this is the same write path normal saves
  // use, so it reliably resets every field — including the career_start marker in
  // miscellaneous and ability history — even where deleteChatState leaves data behind.
  let overwritten = false;
  if (typeof context?.updateChatState === 'function') {
    await writeLedgerState(context, () => fresh);
    overwritten = true;
  }
  // Best-effort removal of the stored blob; failure is non-fatal since we already
  // overwrote it with a fresh state above.
  if (typeof context?.deleteChatState === 'function') {
    try {
      const result = await context.deleteChatState(EXTENSION_ID);
      const ok = typeof result === 'boolean' ? result : Boolean(result?.ok);
      if (!ok && !overwritten) {
        throw new Error('Chat State 删除失败');
      }
    } catch (error) {
      if (!overwritten) throw error;
    }
  } else if (!overwritten && canUseChatMetadata(context)) {
    context.chatMetadata[EXTENSION_ID] = fresh;
    await context.saveMetadata();
  } else if (!overwritten) {
    throw new Error('SillyTavern/Luker 聊天状态删除 API 不可用');
  }
  return fresh;
}

export async function copyBranchState(context, payload) {
  if (!payload?.sourceTarget || !payload?.targetTarget) return false;
  if (!canUseChatState(context) || typeof context.updateChatState !== 'function') return false;
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
