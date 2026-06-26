import { ABILITY_KEYS, SCHEMA_VERSION } from './constants.js';
import { validateState } from './validation.js';

export function nowIso() {
  return new Date().toISOString();
}

export function cloneJson(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function createInitialAbilities() {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0]));
}

export function createInitialState(timestamp = nowIso()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    player: {
      name: '',
      currentClub: '',
      primaryPosition: '',
      currentSeasonId: '',
      defaultCurrency: 'DEM',
    },
    seasons: [],
    matches: [],
    contracts: [],
    finance: {
      openingBalances: [],
      transactions: [],
    },
    abilities: {
      current: createInitialAbilities(),
      history: [],
    },
    miscellaneous: [],
  };
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function migrateState(rawState) {
  if (!rawState) {
    return createInitialState();
  }

  const raw = normalizeObject(rawState);
  const version = Number(raw.schemaVersion || 1);
  if (version > SCHEMA_VERSION) {
    throw new Error(`不支持的 schemaVersion: ${version}`);
  }

  const base = createInitialState();
  const meta = normalizeObject(raw.meta);
  const player = normalizeObject(raw.player);
  const finance = normalizeObject(raw.finance);
  const abilities = normalizeObject(raw.abilities);
  const abilityCurrent = normalizeObject(abilities.current);

  const state = {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      createdAt: typeof meta.createdAt === 'string' && meta.createdAt ? meta.createdAt : base.meta.createdAt,
      updatedAt: typeof meta.updatedAt === 'string' && meta.updatedAt ? meta.updatedAt : base.meta.updatedAt,
    },
    player: {
      ...base.player,
      ...player,
      defaultCurrency: String(player.defaultCurrency || base.player.defaultCurrency).trim() || base.player.defaultCurrency,
    },
    seasons: normalizeArray(raw.seasons),
    matches: normalizeArray(raw.matches),
    contracts: normalizeArray(raw.contracts),
    finance: {
      openingBalances: normalizeArray(finance.openingBalances),
      transactions: normalizeArray(finance.transactions),
    },
    abilities: {
      current: {
        ...base.abilities.current,
        ...Object.fromEntries(ABILITY_KEYS.map((key) => [key, Number(abilityCurrent[key] ?? 0)])),
      },
      history: normalizeArray(abilities.history),
    },
    miscellaneous: normalizeArray(raw.miscellaneous),
  };

  validateState(state);
  return state;
}

export function touchState(state, timestamp = nowIso()) {
  return {
    ...state,
    meta: {
      ...state.meta,
      updatedAt: timestamp,
    },
  };
}
