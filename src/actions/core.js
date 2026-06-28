// Shared internals for the ledger action modules: value coercions, record-meta
// stamping, the operation-history push, and the validate-and-return wrapper.
// Domain action files (matches, contracts, finance, …) build on these.

import { ABILITY_KEYS, OPERATION_HISTORY_LIMIT } from '../constants.js';
import { cloneJson, createRecordMeta, createSource, nowIso } from '../schema.js';
import { validateState } from '../validation.js';
import { createLedgerId } from '../utils.js';

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asString(value, fallback = '') {
  return String(value ?? fallback);
}

export function asDate(value) {
  return asString(value);
}

export function asInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

export function asBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAbilityValues(values, fallback = {}) {
  const data = asObject(values);
  return Object.fromEntries(
    ABILITY_KEYS.map((key) => [key, clamp(asInteger(data[key], fallback[key] ?? 0), 0, 99)]),
  );
}

function normalizeSourceFromOptions(options = {}) {
  return createSource(options.sourceType || 'manual', options.source || {});
}

export function withMeta(record, options = {}, existingMeta = null) {
  const timestamp = options.timestamp || nowIso();
  const source = normalizeSourceFromOptions(options);
  return {
    ...record,
    meta: {
      ...(existingMeta || createRecordMeta(timestamp, source)),
      updatedAt: timestamp,
      source: existingMeta?.source || source,
    },
  };
}

export function pushOperation(state, operation, timestamp = nowIso()) {
  const entry = {
    id: operation.id || createLedgerId('operation'),
    type: operation.type,
    entityType: operation.entityType || '',
    entityId: operation.entityId || '',
    before: operation.before === undefined ? null : cloneJson(operation.before),
    after: null,
    createdAt: timestamp,
    undoneAt: null,
  };
  state.operationHistory = [entry, ...state.operationHistory.filter((item) => item.id !== entry.id)]
    .slice(0, OPERATION_HISTORY_LIMIT);
  return entry;
}

export function validateAndReturn(state) {
  validateState(state);
  return state;
}

export function requireKnownSeason(state, seasonId) {
  if (!state.seasons.some((season) => season.id === seasonId)) {
    throw new Error(`赛季不存在：${seasonId}`);
  }
}
