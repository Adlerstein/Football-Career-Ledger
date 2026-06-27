export const EXTENSION_ID = 'football-career-ledger';
export const DISPLAY_NAME = '足球生涯账本';
export const SCHEMA_VERSION = 2;
export const API_VERSION = 2;
export const QUERY_LIMIT_MAX = 100;
export const DEFAULT_PROMPT_MAX_CHARS = 2000;
export const DEFAULT_RECENT_MATCH_LIMIT = 3;
export const OPERATION_HISTORY_LIMIT = 50;
export const LEDGER_START_DATE = '1998-01-01';
export const DEFAULT_SEASON_START_DATE = '1998-07-01';
export const SEASON_TEMPLATE_START_YEAR = 1998;
export const SEASON_TEMPLATE_END_YEAR = 2040;

export const ABILITY_KEYS = [
  'pace',
  'shooting',
  'passing',
  'control',
  'defending',
  'physical',
  'awareness',
];

// Season tallies the user may manually override (e.g. when not entering matches
// one by one). Each is null = use the value aggregated from matches.
export const MANUAL_TOTAL_KEYS = [
  'appearances',
  'starts',
  'minutes',
  'goals',
  'assists',
];

export const MANUAL_TOTAL_LABELS = {
  appearances: '出场',
  starts: '首发',
  minutes: '分钟',
  goals: '进球',
  assists: '助攻',
};

export const ABILITY_LABELS = {
  pace: '速度',
  shooting: '射门',
  passing: '传球',
  control: '控球',
  defending: '防守',
  physical: '身体',
  awareness: '意识',
};

export const FINANCE_CATEGORIES = [
  'salary',
  'bonus',
  'signing_bonus',
  'sponsorship',
  'purchase',
  'housing',
  'transport',
  'food',
  'medical',
  'tax',
  'agent_fee',
  'other',
];

export const CURRENCY_VALUES = [
  'DEM',
  'EUR',
  'USD',
  'GBP',
  'FRF',
  'ITL',
  'ESP',
  'NLG',
  'BEF',
  'CHF',
  'CNY',
  'JPY',
];

export const CURRENCY_LABELS = {
  DEM: 'DEM（德国马克）',
  EUR: 'EUR（欧元）',
  USD: 'USD（美元）',
  GBP: 'GBP（英镑）',
  FRF: 'FRF（法国法郎）',
  ITL: 'ITL（意大利里拉）',
  ESP: 'ESP（西班牙比塞塔）',
  NLG: 'NLG（荷兰盾）',
  BEF: 'BEF（比利时法郎）',
  CHF: 'CHF（瑞士法郎）',
  CNY: 'CNY（人民币）',
  JPY: 'JPY（日元）',
};

export const HOME_AWAY_VALUES = ['home', 'away', 'neutral'];
export const TRANSACTION_TYPES = ['income', 'expense'];
export const SEASON_STATUS_VALUES = ['active', 'completed', 'planned'];
export const CONTRACT_TYPES = ['youth', 'professional', 'loan', 'amateur', 'other'];
export const WAGE_PERIODS = ['weekly', 'monthly', 'yearly', 'one_time'];
export const CAREER_STAGE_SELECT_VALUES = [
  'youth',
  'development',
  'mature',
  'prime',
  'late_career',
];
export const CAREER_STAGE_VALUES = [
  ...CAREER_STAGE_SELECT_VALUES,
  'academy',
  'reserve_team',
  'first_team',
  'loan',
  'retired',
  'first_team_fringe',
  'rotation',
  'regular_starter',
  'core_player',
];
export const SQUAD_ROLE_VALUES = [
  'prospect',
  'fringe',
  'substitute',
  'rotation',
  'starter',
  'important',
  'core',
  'captain',
];
export const CAREER_STAGE_LABELS = {
  youth: '青年期',
  development: '成长期',
  mature: '成熟期',
  prime: '巅峰期',
  late_career: '末期',
  academy: '旧：青训梯队',
  reserve_team: '旧：预备队/二队',
  first_team: '旧：一线队',
  loan: '旧：租借期',
  retired: '旧：已退役',
  first_team_fringe: '旧：一线队边缘',
  rotation: '旧：轮换阶段',
  regular_starter: '旧：稳定首发',
  core_player: '旧：核心球员',
};
export const SQUAD_ROLE_LABELS = {
  prospect: '潜力球员',
  fringe: '边缘球员',
  substitute: '替补',
  rotation: '轮换',
  starter: '首发',
  important: '重要球员',
  core: '核心',
  captain: '队长',
};
export const SOURCE_TYPES = ['manual', 'assistant_suggestion', 'import', 'migration', 'system'];
export const DRAFT_TYPES = ['match', 'contract', 'transaction', 'ability_change', 'miscellaneous', 'career_start'];
export const DRAFT_STATUS_VALUES = ['pending', 'confirmed', 'rejected', 'invalid'];
export const PROMPT_PRESETS = ['minimal', 'standard', 'full'];

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  promptInjectionEnabled: false,
  promptPreset: 'standard',
  promptMaxChars: DEFAULT_PROMPT_MAX_CHARS,
  recentMatchLimit: DEFAULT_RECENT_MATCH_LIMIT,
  includeContracts: true,
  includeFinance: true,
  includeAbilities: true,
  includeMiscellaneous: true,
  panelOpen: false,
});

export const PROMPT_KEY = `${EXTENSION_ID}:summary`;
