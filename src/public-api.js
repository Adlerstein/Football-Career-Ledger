import { API_VERSION } from './constants.js';
import { cloneJson } from './schema.js';
import { buildMemoryProjection, buildPromptSummary } from './prompt.js';
import {
  getAbilities,
  getAbilityHistory,
  getActiveContract,
  getContracts,
  getCurrentSeason,
  getFinanceSummary,
  getMiscellaneous,
  getSnapshot,
  queryMatches,
  queryTransactions,
  summarizeSeason,
} from './selectors.js';

export function createPublicApi(getState, promptDefaults = {}) {
  const withState = async (selector) => selector(await getState());
  return Object.freeze({
    apiVersion: API_VERSION,
    getSnapshot: () => withState((state) => getSnapshot(state)),
    getPlayer: () => withState((state) => cloneJson(state.player)),
    getCurrentSeason: () => withState((state) => {
      const season = getCurrentSeason(state);
      return season ? cloneJson(season) : null;
    }),
    getSeasonSummary: (seasonId) => withState((state) => summarizeSeason(state, seasonId)),
    queryMatches: (options = {}) => withState((state) => queryMatches(state, options)),
    getActiveContract: () => withState((state) => getActiveContract(state)),
    getContracts: (options = {}) => withState((state) => getContracts(state, options)),
    getFinanceSummary: () => withState((state) => getFinanceSummary(state)),
    queryTransactions: (options = {}) => withState((state) => queryTransactions(state, options)),
    getAbilities: () => withState((state) => getAbilities(state)),
    getAbilityHistory: (options = {}) => withState((state) => getAbilityHistory(state, options)),
    getMiscellaneous: (options = {}) => withState((state) => getMiscellaneous(state, options)),
    getPromptSummary: (options = {}) => withState((state) => buildPromptSummary(state, { ...promptDefaults, ...options })),
    getMemoryProjection: (options = {}) => withState((state) => cloneJson(buildMemoryProjection(state, options))),
  });
}

export async function runApiSelfCheck(context, api, getState) {
  const before = await getState();
  const snapshot = await api.getSnapshot();
  snapshot.player.name = '__mutated_by_self_check__';
  const after = await getState();
  const immutableReturn = after.player.name === before.player.name;

  const results = [
    { name: 'API已注册', ok: context.getExtensionApi?.('football-career-ledger') === api },
    { name: '读取快照', ok: Boolean(await api.getSnapshot()) },
    { name: '读取当前赛季汇总', ok: await api.getSeasonSummary() !== undefined },
    { name: '读取财务摘要', ok: Boolean(await api.getFinanceSummary()) },
    { name: '读取能力', ok: Boolean(await api.getAbilities()) },
    { name: '生成提示词摘要', ok: typeof await api.getPromptSummary() === 'string' },
    { name: '生成记忆图投影', ok: Boolean(await api.getMemoryProjection()) },
    { name: '返回值隔离', ok: immutableReturn },
  ];
  console.info('[football-career-ledger] api self check', results);
  return results;
}
