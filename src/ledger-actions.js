import {
  ABILITY_KEYS,
  DRAFT_STATUS_VALUES,
  DRAFT_TYPES,
  HOME_AWAY_VALUES,
  LEDGER_START_DATE,
  OPERATION_HISTORY_LIMIT,
  TRANSACTION_TYPES,
} from './constants.js';
import { cloneJson, createRecordMeta, createSource, nowIso } from './schema.js';
import { formatSeasonTotals } from './formatters.js';
import { parseSeasonInput } from './season-utils.js';
import { summarizeSeason } from './selectors.js';
import { validateState } from './validation.js';

export function createLedgerId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = '') {
  return String(value ?? fallback);
}

function asDate(value) {
  return asString(value);
}

function asInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function asBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAbilityValues(values, fallback = {}) {
  const data = asObject(values);
  return Object.fromEntries(
    ABILITY_KEYS.map((key) => [key, clamp(asInteger(data[key], fallback[key] ?? 0), 0, 99)]),
  );
}

function normalizeSourceFromOptions(options = {}) {
  return createSource(options.sourceType || 'manual', options.source || {});
}

function withMeta(record, options = {}, existingMeta = null) {
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

function validateAndReturn(state) {
  validateState(state);
  return state;
}

function upsertById(items, item) {
  const index = items.findIndex((row) => row.id === item.id);
  if (index < 0) return [item, ...items];
  return items.map((row, rowIndex) => rowIndex === index ? item : row);
}

function requireKnownSeason(state, seasonId) {
  if (!state.seasons.some((season) => season.id === seasonId)) {
    throw new Error(`赛季不存在：${seasonId}`);
  }
}

export function buildMatchRecord(state, payload, options = {}) {
  const data = asObject(payload);
  const seasonId = asString(data.seasonId || state.player.currentSeasonId);
  requireKnownSeason(state, seasonId);
  const homeAway = HOME_AWAY_VALUES.includes(data.homeAway) ? data.homeAway : 'home';
  const rating = data.rating === '' || data.rating === null || data.rating === undefined ? null : Number(data.rating);
  return withMeta({
    id: asString(data.id || createLedgerId('match')),
    seasonId,
    date: asDate(data.date),
    competition: asString(data.competition),
    club: asString(data.club || state.player.currentTeam || state.player.currentClub),
    opponent: asString(data.opponent),
    homeAway,
    goalsFor: Math.max(0, asInteger(data.goalsFor)),
    goalsAgainst: Math.max(0, asInteger(data.goalsAgainst)),
    started: asBoolean(data.started),
    minutes: clamp(asInteger(data.minutes), 0, 130),
    goals: Math.max(0, asInteger(data.goals)),
    assists: Math.max(0, asInteger(data.assists)),
    yellowCards: Math.max(0, asInteger(data.yellowCards)),
    redCards: Math.max(0, asInteger(data.redCards)),
    rating,
    notable: asBoolean(data.notable),
    notes: asString(data.notes),
  }, options, data.meta || null);
}

export function addMatch(state, payload, options = {}) {
  const match = buildMatchRecord(state, payload, options);
  state.matches = upsertById(state.matches, match);
  pushOperation(state, {
    type: 'create_match',
    entityType: 'match',
    entityId: match.id,
    before: null,
    after: match,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateMatch(state, id, patch, options = {}) {
  const before = state.matches.find((match) => match.id === id);
  if (!before) throw new Error(`比赛不存在：${id}`);
  const after = buildMatchRecord(state, { ...before, ...patch, id }, options);
  state.matches = state.matches.map((match) => match.id === id ? after : match);
  pushOperation(state, {
    type: 'update_match',
    entityType: 'match',
    entityId: id,
    before,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteMatch(state, id, options = {}) {
  const before = state.matches.find((match) => match.id === id);
  if (!before) throw new Error(`比赛不存在：${id}`);
  state.matches = state.matches.filter((match) => match.id !== id);
  pushOperation(state, {
    type: 'delete_match',
    entityType: 'match',
    entityId: id,
    before,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}

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
    throw new Error('该合同仍被财务流水引用，不能删除');
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
    throw new Error('能力单次变化量必须在 -2 到 2 之间');
  }
  const reason = asString(data.reason).trim();
  if (!asDate(data.date)) throw new Error('能力变更必须填写日期');
  if (!reason) throw new Error('能力变更必须填写原因');
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
    throw new Error('已有能力历史时不能覆盖初始能力，请先编辑或删除相关历史记录');
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
    throw new Error('只能删除该能力项最新之后不被依赖的历史记录');
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

export function updatePlayerStatus(state, patch, options = {}) {
  const before = cloneJson(state.player);
  state.player = {
    ...state.player,
    ...patch,
    secondaryPositions: asArray(patch.secondaryPositions ?? state.player.secondaryPositions).map((item) => asString(item)).filter(Boolean),
  };
  pushOperation(state, {
    type: 'update_player',
    entityType: 'player',
    entityId: 'player',
    before,
    after: state.player,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function buildSeasonRecord(payload, options = {}) {
  const data = asObject(payload);
  const parsed = parseSeasonInput(data.id);
  return withMeta({
    id: asString(parsed.id || data.id),
    label: asString(data.label || parsed.label || data.id),
    club: asString(data.club),
    startedAt: asDate(data.startedAt || parsed.startedAt),
    endedAt: data.endedAt || null,
    status: asString(data.status || 'planned'),
    notes: asString(data.notes),
    closedSummary: data.closedSummary ?? null,
  }, options, data.meta || null);
}

export function addSeason(state, payload, options = {}) {
  const season = buildSeasonRecord(payload, options);
  if (!season.id) throw new Error('赛季 id 不能为空');
  const beforeSeasons = cloneJson(state.seasons);
  const beforePlayer = cloneJson(state.player);
  if (season.status === 'active') {
    state.seasons = state.seasons.map((row) => ({ ...row, status: row.status === 'active' ? 'completed' : row.status }));
    state.player.currentSeasonId = season.id;
    state.player.currentTeam = season.club || state.player.currentTeam;
  }
  state.seasons = upsertById(state.seasons, season);
  pushOperation(state, {
    type: 'create_season',
    entityType: 'season',
    entityId: season.id,
    before: { seasons: beforeSeasons, player: beforePlayer },
    after: { seasons: state.seasons, player: state.player },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateSeason(state, id, patch, options = {}) {
  const beforeSeasons = cloneJson(state.seasons);
  const beforePlayer = cloneJson(state.player);
  const before = state.seasons.find((season) => season.id === id);
  if (!before) throw new Error(`赛季不存在：${id}`);
  const after = buildSeasonRecord({ ...before, ...patch, id }, options);
  state.seasons = state.seasons.map((season) => season.id === id ? after : season);
  if (after.status === 'active') {
    state.seasons = state.seasons.map((season) => ({ ...season, status: season.id === id ? 'active' : season.status === 'active' ? 'completed' : season.status }));
    state.player.currentSeasonId = id;
    state.player.currentTeam = after.club || state.player.currentTeam;
  }
  pushOperation(state, {
    type: 'update_season',
    entityType: 'season',
    entityId: id,
    before: { seasons: beforeSeasons, player: beforePlayer },
    after: { seasons: state.seasons, player: state.player },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteSeason(state, id, options = {}) {
  if (state.matches.some((match) => match.seasonId === id)) {
    throw new Error('该赛季仍有比赛记录，不能删除');
  }
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const existing = state.seasons.find((season) => season.id === id);
  if (!existing) throw new Error(`赛季不存在：${id}`);
  state.seasons = state.seasons.filter((season) => season.id !== id);
  if (state.player.currentSeasonId === id) {
    state.player.currentSeasonId = '';
  }
  pushOperation(state, {
    type: 'delete_season',
    entityType: 'season',
    entityId: id,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function closeSeason(state, seasonId, closure, options = {}) {
  const season = state.seasons.find((item) => item.id === seasonId);
  if (!season) throw new Error(`赛季不存在：${seasonId}`);
  const totals = summarizeSeason(state, seasonId);
  const data = asObject(closure);
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const closedAt = options.timestamp || nowIso();
  const after = withMeta({
    ...season,
    endedAt: data.endedAt || season.endedAt || closedAt.slice(0, 10),
    status: 'completed',
    closedSummary: {
      calculatedTotals: totals ? {
        matchCount: totals.matchCount,
        appearances: totals.appearances,
        starts: totals.starts,
        minutes: totals.minutes,
        goals: totals.goals,
        assists: totals.assists,
        yellowCards: totals.yellowCards,
        redCards: totals.redCards,
        averageRating: totals.averageRating,
        notableMatches: state.matches.filter((match) => match.seasonId === seasonId && match.notable).length,
      } : {},
      teamOutcome: asString(data.teamOutcome) || formatSeasonTotals(totals),
      finalStanding: asString(data.finalStanding),
      roleAtEnd: asString(data.roleAtEnd),
      narrativeSummary: asString(data.narrativeSummary),
      teamHonors: asArray(data.teamHonors).length ? asArray(data.teamHonors).map((item) => asString(item)).filter(Boolean) : asString(data.teamHonors).split(',').map((item) => item.trim()).filter(Boolean),
      individualHonors: asArray(data.individualHonors).length ? asArray(data.individualHonors).map((item) => asString(item)).filter(Boolean) : asString(data.individualHonors).split(',').map((item) => item.trim()).filter(Boolean),
      closedAt,
    },
  }, options, season.meta);
  state.seasons = state.seasons.map((item) => item.id === seasonId ? after : item);
  if (state.player.currentSeasonId === seasonId) {
    state.player.currentSeasonId = '';
  }
  pushOperation(state, {
    type: 'close_season',
    entityType: 'season',
    entityId: seasonId,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function recalculateSeasonClosure(state, seasonId, options = {}) {
  const season = state.seasons.find((item) => item.id === seasonId);
  if (!season?.closedSummary) throw new Error('该赛季尚未关闭');
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const totals = summarizeSeason(state, seasonId);
  const after = withMeta({
    ...season,
    closedSummary: {
      ...season.closedSummary,
      calculatedTotals: totals ? {
        matchCount: totals.matchCount,
        appearances: totals.appearances,
        starts: totals.starts,
        minutes: totals.minutes,
        goals: totals.goals,
        assists: totals.assists,
        yellowCards: totals.yellowCards,
        redCards: totals.redCards,
        averageRating: totals.averageRating,
        notableMatches: state.matches.filter((match) => match.seasonId === seasonId && match.notable).length,
      } : {},
    },
  }, options, season.meta);
  state.seasons = state.seasons.map((item) => item.id === seasonId ? after : item);
  pushOperation(state, {
    type: 'recalculate_season_closure',
    entityType: 'season',
    entityId: seasonId,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function createNextSeason(state, payload, options = {}) {
  if (state.seasons.some((season) => season.status === 'active')) {
    throw new Error('请先结束当前活动赛季，再创建下一赛季');
  }
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const season = buildSeasonRecord({ ...payload, status: 'active' }, options);
  if (!season.id) throw new Error('赛季 id 不能为空');
  state.seasons = state.seasons.map((item) => ({ ...item, status: item.status === 'active' ? 'completed' : item.status }));
  state.seasons = upsertById(state.seasons, season);
  state.player = {
    ...state.player,
    currentSeasonId: season.id,
    currentClub: asString(payload.currentClub ?? state.player.currentClub),
    currentTeam: asString(payload.currentTeam ?? season.club ?? state.player.currentTeam),
  };
  pushOperation(state, {
    type: 'create_next_season',
    entityType: 'season',
    entityId: season.id,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

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
  if (draft.status !== 'pending') throw new Error('只能确认待处理草稿');
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
    else throw new Error(`未知草稿类型：${draft.type}`);
  } catch (error) {
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
      matches: cloneJson(state.matches),
      contracts: cloneJson(state.contracts),
      finance: cloneJson(state.finance),
      abilities: cloneJson(state.abilities),
      miscellaneous: cloneJson(state.miscellaneous),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

function restoreCollectionByEntity(state, operation) {
  const { entityType, entityId, before, after } = operation;
  if (operation.type === 'confirm_draft' && before) {
    state.drafts = upsertById(state.drafts.filter((item) => item.id !== entityId), before.draft);
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
