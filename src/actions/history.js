// Operation-history undo. restoreCollectionByEntity reverses one recorded
// operation by entity type; undoLastOperation applies it to the newest
// not-yet-undone entry. Reverse mutations only — no domain action is re-run.

import { cloneJson, nowIso } from '../schema.js';
import { upsertById } from '../utils.js';
import { validateAndReturn } from './core.js';

function restoreCollectionByEntity(state, operation) {
  const { entityType, entityId, before, after } = operation;
  if (operation.type === 'confirm_draft' && before) {
    state.drafts = upsertById(state.drafts.filter((item) => item.id !== entityId), before.draft);
    if (before.player) state.player = before.player;
    if (before.seasons) state.seasons = before.seasons;
    state.matches = before.matches;
    state.contracts = before.contracts;
    state.finance = before.finance;
    state.abilities = before.abilities;
    state.miscellaneous = before.miscellaneous;
  } else if (entityType === 'match') {
    state.matches = before ? upsertById(state.matches.filter((item) => item.id !== entityId), before) : state.matches.filter((item) => item.id !== entityId);
  } else if (entityType === 'transaction') {
    state.finance.transactions = before ? upsertById(state.finance.transactions.filter((item) => item.id !== entityId), before) : state.finance.transactions.filter((item) => item.id !== entityId);
  } else if (entityType === 'miscellaneous') {
    state.miscellaneous = before ? upsertById(state.miscellaneous.filter((item) => item.id !== entityId), before) : state.miscellaneous.filter((item) => item.id !== entityId);
  } else if (entityType === 'opening_balance') {
    state.finance.openingBalances = before
      ? [...state.finance.openingBalances.filter((item) => item.currency !== entityId), before]
      : state.finance.openingBalances.filter((item) => item.currency !== entityId);
  } else if (entityType === 'draft') {
    state.drafts = before ? upsertById(state.drafts.filter((item) => item.id !== entityId), before) : state.drafts.filter((item) => item.id !== entityId);
  } else if (entityType === 'season') {
    if (before?.seasons) {
      state.seasons = before.seasons;
      if (before.player) state.player = before.player;
    } else if (before) {
      state.seasons = upsertById(state.seasons.filter((item) => item.id !== entityId), before);
    } else {
      state.seasons = state.seasons.filter((item) => item.id !== entityId);
    }
  } else if (entityType === 'contract') {
    state.contracts = Array.isArray(before) ? before : before ? upsertById(state.contracts.filter((item) => item.id !== entityId), before) : state.contracts.filter((item) => item.id !== entityId);
  } else if (entityType === 'ability') {
    if (before?.current && before?.history) {
      state.abilities = cloneJson(before);
    }
  } else if (entityType === 'ability_history') {
    if (before?.current && before?.history) {
      state.abilities = cloneJson(before);
    }
  } else if (entityType === 'player') {
    state.player = cloneJson(before);
  } else {
    throw new Error(`暂不支持撤销操作类型：${operation.type}`);
  }
  void after;
}

export function undoLastOperation(state, options = {}) {
  const operation = state.operationHistory.find((item) => !item.undoneAt);
  if (!operation) throw new Error('没有可撤销的操作');
  restoreCollectionByEntity(state, operation);
  const undoneAt = options.timestamp || nowIso();
  state.operationHistory = state.operationHistory.map((item) => item.id === operation.id ? { ...item, undoneAt } : item);
  return validateAndReturn(state);
}
