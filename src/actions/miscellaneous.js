// Miscellaneous (key/value note) CRUD actions.

import { createLedgerId, upsertById } from '../utils.js';
import {
  asArray,
  asDate,
  asObject,
  asString,
  pushOperation,
  validateAndReturn,
  withMeta,
} from './core.js';

export function buildMiscRecord(payload, options = {}) {
  const data = asObject(payload);
  return withMeta({
    id: asString(data.id || createLedgerId('misc')),
    date: asDate(data.date),
    key: asString(data.key),
    value: asString(data.value),
    tags: asArray(data.tags).length
      ? asArray(data.tags).map((tag) => asString(tag)).filter(Boolean)
      : asString(data.tags).split(',').map((tag) => tag.trim()).filter(Boolean),
    notes: asString(data.notes),
  }, options, data.meta || null);
}

export function addMiscellaneous(state, payload, options = {}) {
  const item = buildMiscRecord(payload, options);
  state.miscellaneous = upsertById(state.miscellaneous, item);
  pushOperation(state, {
    type: 'create_miscellaneous',
    entityType: 'miscellaneous',
    entityId: item.id,
    before: null,
    after: item,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateMiscellaneous(state, id, patch, options = {}) {
  const before = state.miscellaneous.find((item) => item.id === id);
  if (!before) throw new Error(`杂项不存在：${id}`);
  const after = buildMiscRecord({ ...before, ...patch, id }, options);
  state.miscellaneous = state.miscellaneous.map((item) => item.id === id ? after : item);
  pushOperation(state, {
    type: 'update_miscellaneous',
    entityType: 'miscellaneous',
    entityId: id,
    before,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteMiscellaneous(state, id, options = {}) {
  const before = state.miscellaneous.find((item) => item.id === id);
  if (!before) throw new Error(`杂项不存在：${id}`);
  state.miscellaneous = state.miscellaneous.filter((item) => item.id !== id);
  pushOperation(state, {
    type: 'delete_miscellaneous',
    entityType: 'miscellaneous',
    entityId: id,
    before,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}
