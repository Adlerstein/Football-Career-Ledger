import {
  ABILITY_KEYS,
  CAREER_STAGE_VALUES,
  CONTRACT_TYPES,
  DRAFT_STATUS_VALUES,
  DRAFT_TYPES,
  FINANCE_CATEGORIES,
  HOME_AWAY_VALUES,
  SCHEMA_VERSION,
  SEASON_STATUS_VALUES,
  SOURCE_TYPES,
  SQUAD_ROLE_VALUES,
  TRANSACTION_TYPES,
  WAGE_PERIODS,
} from './constants.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isDateString(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function isSafePositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateUniqueIds(items, label, errors) {
  const ids = new Set();
  for (const item of items) {
    assert(typeof item.id === 'string' && item.id.trim().length > 0, `${label} 存在空 id`, errors);
    if (ids.has(item.id)) {
      errors.push(`${label} id 重复: ${item.id}`);
    }
    ids.add(item.id);
  }
}

function validateMeta(meta, label, errors) {
  assert(isPlainObject(meta), `${label} meta 必须是对象`, errors);
  if (!isPlainObject(meta)) return;
  assert(typeof meta.createdAt === 'string' && meta.createdAt.length > 0, `${label} meta.createdAt 不能为空`, errors);
  assert(typeof meta.updatedAt === 'string' && meta.updatedAt.length > 0, `${label} meta.updatedAt 不能为空`, errors);
  assert(isPlainObject(meta.source), `${label} meta.source 必须是对象`, errors);
  assert(SOURCE_TYPES.includes(meta.source?.type), `${label} meta.source.type 无效`, errors);
}

function validateSeason(season, errors) {
  assert(typeof season.id === 'string' && season.id.trim().length > 0, '赛季 id 不能为空', errors);
  assert(typeof season.label === 'string', `赛季 ${season.id} label 必须是字符串`, errors);
  assert(typeof season.club === 'string', `赛季 ${season.id} club 必须是字符串`, errors);
  assert(isDateString(season.startedAt), `赛季 ${season.id} startedAt 日期无效`, errors);
  assert(isDateString(season.endedAt), `赛季 ${season.id} endedAt 日期无效`, errors);
  assert(SEASON_STATUS_VALUES.includes(season.status), `赛季 ${season.id} status 无效`, errors);
  if (season.startedAt && season.endedAt) {
    assert(season.startedAt <= season.endedAt, `赛季 ${season.id} 结束日期早于开始日期`, errors);
  }
  assert(season.closedSummary === null || isPlainObject(season.closedSummary), `赛季 ${season.id} closedSummary 必须是对象或 null`, errors);
  validateMeta(season.meta, `赛季 ${season.id}`, errors);
}

function validateMatch(match, seasonIds, errors) {
  assert(seasonIds.has(match.seasonId), `比赛 ${match.id} 引用了不存在的赛季: ${match.seasonId}`, errors);
  assert(isDateString(match.date), `比赛 ${match.id} 日期无效`, errors);
  assert(HOME_AWAY_VALUES.includes(match.homeAway), `比赛 ${match.id} homeAway 无效`, errors);
  assert(isNonNegativeInteger(match.goalsFor), `比赛 ${match.id} goalsFor 必须是非负整数`, errors);
  assert(isNonNegativeInteger(match.goalsAgainst), `比赛 ${match.id} goalsAgainst 必须是非负整数`, errors);
  assert(typeof match.started === 'boolean', `比赛 ${match.id} started 必须是布尔值`, errors);
  assert(Number.isInteger(match.minutes) && match.minutes >= 0 && match.minutes <= 130, `比赛 ${match.id} minutes 超出范围`, errors);
  assert(isNonNegativeInteger(match.goals), `比赛 ${match.id} goals 必须是非负整数`, errors);
  assert(isNonNegativeInteger(match.assists), `比赛 ${match.id} assists 必须是非负整数`, errors);
  assert(isNonNegativeInteger(match.yellowCards), `比赛 ${match.id} yellowCards 必须是非负整数`, errors);
  assert(isNonNegativeInteger(match.redCards), `比赛 ${match.id} redCards 必须是非负整数`, errors);
  assert(match.rating === null || match.rating === '' || (typeof match.rating === 'number' && match.rating >= 0 && match.rating <= 10), `比赛 ${match.id} rating 无效`, errors);
  assert(typeof match.notable === 'boolean', `比赛 ${match.id} notable 必须是布尔值`, errors);
  validateMeta(match.meta, `比赛 ${match.id}`, errors);
}

