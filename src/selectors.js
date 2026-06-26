import { ABILITY_KEYS, QUERY_LIMIT_MAX } from './constants.js';
import { cloneJson } from './schema.js';

function byDateDesc(a, b) {
  return String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || ''));
}

export function clampLimit(value, fallback = QUERY_LIMIT_MAX) {
  const limit = Number(value ?? fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(0, Math.min(QUERY_LIMIT_MAX, Math.floor(limit)));
}

export function getCurrentSeason(state) {
  return state.seasons.find((season) => season.id === state.player.currentSeasonId)
    || state.seasons.find((season) => season.status === 'active')
    || null;
}

export function summarizeSeason(state, seasonId = getCurrentSeason(state)?.id) {
  if (!seasonId) {
    return null;
  }
  const season = state.seasons.find((item) => item.id === seasonId) || null;
  const matches = state.matches.filter((match) => match.seasonId === seasonId);
  const rated = matches.filter((match) => typeof match.rating === 'number');
  const totals = matches.reduce((acc, match) => {
    acc.appearances += match.minutes > 0 ? 1 : 0;
    acc.starts += match.started ? 1 : 0;
    acc.minutes += match.minutes || 0;
    acc.goals += match.goals || 0;
    acc.assists += match.assists || 0;
    acc.yellowCards += match.yellowCards || 0;
    acc.redCards += match.redCards || 0;
    acc.notableMatches += match.notable ? 1 : 0;
    return acc;
  }, {
    appearances: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    notableMatches: 0,
  });

  const averageRating = rated.length
    ? Number((rated.reduce((sum, match) => sum + match.rating, 0) / rated.length).toFixed(2))
    : null;

  return {
    season: season ? cloneJson(season) : null,
    matchCount: matches.length,
    ...totals,
    averageRating,
  };
}

export function getCareerStatus(state) {
  return cloneJson({
    name: state.player.name,
    currentClub: state.player.currentClub,
    currentTeam: state.player.currentTeam,
    primaryPosition: state.player.primaryPosition,
    secondaryPositions: state.player.secondaryPositions,
    careerStage: state.player.careerStage,
    squadRole: state.player.squadRole,
    currentSeasonId: state.player.currentSeasonId,
    defaultCurrency: state.player.defaultCurrency,
  });
}

export function queryMatches(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.matches.slice();
  if (options.seasonId) {
    rows = rows.filter((match) => match.seasonId === options.seasonId);
  }
  if (options.competition) {
    rows = rows.filter((match) => match.competition === options.competition);
  }
  if (options.notableOnly) {
    rows = rows.filter((match) => match.notable);
  }
  rows.sort(byDateDesc);
  return cloneJson(rows.slice(0, limit));
}

export function getActiveContract(state) {
  const contract = state.contracts.find((item) => item.active) || null;
  return contract ? cloneJson(contract) : null;
}

export function getContracts(state, options = {}) {
  const limit = clampLimit(options.limit, QUERY_LIMIT_MAX);
  let rows = state.contracts.slice();
  if (typeof options.active === 'boolean') {
    rows = rows.filter((contract) => contract.active === options.active);
  }
  rows.sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
  return cloneJson(rows.slice(0, limit));
}

export function getFinanceSummary(state) {
  const balances = new Map();
  for (const balance of state.finance.openingBalances) {
    balances.set(balance.currency, (balances.get(balance.currency) || 0) + balance.amountMinor);
  }
  for (const transaction of state.finance.transactions) {
    const current = balances.get(transaction.currency) || 0;
    const delta = transaction.type === 'income' ? transaction.amountMinor : -transaction.amountMinor;
    balances.set(transaction.currency, current + delta);
  }
  return {
    balances: Array.from(balances.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amountMinor]) => ({ currency, amountMinor })),
    transactionCount: state.finance.transactions.length,
  };
}

export function getBalance(state, currency) {
  const row = getFinanceSummary(state).balances.find((item) => item.currency === currency);
  return row ? row.amountMinor : 0;
}

export function getAllBalances(state) {
  return cloneJson(getFinanceSummary(state).balances);
}

export function queryTransactions(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.finance.transactions.slice();
  if (options.currency) rows = rows.filter((row) => row.currency === options.currency);
  if (options.type) rows = rows.filter((row) => row.type === options.type);
  if (options.category) rows = rows.filter((row) => row.category === options.category);
  rows.sort(byDateDesc);
  return cloneJson(rows.slice(0, limit));
}

export function getAbilities(state) {
  return cloneJson(Object.fromEntries(ABILITY_KEYS.map((key) => [key, state.abilities.current[key] ?? 0])));
}

export function getAbilityHistory(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.abilities.history.slice();
  if (options.ability) rows = rows.filter((row) => row.ability === options.ability);
  rows.sort(byDateDesc);
  return cloneJson(rows.slice(0, limit));
}

export function getMiscellaneous(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.miscellaneous.slice();
  if (options.key) rows = rows.filter((row) => row.key === options.key);
  if (options.tag) rows = rows.filter((row) => Array.isArray(row.tags) && row.tags.includes(options.tag));
  rows.sort(byDateDesc);
  return cloneJson(rows.slice(0, limit));
}

export function getDrafts(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.drafts.slice();
  if (options.status) rows = rows.filter((draft) => draft.status === options.status);
  if (options.type) rows = rows.filter((draft) => draft.type === options.type);
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return cloneJson(rows.slice(0, limit));
}

export function getDraft(state, id) {
  const draft = state.drafts.find((item) => item.id === id) || null;
  return draft ? cloneJson(draft) : null;
}

export function getPendingDraftCount(state) {
  return state.drafts.filter((draft) => draft.status === 'pending').length;
}

export function getSeasonClosure(state, seasonId) {
  const season = state.seasons.find((item) => item.id === seasonId) || null;
  return season?.closedSummary ? cloneJson(season.closedSummary) : null;
}

export function getOperationHistory(state, options = {}) {
  const limit = clampLimit(options.limit, 25);
  let rows = state.operationHistory.slice();
  if (options.entityType) rows = rows.filter((operation) => operation.entityType === options.entityType);
  if (options.includeUndone === false) rows = rows.filter((operation) => !operation.undoneAt);
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return cloneJson(rows.slice(0, limit));
}

export function getSnapshot(state) {
  return cloneJson({
    ...state,
    derived: {
      currentSeason: getCurrentSeason(state),
      currentSeasonSummary: summarizeSeason(state),
      activeContract: getActiveContract(state),
      financeSummary: getFinanceSummary(state),
      pendingDraftCount: getPendingDraftCount(state),
    },
  });
}
