export const EXTENSION_ID = 'football-career-ledger';
export const DISPLAY_NAME = '足球生涯账本';
export const SCHEMA_VERSION = 2;
export const API_VERSION = 2;
export const QUERY_LIMIT_MAX = 100;
export const DEFAULT_PROMPT_MAX_CHARS = 2000;
export const DEFAULT_RECENT_MATCH_LIMIT = 3;
export const OPERATION_HISTORY_LIMIT = 50;

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

export const HOME_AWAY_VALUES = ['home', 'away', 'neutral'];
export const TRANSACTION_TYPES = ['income', 'expense'];
export const SEASON_STATUS_VALUES = ['active', 'completed', 'planned'];
export const CONTRACT_TYPES = ['youth', 'professional', 'loan', 'amateur', 'other'];
export const WAGE_PERIODS = ['weekly', 'monthly', 'yearly', 'one_time'];
export const CAREER_STAGE_VALUES = [
  'academy',
  'youth',
  'first_team_fringe',
  'rotation',
  'regular_starter',
  'core_player',
  'late_career',
  'retired',
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
  academy: '青训梯队',
  youth: '青年队',
  first_team_fringe: '一线队边缘',
  rotation: '轮换阶段',
  regular_starter: '稳定首发',
  core_player: '核心球员',
  late_career: '生涯后期',
  retired: '已退役',
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
export const DRAFT_TYPES = ['match', 'contract', 'transaction', 'ability_change', 'miscellaneous'];
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