function validateContract(contract, errors) {
  assert(CONTRACT_TYPES.includes(contract.contractType), `合同 ${contract.id} contractType 无效`, errors);
  assert(isDateString(contract.startDate), `合同 ${contract.id} startDate 无效`, errors);
  assert(isDateString(contract.endDate), `合同 ${contract.id} endDate 无效`, errors);
  if (contract.startDate && contract.endDate) {
    assert(contract.startDate <= contract.endDate, `合同 ${contract.id} 结束日期早于开始日期`, errors);
  }
  assert(isSafePositiveInteger(contract.wageAmountMinor), `合同 ${contract.id} wageAmountMinor 必须是安全正整数`, errors);
  assert(typeof contract.wageCurrency === 'string' && contract.wageCurrency.trim().length > 0, `合同 ${contract.id} wageCurrency 不能为空`, errors);
  assert(WAGE_PERIODS.includes(contract.wagePeriod), `合同 ${contract.id} wagePeriod 无效`, errors);
  assert(typeof contract.active === 'boolean', `合同 ${contract.id} active 必须是布尔值`, errors);
  validateMeta(contract.meta, `合同 ${contract.id}`, errors);
}

function validateOpeningBalance(balance, errors) {
  assert(typeof balance.currency === 'string' && balance.currency.trim().length > 0, '期初余额 currency 不能为空', errors);
  assert(Number.isSafeInteger(balance.amountMinor), `期初余额 ${balance.currency} amountMinor 必须是安全整数`, errors);
  validateMeta(balance.meta, `期初余额 ${balance.currency}`, errors);
}

function validateTransaction(transaction, contractIds, errors) {
  assert(isDateString(transaction.date), `流水 ${transaction.id} 日期无效`, errors);
  assert(TRANSACTION_TYPES.includes(transaction.type), `流水 ${transaction.id} type 无效`, errors);
  assert(FINANCE_CATEGORIES.includes(transaction.category), `流水 ${transaction.id} category 无效`, errors);
  assert(isSafePositiveInteger(transaction.amountMinor), `流水 ${transaction.id} amountMinor 必须是安全正整数`, errors);
  assert(typeof transaction.currency === 'string' && transaction.currency.trim().length > 0, `流水 ${transaction.id} currency 不能为空`, errors);
  assert(transaction.relatedContractId === null || contractIds.has(transaction.relatedContractId), `流水 ${transaction.id} relatedContractId 无效`, errors);
  validateMeta(transaction.meta, `流水 ${transaction.id}`, errors);
}

function validateAbilities(abilities, errors) {
  for (const key of ABILITY_KEYS) {
    const value = abilities.current?.[key];
    assert(Number.isInteger(value) && value >= 0 && value <= 99, `能力 ${key} 必须在 0 至 99`, errors);
  }
  for (const item of abilities.history) {
    assert(ABILITY_KEYS.includes(item.ability), `能力历史 ${item.id} ability 无效`, errors);
    assert(isDateString(item.date), `能力历史 ${item.id} 日期无效`, errors);
    assert(Number.isInteger(item.before) && item.before >= 0 && item.before <= 99, `能力历史 ${item.id} before 无效`, errors);
    assert(Number.isInteger(item.after) && item.after >= 0 && item.after <= 99, `能力历史 ${item.id} after 无效`, errors);
    validateMeta(item.meta, `能力历史 ${item.id}`, errors);
  }
}

function validateMisc(item, errors) {
  assert(isDateString(item.date), `杂项 ${item.id} 日期无效`, errors);
  assert(typeof item.key === 'string' && item.key.trim().length > 0, `杂项 ${item.id} key 不能为空`, errors);
  assert(typeof item.value === 'string', `杂项 ${item.id} value 必须是字符串`, errors);
  assert(Array.isArray(item.tags), `杂项 ${item.id} tags 必须是数组`, errors);
  validateMeta(item.meta, `杂项 ${item.id}`, errors);
}

function validateDraft(draft, errors) {
  assert(typeof draft.id === 'string' && draft.id.trim().length > 0, '草稿 id 不能为空', errors);
  assert(DRAFT_TYPES.includes(draft.type), `草稿 ${draft.id} type 无效`, errors);
  assert(DRAFT_STATUS_VALUES.includes(draft.status), `草稿 ${draft.id} status 无效`, errors);
  assert(isPlainObject(draft.payload), `草稿 ${draft.id} payload 必须是对象`, errors);
  assert(isPlainObject(draft.source), `草稿 ${draft.id} source 必须是对象`, errors);
  assert(Number.isInteger(draft.source.suggestionIndex) && draft.source.suggestionIndex >= 0, `草稿 ${draft.id} suggestionIndex 无效`, errors);
  assert(typeof draft.source.contentHash === 'string', `草稿 ${draft.id} contentHash 必须是字符串`, errors);
  assert(Array.isArray(draft.validationErrors), `草稿 ${draft.id} validationErrors 必须是数组`, errors);
  assert(typeof draft.createdAt === 'string' && draft.createdAt.length > 0, `草稿 ${draft.id} createdAt 不能为空`, errors);
  assert(typeof draft.updatedAt === 'string' && draft.updatedAt.length > 0, `草稿 ${draft.id} updatedAt 不能为空`, errors);
}

