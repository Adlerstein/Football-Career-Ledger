// Finance actions: opening balances and transaction CRUD.

import { TRANSACTION_TYPES } from '../constants.js';
import { createLedgerId, upsertById } from '../utils.js';
import {
  asDate,
  asInteger,
  asObject,
  asString,
  pushOperation,
  validateAndReturn,
  withMeta,
} from './core.js';

export function setOpeningBalance(state, payload, options = {}) {
  const data = asObject(payload);
  const currency = asString(data.currency || state.player.defaultCurrency).trim();
  if (!currency) throw new Error('币种不能为空');
  const before = state.finance.openingBalances.find((balance) => balance.currency === currency) || null;
  const after = withMeta({
    currency,
    amountMinor: asInteger(data.amountMinor),
  }, options, data.meta || before?.meta || null);
  state.finance.openingBalances = [
    ...state.finance.openingBalances.filter((balance) => balance.currency !== currency),
    after,
  ];
  pushOperation(state, {
    type: before ? 'update_opening_balance' : 'create_opening_balance',
    entityType: 'opening_balance',
    entityId: currency,
    before,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteOpeningBalance(state, currency, options = {}) {
  const before = state.finance.openingBalances.find((balance) => balance.currency === currency);
  if (!before) throw new Error(`期初余额不存在：${currency}`);
  state.finance.openingBalances = state.finance.openingBalances.filter((balance) => balance.currency !== currency);
  pushOperation(state, {
    type: 'delete_opening_balance',
    entityType: 'opening_balance',
    entityId: currency,
    before,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function buildTransactionRecord(payload, options = {}) {
  const data = asObject(payload);
  const type = data.type || data.direction;
  return withMeta({
    id: asString(data.id || createLedgerId('transaction')),
    date: asDate(data.date),
    type: TRANSACTION_TYPES.includes(type) ? type : 'expense',
    category: asString(data.category || 'other'),
    amountMinor: Math.max(1, asInteger(data.amountMinor, 1)),
    currency: asString(data.currency || 'DEM').trim(),
    description: asString(data.description),
    relatedContractId: data.relatedContractId || null,
    notes: asString(data.notes),
  }, options, data.meta || null);
}

export function addTransaction(state, payload, options = {}) {
  const transaction = buildTransactionRecord(payload, options);
  state.finance.transactions = upsertById(state.finance.transactions, transaction);
  pushOperation(state, {
    type: 'create_transaction',
    entityType: 'transaction',
    entityId: transaction.id,
    before: null,
    after: transaction,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateTransaction(state, id, patch, options = {}) {
  const before = state.finance.transactions.find((transaction) => transaction.id === id);
  if (!before) throw new Error(`流水不存在：${id}`);
  const after = buildTransactionRecord({ ...before, ...patch, id }, options);
  state.finance.transactions = state.finance.transactions.map((transaction) => transaction.id === id ? after : transaction);
  pushOperation(state, {
    type: 'update_transaction',
    entityType: 'transaction',
    entityId: id,
    before,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteTransaction(state, id, options = {}) {
  const before = state.finance.transactions.find((transaction) => transaction.id === id);
  if (!before) throw new Error(`流水不存在：${id}`);
  state.finance.transactions = state.finance.transactions.filter((transaction) => transaction.id !== id);
  pushOperation(state, {
    type: 'delete_transaction',
    entityType: 'transaction',
    entityId: id,
    before,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}
