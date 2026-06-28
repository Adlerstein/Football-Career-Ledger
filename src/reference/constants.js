export const EXTENSION_ID = 'football-reference-scout';
export const DISPLAY_NAME = 'Football Reference Scout';
export const API_VERSION = 1;
export const DATASET_SCHEMA_VERSION = 1;
export const ORCHESTRATOR_TOOL_NAME = 'football_ref_build_turn_capsule';
export const PROMPT_KEY = `${EXTENSION_ID}:turn-reference`;

export const DEFAULT_QUERY_LIMIT = 5;
export const DEFAULT_NEARBY_LIMIT = 5;
export const DEFAULT_CAPSULE_MAX_CHARS = 3000;
export const MAX_QUERY_LIMIT = 10;
export const MAX_DETAIL_EVENTS = 30;
export const MAX_DETAIL_LINEUPS = 4;
export const DEFAULT_PROMPT_MAX_CHARS = 2000;
export const DEFAULT_NEARBY_DAYS = 0;

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  activeDatasetId: '',
  currentSeasonId: '',
  currentTeam: '',
  currentDate: '',
  nearbyDays: DEFAULT_NEARBY_DAYS,
  promptMaxChars: DEFAULT_PROMPT_MAX_CHARS,
  nextInjectionArmed: false,
  panelOpen: false,
});
