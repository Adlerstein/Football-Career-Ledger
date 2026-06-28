import {
  ABILITY_KEYS,
  CAREER_STAGE_VALUES,
  DRAFT_STATUS_VALUES,
  DRAFT_TYPES,
  MANUAL_TOTAL_KEYS,
  SCHEMA_VERSION,
  SOURCE_TYPES,
  SQUAD_ROLE_VALUES,
} from './constants.js';
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

export function createSource(type = 'manual', overrides = {}) {
  const safeType = SOURCE_TYPES.includes(type) ? type : 'manual';
  return {
    messageId: null,
    swipeId: null,
    draftId: null,
    ...overrides,
    type: SOURCE_TYPES.includes(overrides.type) ? overrides.type : safeType,
  };
}

export function createRecordMeta(timestamp = nowIso(), source = createSource()) {
  return {
    createdAt: timestamp,
    updatedAt: timestamp,
    source: normalizeSource(source),
  };
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
      currentTeam: '',
      primaryPosition: '',
      secondaryPositions: [],
      careerStage: 'youth',
      squadRole: 'rotation',
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
    drafts: [],
    operationHistory: [],
  };
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value) {
  return normalizeArray(value).map((item) => String(item)).filter((item) => item.trim().length > 0);
}

export function normalizeSource(value, fallbackType = 'manual') {
  const source = normalizeObject(value);
  const type = SOURCE_TYPES.includes(source.type) ? source.type : fallbackType;
  return {
    type: SOURCE_TYPES.includes(type) ? type : 'manual',
    messageId: source.messageId ?? null,
    swipeId: source.swipeId ?? null,
    draftId: source.draftId ?? null,
  };
}

export function normalizeRecordMeta(value, timestamp = nowIso(), fallbackType = 'migration') {
  const meta = normalizeObject(value);
  const createdAt = typeof meta.createdAt === 'string' && meta.createdAt ? meta.createdAt : timestamp;
  const updatedAt = typeof meta.updatedAt === 'string' && meta.updatedAt ? meta.updatedAt : createdAt;
  return {
    createdAt,
    updatedAt,
    source: normalizeSource(meta.source, fallbackType),
  };
}

function withRecordMeta(record, timestamp, fallbackType = 'migration') {
  const item = normalizeObject(record);
  return {
    ...item,
    meta: normalizeRecordMeta(item.meta, timestamp, fallbackType),
  };
}

// Manual season totals: an object of MANUAL_TOTAL_KEYS → non-negative integer or
// null (null = fall back to the value aggregated from matches). Returns null when
// no field is set, so seasons without overrides stay clean.
export function normalizeManualTotals(value) {
  const data = normalizeObject(value);
  let hasAny = false;
  const result = {};
  for (const key of MANUAL_TOTAL_KEYS) {
    const raw = data[key];
    if (raw === null || raw === undefined || raw === '') {
      result[key] = null;
      continue;
    }
    const number = Number(raw);
    if (Number.isFinite(number) && number >= 0) {
      result[key] = Math.floor(number);
      hasAny = true;
    } else {
      result[key] = null;
    }
  }
  return hasAny ? result : null;
}

function normalizeSeason(season, timestamp, fallbackType = 'migration') {
  const item = withRecordMeta(season, timestamp, fallbackType);
  return {
    ...item,
    closedSummary: item.closedSummary ?? null,
    manualTotals: normalizeManualTotals(item.manualTotals),
  };
}

