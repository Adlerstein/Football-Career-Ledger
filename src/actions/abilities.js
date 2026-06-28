// Ability actions: applying changes, seeding initial values, and history CRUD.
// state.abilities.current is kept consistent with the latest history row.

import { ABILITY_KEYS, LEDGER_START_DATE } from '../constants.js';
import { cloneJson } from '../schema.js';
import { createLedgerId, upsertById } from '../utils.js';
import {
  asArray,
  asDate,
  asInteger,
  asObject,
  asString,
  clamp,
  normalizeAbilityValues,
  pushOperation,
  validateAndReturn,
  withMeta,
} from './core.js';

export function applyAbilityChange(state, payload, options = {}) {
  const data = asObject(payload);
  const ability = asString(data.ability);
  if (!ABILITY_KEYS.includes(ability)) throw new Error(`未知能力项：${ability}`);
  const beforeValue = state.abilities.current[ability] ?? 0;
  const delta = data.delta === undefined ? null : asInteger(data.delta);
  const afterValue = data.after === undefined
    ? clamp(beforeValue + (delta ?? 0), 0, 99)
    : clamp(asInteger(data.after), 0, 99);
  if (delta !== null && (delta < -2 || delta > 2)) {
    throw new Error('单次能力变动只能在 -2 到 2 之间');
  }
  const reason = asString(data.reason).trim();
  if (!asDate(data.date)) throw new Error('能力变动要填日期');
  if (!reason) throw new Error('能力变动要填原因');
  const history = withMeta({
    id: asString(data.id || createLedgerId('ability')),
    date: asDate(data.date),
    ability,
    before: beforeValue,
    after: afterValue,
    reason,
    notes: asString(data.notes),
    evaluationPeriod: asObject(data.evaluationPeriod),
    evidence: asArray(data.evidence).map((item) => asString(item)),
    sourceRecordIds: asArray(data.sourceRecordIds).map((item) => asString(item)),
  }, options, data.meta || null);
  const before = {
    current: cloneJson(state.abilities.current),
    history: cloneJson(state.abilities.history),
  };
  state.abilities.current = {
    ...state.abilities.current,
    [ability]: afterValue,
  };
  state.abilities.history = upsertById(state.abilities.history, history);
  pushOperation(state, {
    type: 'update_ability',
    entityType: 'ability',
    entityId: ability,
    before,
    after: {
      current: cloneJson(state.abilities.current),
      history: cloneJson(state.abilities.history),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function setInitialAbilities(state, payload, options = {}) {
  const data = asObject(payload);
  if (state.abilities.history.length > 0 && !options.force) {
    throw new Error('已经有能力历史了，不能直接覆盖初始值；先去编辑或删掉相关历史');
  }
  const before = {
    current: cloneJson(state.abilities.current),
    history: cloneJson(state.abilities.history),
  };
  const values = normalizeAbilityValues(data.values || data, state.abilities.current);
  state.abilities.current = {
    ...state.abilities.current,
    ...values,
  };
  pushOperation(state, {
    type: 'set_initial_abilities',
    entityType: 'ability',
    entityId: 'initial',
    before,
    after: {
      current: cloneJson(state.abilities.current),
      history: cloneJson(state.abilities.history),
      effectiveDate: asDate(data.date || LEDGER_START_DATE),
      reason: asString(data.reason || '初始能力导入'),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateAbilityHistory(state, id, patch, options = {}) {
  const before = {
    current: cloneJson(state.abilities.current),
    history: cloneJson(state.abilities.history),
  };
  const existing = state.abilities.history.find((item) => item.id === id);
  if (!existing) throw new Error(`能力历史不存在：${id}`);
  const data = { ...existing, ...asObject(patch), id };
  if (!ABILITY_KEYS.includes(data.ability)) throw new Error(`未知能力项：${data.ability}`);
  const afterRow = withMeta({
    ...data,
    date: asDate(data.date),
    before: clamp(asInteger(data.before), 0, 99),
    after: clamp(asInteger(data.after), 0, 99),
    reason: asString(data.reason),
    notes: asString(data.notes),
    evidence: asArray(data.evidence).map((item) => asString(item)),
    sourceRecordIds: asArray(data.sourceRecordIds).map((item) => asString(item)),
  }, options, existing.meta);
  state.abilities.history = state.abilities.history.map((item) => item.id === id ? afterRow : item);
  const latestForAbility = state.abilities.history
    .filter((item) => item.ability === afterRow.ability)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.meta?.updatedAt || '').localeCompare(String(a.meta?.updatedAt || '')))[0];
  if (latestForAbility?.id === id) {
    state.abilities.current[afterRow.ability] = afterRow.after;
  }
  pushOperation(state, {
    type: 'update_ability_history',
    entityType: 'ability_history',
    entityId: id,
    before,
    after: {
      current: cloneJson(state.abilities.current),
      history: cloneJson(state.abilities.history),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteAbilityHistory(state, id, options = {}) {
  const existing = state.abilities.history.find((item) => item.id === id);
  if (!existing) throw new Error(`能力历史不存在：${id}`);
  const laterForAbility = state.abilities.history.some((item) => item.ability === existing.ability && String(item.date) > String(existing.date));
  if (laterForAbility) {
    throw new Error('这条之后还有更新的能力记录，删不了');
  }
  const before = {
    current: cloneJson(state.abilities.current),
    history: cloneJson(state.abilities.history),
  };
  state.abilities.history = state.abilities.history.filter((item) => item.id !== id);
  const latest = state.abilities.history
    .filter((item) => item.ability === existing.ability)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  state.abilities.current[existing.ability] = latest ? latest.after : existing.before;
  pushOperation(state, {
    type: 'delete_ability_history',
    entityType: 'ability_history',
    entityId: id,
    before,
    after: {
      current: cloneJson(state.abilities.current),
      history: cloneJson(state.abilities.history),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}
