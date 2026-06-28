// Draft lifecycle actions. confirmDraft dispatches a pending draft to the
// matching domain action; on any failure it rolls every touched collection back
// and marks the draft invalid instead of partially applying it.

import { DRAFT_STATUS_VALUES, DRAFT_TYPES } from '../constants.js';
import { cloneJson, createSource, nowIso } from '../schema.js';
import { validateState } from '../validation.js';
import { createLedgerId, upsertById } from '../utils.js';
import { asArray, asObject, asString, pushOperation, validateAndReturn } from './core.js';
import { addMatch } from './matches.js';
import { addContract } from './contracts.js';
import { addTransaction } from './finance.js';
import { applyAbilityChange } from './abilities.js';
import { addMiscellaneous } from './miscellaneous.js';
import { applyCareerStart } from './career-start.js';

export function createDraft(state, draft, options = {}) {
  const data = asObject(draft);
  const type = DRAFT_TYPES.includes(data.type) ? data.type : 'miscellaneous';
  const status = DRAFT_STATUS_VALUES.includes(data.status) ? data.status : 'pending';
  const timestamp = options.timestamp || nowIso();
  const item = {
    id: asString(data.id || createLedgerId('draft')),
    type,
    status,
    payload: cloneJson(asObject(data.payload)),
    source: {
      messageId: data.source?.messageId ?? '',
      swipeId: Number.isInteger(data.source?.swipeId) ? data.source.swipeId : 0,
      suggestionIndex: Number.isInteger(data.source?.suggestionIndex) ? data.source.suggestionIndex : 0,
      contentHash: asString(data.source?.contentHash),
      chatId: data.source?.chatId ?? null,
    },
    validationErrors: asArray(data.validationErrors).map((error) => asString(error)),
    createdAt: asString(data.createdAt || timestamp),
    updatedAt: asString(data.updatedAt || timestamp),
    resolvedAt: data.resolvedAt ?? null,
    rawText: asString(data.rawText),
  };
  state.drafts = upsertById(state.drafts, item);
  return validateAndReturn(state);
}

export function updateDraftPayload(state, draftId, payload, options = {}) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  const after = {
    ...draft,
    payload: cloneJson(asObject(payload)),
    updatedAt: options.timestamp || nowIso(),
    status: draft.status === 'invalid' ? 'pending' : draft.status,
    validationErrors: [],
  };
  state.drafts = state.drafts.map((item) => item.id === draftId ? after : item);
  return validateAndReturn(state);
}

export function updateDraft(state, draftId, patch, options = {}) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  const data = asObject(patch);
  const after = {
    ...draft,
    type: DRAFT_TYPES.includes(data.type) ? data.type : draft.type,
    status: DRAFT_STATUS_VALUES.includes(data.status) ? data.status : draft.status,
    payload: data.payload ? cloneJson(asObject(data.payload)) : cloneJson(draft.payload),
    validationErrors: asArray(data.validationErrors ?? draft.validationErrors).map((error) => asString(error)),
    updatedAt: options.timestamp || nowIso(),
  };
  state.drafts = state.drafts.map((item) => item.id === draftId ? after : item);
  return validateAndReturn(state);
}

export function rejectDraft(state, draftId, options = {}) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  const after = {
    ...draft,
    status: 'rejected',
    updatedAt: options.timestamp || nowIso(),
    resolvedAt: options.timestamp || nowIso(),
  };
  state.drafts = state.drafts.map((item) => item.id === draftId ? after : item);
  pushOperation(state, {
    type: 'reject_draft',
    entityType: 'draft',
    entityId: draftId,
    before: draft,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteDraft(state, draftId, options = {}) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  state.drafts = state.drafts.filter((item) => item.id !== draftId);
  pushOperation(state, {
    type: 'delete_draft',
    entityType: 'draft',
    entityId: draftId,
    before: draft,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function confirmDraft(state, draftId, options = {}) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  if (draft.status !== 'pending') throw new Error('只能确认待处理的草稿');
  const source = createSource('assistant_suggestion', {
    messageId: draft.source.messageId || null,
    swipeId: draft.source.swipeId ?? null,
    draftId,
  });
  const actionOptions = {
    ...options,
    sourceType: 'assistant_suggestion',
    source,
  };
  const before = {
    draft: cloneJson(draft),
    player: cloneJson(state.player),
    seasons: cloneJson(state.seasons),
    matches: cloneJson(state.matches),
    contracts: cloneJson(state.contracts),
    finance: cloneJson(state.finance),
    abilities: cloneJson(state.abilities),
    miscellaneous: cloneJson(state.miscellaneous),
  };
  const operationHistoryBefore = cloneJson(state.operationHistory);

  try {
    if (draft.type === 'match') addMatch(state, draft.payload, actionOptions);
    else if (draft.type === 'contract') addContract(state, draft.payload, actionOptions);
    else if (draft.type === 'transaction') addTransaction(state, draft.payload, actionOptions);
    else if (draft.type === 'ability_change') applyAbilityChange(state, draft.payload, actionOptions);
    else if (draft.type === 'miscellaneous') addMiscellaneous(state, draft.payload, actionOptions);
    else if (draft.type === 'career_start') applyCareerStart(state, draft.payload, actionOptions);
    else throw new Error(`未知草稿类型：${draft.type}`);
  } catch (error) {
    state.player = before.player;
    state.seasons = before.seasons;
    state.matches = before.matches;
    state.contracts = before.contracts;
    state.finance = before.finance;
    state.abilities = before.abilities;
    state.miscellaneous = before.miscellaneous;
    state.operationHistory = operationHistoryBefore;
    const invalid = {
      ...draft,
      status: 'invalid',
      validationErrors: [error.message || String(error)],
      updatedAt: options.timestamp || nowIso(),
    };
    state.drafts = state.drafts.map((item) => item.id === draftId ? invalid : item);
    validateState(state);
    return state;
  }

  state.operationHistory = operationHistoryBefore;
  const confirmed = {
    ...draft,
    status: 'confirmed',
    updatedAt: options.timestamp || nowIso(),
    resolvedAt: options.timestamp || nowIso(),
  };
  state.drafts = state.drafts.map((item) => item.id === draftId ? confirmed : item);
  pushOperation(state, {
    type: 'confirm_draft',
    entityType: 'draft',
    entityId: draftId,
    before,
    after: {
      draft: confirmed,
      player: cloneJson(state.player),
      seasons: cloneJson(state.seasons),
      matches: cloneJson(state.matches),
      contracts: cloneJson(state.contracts),
      finance: cloneJson(state.finance),
      abilities: cloneJson(state.abilities),
      miscellaneous: cloneJson(state.miscellaneous),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}
