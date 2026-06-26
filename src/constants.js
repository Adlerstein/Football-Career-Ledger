export const EXTENSION_ID = 'football-career-ledger';
export const DISPLAY_NAME = '足球生涯账本';
export const SCHEMA_VERSION = 1;
export const API_VERSION = 1;
export const QUERY_LIMIT_MAX = 100;
export const DEFAULT_PROMPT_MAX_CHARS = 2000;
export const DEFAULT_RECENT_MATCH_LIMIT = 3;

export const ABILITY_KEYS = [
  'pace',
  'shooting',
  'passing',
  'control',
  'defending',
  'physical',
  'awareness',
];

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

export const HOME_AWAY_VALUES = ['home', 'away', 'neutral'];
export const TRANSACTION_TYPES = ['income', 'expense'];
export const SEASON_STATUS_VALUES = ['active', 'completed', 'planned'];
export const CONTRACT_TYPES = ['youth', 'professional', 'loan', 'amateur', 'other'];
export const WAGE_PERIODS = ['weekly', 'monthly', 'yearly', 'one_time'];

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  promptInjectionEnabled: false,
  promptMaxChars: DEFAULT_PROMPT_MAX_CHARS,
  recentMatchLimit: DEFAULT_RECENT_MATCH_LIMIT,
  includeContracts: true,
  includeFinance: true,
  includeAbilities: true,
  includeMiscellaneous: true,
});

export const PROMPT_KEY = `${EXTENSION_ID}:summary`;
