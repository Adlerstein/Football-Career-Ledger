// Contract CRUD actions, including the single-active-contract invariant.

import { cloneJson } from '../schema.js';
import { createLedgerId, upsertById } from '../utils.js';
import {
  asBoolean,
  asDate,
  asInteger,
  asObject,
  asString,
  pushOperation,
  validateAndReturn,
  withMeta,
} from './core.js';

export function buildContractRecord(payload, options = {}) {
  const data = asObject(payload);
  return withMeta({
    id: asString(data.id || createLedgerId('contract')),
    club: asString(data.club),
    contractType: asString(data.contractType || 'other'),
    startDate: asDate(data.startDate),
    endDate: data.endDate ? asString(data.endDate) : null,
    wageAmountMinor: Math.max(1, asInteger(data.wageAmountMinor, 1)),
    wageCurrency: asString(data.wageCurrency || data.currency || 'DEM').trim(),
    wagePeriod: asString(data.wagePeriod || 'weekly'),
    bonuses: asString(data.bonuses),
    clauses: asString(data.clauses),
    active: asBoolean(data.active),
    notes: asString(data.notes),
  }, options, data.meta || null);
}

export function addContract(state, payload, options = {}) {
  const contract = buildContractRecord(payload, options);
  const beforeContracts = cloneJson(state.contracts);
  if (contract.active) {
    state.contracts = state.contracts.map((row) => ({ ...row, active: false }));
  }
  state.contracts = upsertById(state.contracts, contract);
  pushOperation(state, {
    type: 'create_contract',
    entityType: 'contract',
    entityId: contract.id,
    before: beforeContracts,
    after: state.contracts,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateContract(state, id, patch, options = {}) {
  const beforeContracts = cloneJson(state.contracts);
  const before = state.contracts.find((contract) => contract.id === id);
  if (!before) throw new Error(`合同不存在：${id}`);
  const after = buildContractRecord({ ...before, ...patch, id }, options);
  state.contracts = state.contracts.map((contract) => contract.id === id ? after : contract);
  if (after.active) {
    state.contracts = state.contracts.map((contract) => ({ ...contract, active: contract.id === id }));
  }
  pushOperation(state, {
    type: 'update_contract',
    entityType: 'contract',
    entityId: id,
    before: beforeContracts,
    after: state.contracts,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteContract(state, id, options = {}) {
  if (state.finance.transactions.some((transaction) => transaction.relatedContractId === id)) {
    throw new Error('有流水关联这份合同，删不了');
  }
  const beforeContracts = cloneJson(state.contracts);
  const before = state.contracts.find((contract) => contract.id === id);
  if (!before) throw new Error(`合同不存在：${id}`);
  state.contracts = state.contracts.filter((contract) => contract.id !== id);
  pushOperation(state, {
    type: 'delete_contract',
    entityType: 'contract',
    entityId: id,
    before: beforeContracts,
    after: state.contracts,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function setActiveContract(state, id, options = {}) {
  const beforeContracts = cloneJson(state.contracts);
  if (!state.contracts.some((contract) => contract.id === id)) throw new Error(`合同不存在：${id}`);
  state.contracts = state.contracts.map((contract) => withMeta({
    ...contract,
    active: contract.id === id,
  }, options, contract.meta));
  pushOperation(state, {
    type: 'set_active_contract',
    entityType: 'contract',
    entityId: id,
    before: beforeContracts,
    after: state.contracts,
  }, options.timestamp);
  return validateAndReturn(state);
}