function validateOperation(operation, errors) {
  assert(typeof operation.id === 'string' && operation.id.trim().length > 0, '操作历史 id 不能为空', errors);
  assert(typeof operation.type === 'string' && operation.type.trim().length > 0, `操作历史 ${operation.id} type 不能为空`, errors);
  assert(typeof operation.entityType === 'string', `操作历史 ${operation.id} entityType 必须是字符串`, errors);
  assert(typeof operation.entityId === 'string', `操作历史 ${operation.id} entityId 必须是字符串`, errors);
  assert(typeof operation.createdAt === 'string' && operation.createdAt.length > 0, `操作历史 ${operation.id} createdAt 不能为空`, errors);
  assert(operation.undoneAt === null || typeof operation.undoneAt === 'string', `操作历史 ${operation.id} undoneAt 无效`, errors);
}

export function validateState(state) {
  const errors = [];
  assert(isPlainObject(state), '状态必须是对象', errors);
  assert(state.schemaVersion === SCHEMA_VERSION, `schemaVersion 必须是 ${SCHEMA_VERSION}`, errors);
  assert(isPlainObject(state.meta), 'meta 必须是对象', errors);
  assert(isPlainObject(state.player), 'player 必须是对象', errors);
  assert(typeof state.player.name === 'string', 'player.name 必须是字符串', errors);
  assert(typeof state.player.currentClub === 'string', 'player.currentClub 必须是字符串', errors);
  assert(typeof state.player.currentTeam === 'string', 'player.currentTeam 必须是字符串', errors);
  assert(typeof state.player.primaryPosition === 'string', 'player.primaryPosition 必须是字符串', errors);
  assert(Array.isArray(state.player.secondaryPositions), 'player.secondaryPositions 必须是数组', errors);
  assert(CAREER_STAGE_VALUES.includes(state.player.careerStage), 'player.careerStage 无效', errors);
  assert(SQUAD_ROLE_VALUES.includes(state.player.squadRole), 'player.squadRole 无效', errors);
  assert(Array.isArray(state.seasons), 'seasons 必须是数组', errors);
  assert(Array.isArray(state.matches), 'matches 必须是数组', errors);
  assert(Array.isArray(state.contracts), 'contracts 必须是数组', errors);
  assert(isPlainObject(state.finance), 'finance 必须是对象', errors);
  assert(Array.isArray(state.finance?.openingBalances), 'finance.openingBalances 必须是数组', errors);
  assert(Array.isArray(state.finance?.transactions), 'finance.transactions 必须是数组', errors);
  assert(isPlainObject(state.abilities), 'abilities 必须是对象', errors);
  assert(Array.isArray(state.abilities?.history), 'abilities.history 必须是数组', errors);
  assert(Array.isArray(state.miscellaneous), 'miscellaneous 必须是数组', errors);
  assert(Array.isArray(state.drafts), 'drafts 必须是数组', errors);
  assert(Array.isArray(state.operationHistory), 'operationHistory 必须是数组', errors);

  if (errors.length) throw new Error(errors.join('; '));

  validateUniqueIds(state.seasons, '赛季', errors);
  validateUniqueIds(state.matches, '比赛', errors);
  validateUniqueIds(state.contracts, '合同', errors);
  validateUniqueIds(state.finance.transactions, '财务流水', errors);
  validateUniqueIds(state.abilities.history, '能力历史', errors);
  validateUniqueIds(state.miscellaneous, '杂项', errors);
  validateUniqueIds(state.drafts, '草稿', errors);
  validateUniqueIds(state.operationHistory, '操作历史', errors);

  state.seasons.forEach((season) => validateSeason(season, errors));
  const activeSeasons = state.seasons.filter((season) => season.status === 'active');
  assert(activeSeasons.length <= 1, '同一时间最多只能有一个活动赛季', errors);

  const seasonIds = new Set(state.seasons.map((season) => season.id));
  state.matches.forEach((match) => validateMatch(match, seasonIds, errors));

  state.contracts.forEach((contract) => validateContract(contract, errors));
  const activeContracts = state.contracts.filter((contract) => contract.active);
  assert(activeContracts.length <= 1, '同一时间最多只能有一个活动合同', errors);

  state.finance.openingBalances.forEach((balance) => validateOpeningBalance(balance, errors));
  const contractIds = new Set(state.contracts.map((contract) => contract.id));
  state.finance.transactions.forEach((transaction) => validateTransaction(transaction, contractIds, errors));
  validateAbilities(state.abilities, errors);
  state.miscellaneous.forEach((item) => validateMisc(item, errors));
  state.drafts.forEach((draft) => validateDraft(draft, errors));
  state.operationHistory.forEach((operation) => validateOperation(operation, errors));

  try {
    JSON.stringify(state);
  } catch {
    errors.push('状态必须可以 JSON 序列化');
  }

  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  return true;
}