function normalizeDraft(draft, timestamp) {
  const item = normalizeObject(draft);
  const source = normalizeObject(item.source);
  const type = DRAFT_TYPES.includes(item.type) ? item.type : 'miscellaneous';
  const status = DRAFT_STATUS_VALUES.includes(item.status) ? item.status : 'pending';
  return {
    id: String(item.id || ''),
    type,
    status,
    payload: normalizeObject(item.payload),
    source: {
      messageId: source.messageId ?? '',
      swipeId: Number.isInteger(source.swipeId) ? source.swipeId : 0,
      suggestionIndex: Number.isInteger(source.suggestionIndex) ? source.suggestionIndex : 0,
      contentHash: String(source.contentHash || ''),
      chatId: source.chatId ?? null,
    },
    validationErrors: normalizeArray(item.validationErrors).map((error) => String(error)),
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : timestamp,
    updatedAt: typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : timestamp,
    resolvedAt: item.resolvedAt ?? null,
    rawText: typeof item.rawText === 'string' ? item.rawText : '',
  };
}

function normalizeOperation(operation, timestamp) {
  const item = normalizeObject(operation);
  return {
    id: String(item.id || ''),
    type: String(item.type || ''),
    entityType: String(item.entityType || ''),
    entityId: String(item.entityId || ''),
    before: item.before === undefined ? null : item.before,
    after: item.after === undefined ? null : item.after,
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : timestamp,
    undoneAt: item.undoneAt ?? null,
  };
}

export function migrateStateV1ToV2(oldState) {
  const raw = normalizeObject(oldState);
  const base = createInitialState();
  const meta = normalizeObject(raw.meta);
  const timestamp = typeof meta.updatedAt === 'string' && meta.updatedAt
    ? meta.updatedAt
    : base.meta.updatedAt;
  const player = normalizeObject(raw.player);
  const finance = normalizeObject(raw.finance);
  const abilities = normalizeObject(raw.abilities);
  const abilityCurrent = normalizeObject(abilities.current);

  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      createdAt: typeof meta.createdAt === 'string' && meta.createdAt ? meta.createdAt : base.meta.createdAt,
      updatedAt: typeof meta.updatedAt === 'string' && meta.updatedAt ? meta.updatedAt : base.meta.updatedAt,
    },
    player: {
      ...base.player,
      ...player,
      currentTeam: String(player.currentTeam || player.currentClub || '').trim(),
      secondaryPositions: normalizeStringArray(player.secondaryPositions),
      careerStage: CAREER_STAGE_VALUES.includes(player.careerStage) ? player.careerStage : base.player.careerStage,
      squadRole: SQUAD_ROLE_VALUES.includes(player.squadRole) ? player.squadRole : base.player.squadRole,
      defaultCurrency: String(player.defaultCurrency || base.player.defaultCurrency).trim() || base.player.defaultCurrency,
    },
    seasons: normalizeArray(raw.seasons).map((season) => normalizeSeason(season, timestamp)),
    matches: normalizeArray(raw.matches).map((match) => withRecordMeta(match, timestamp)),
    contracts: normalizeArray(raw.contracts).map((contract) => withRecordMeta(contract, timestamp)),
    finance: {
      ...finance,
      openingBalances: normalizeArray(finance.openingBalances).map((balance) => withRecordMeta(balance, timestamp)),
      transactions: normalizeArray(finance.transactions).map((transaction) => withRecordMeta(transaction, timestamp)),
    },
    abilities: {
      ...abilities,
      current: {
        ...base.abilities.current,
        ...Object.fromEntries(ABILITY_KEYS.map((key) => [key, Number(abilityCurrent[key] ?? 0)])),
      },
      history: normalizeArray(abilities.history).map((history) => withRecordMeta(history, timestamp)),
    },
    miscellaneous: normalizeArray(raw.miscellaneous).map((item) => withRecordMeta(item, timestamp)),
    drafts: normalizeArray(raw.drafts).map((draft) => normalizeDraft(draft, timestamp)).filter((draft) => draft.id),
    operationHistory: normalizeArray(raw.operationHistory).map((operation) => normalizeOperation(operation, timestamp)).filter((operation) => operation.id),
  };
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

  // migrateStateV1ToV2 also serves as the v2 normalizer: it re-normalizes every
  // collection and fills defaults, so it is safe (and idempotent) to run on data
  // that is already at the current schema version.
  const state = migrateStateV1ToV2(raw);
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
