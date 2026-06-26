import { migrateState } from './schema.js';
import { validateState } from './validation.js';

export function parseImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error.message}`);
  }
  const state = migrateState(parsed);
  validateState(state);
  return state;
}

export function buildImportSummary(state) {
  return {
    schemaVersion: state.schemaVersion,
    playerName: state.player.name || '未命名',
    seasons: state.seasons.length,
    matches: state.matches.length,
    contracts: state.contracts.length,
    transactions: state.finance.transactions.length,
    abilityHistory: state.abilities.history.length,
    miscellaneous: state.miscellaneous.length,
    drafts: state.drafts.length,
    operationHistory: state.operationHistory.length,
  };
}

export function exportStateJson(state) {
  validateState(state);
  return JSON.stringify(state, null, 2);
}

export function createExampleState() {
  const state = migrateState({
    schemaVersion: 2,
    meta: {
      createdAt: '1998-07-01T00:00:00.000Z',
      updatedAt: '1998-09-01T00:00:00.000Z',
    },
    player: {
      name: '未命名',
      currentClub: '拜仁慕尼黑青年队',
      currentTeam: '拜仁慕尼黑青年队',
      primaryPosition: '中前卫',
      secondaryPositions: [],
      careerStage: 'youth',
      squadRole: 'starter',
      currentSeasonId: '1998-99',
      defaultCurrency: 'DEM',
    },
    seasons: [{
      id: '1998-99',
      label: '1998/99',
      club: '拜仁慕尼黑青年队',
      startedAt: '1998-07-01',
      endedAt: null,
      status: 'active',
      notes: '',
    }],
    matches: [{
      id: 'example-match-1',
      seasonId: '1998-99',
      date: '1998-08-15',
      competition: '青年联赛',
      club: '拜仁慕尼黑青年队',
      opponent: '斯图加特青年队',
      homeAway: 'home',
      goalsFor: 2,
      goalsAgainst: 1,
      started: true,
      minutes: 88,
      goals: 0,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
      rating: 7.4,
      notable: true,
      notes: '',
    }],
    contracts: [{
      id: 'example-contract-1',
      club: '拜仁慕尼黑',
      contractType: 'youth',
      startDate: '1998-07-01',
      endDate: '2000-06-30',
      wageAmountMinor: 15000,
      wageCurrency: 'DEM',
      wagePeriod: 'weekly',
      bonuses: '',
      clauses: '',
      active: true,
      notes: '',
    }],
    finance: {
      openingBalances: [{ currency: 'DEM', amountMinor: 13000 }],
      transactions: [{
        id: 'example-transaction-1',
        date: '1998-08-21',
        type: 'income',
        category: 'salary',
        amountMinor: 15000,
        currency: 'DEM',
        description: '青训周薪',
        relatedContractId: 'example-contract-1',
        notes: '',
      }],
    },
    abilities: {
      current: {
        pace: 61,
        shooting: 52,
        passing: 67,
        control: 65,
        defending: 56,
        physical: 58,
        awareness: 63,
      },
      history: [{
        id: 'example-ability-1',
        date: '1998-09-01',
        ability: 'passing',
        before: 66,
        after: 67,
        reason: '月度训练评估',
        notes: '',
      }],
    },
    miscellaneous: [{
      id: 'example-misc-1',
      date: '1998-08-20',
      key: 'squad_role',
      value: '青年队主力',
      tags: ['职业阶段'],
      notes: '',
    }],
    drafts: [],
    operationHistory: [],
  });
  return state;
}
