import { ABILITY_KEYS, ABILITY_LABELS, DEFAULT_PROMPT_MAX_CHARS, DEFAULT_RECENT_MATCH_LIMIT } from './constants.js';
import {
  getAbilities,
  getActiveContract,
  getCurrentSeason,
  getFinanceSummary,
  getMiscellaneous,
  queryMatches,
  summarizeSeason,
} from './selectors.js';

function trimToMax(text, maxChars) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return text.slice(0, Math.max(0, maxChars));
  return `${text.slice(0, maxChars - 1)}…`;
}

function formatMoney(amountMinor, currency) {
  return `${amountMinor} ${currency}`;
}

function formatMatch(match) {
  const score = `${match.goalsFor}比${match.goalsAgainst}`;
  const role = match.started ? '首发' : '替补';
  const parts = [`对${match.opponent || '未知对手'}${score}`, `${role}${match.minutes}分钟`];
  if (match.goals) parts.push(`${match.goals}球`);
  if (match.assists) parts.push(`${match.assists}次助攻`);
  return parts.join('，');
}

export function buildPromptSummary(state, options = {}) {
  const maxChars = Math.max(0, Math.floor(Number(options.maxChars ?? DEFAULT_PROMPT_MAX_CHARS)));
  if (maxChars === 0) return '';

  const recentMatchLimit = Math.max(0, Math.min(10, Math.floor(Number(options.recentMatchLimit ?? DEFAULT_RECENT_MATCH_LIMIT))));
  const includeContracts = options.includeContracts !== false;
  const includeFinance = options.includeFinance !== false;
  const includeAbilities = options.includeAbilities !== false;
  const includeMiscellaneous = options.includeMiscellaneous !== false;

  const currentSeason = getCurrentSeason(state);
  const summary = summarizeSeason(state, currentSeason?.id);
  const recentMatches = queryMatches(state, { seasonId: currentSeason?.id, limit: recentMatchLimit });
  const lines = [];

  lines.push('<football_career_ledger readonly="true">');
  lines.push('以下为插件提供的结构化账本摘要，只供叙事参考；不要原文输出，不要写入MVU变量。');
  lines.push(`球员：${state.player.name || '未命名'}；球队：${state.player.currentClub || currentSeason?.club || '未填写'}；位置：${state.player.primaryPosition || '未填写'}。`);

  if (currentSeason && summary) {
    lines.push(`当前赛季：${currentSeason.label || currentSeason.id}，${summary.appearances}次出场，${summary.starts}次首发，${summary.goals}球${summary.assists}助攻。`);
  }

  if (recentMatches.length) {
    lines.push(`最近比赛：${recentMatches.map(formatMatch).join('；')}。`);
  }

  if (includeContracts) {
    const contract = getActiveContract(state);
    if (contract) {
      lines.push(`合同：${contract.club} ${contract.contractType}合同，${contract.endDate || '未填写'}到期，${contract.wagePeriod}薪${formatMoney(contract.wageAmountMinor, contract.wageCurrency)}。`);
    }
  }

  if (includeFinance) {
    const finance = getFinanceSummary(state);
    if (finance.balances.length) {
      lines.push(`财务：${finance.balances.map((item) => `${item.currency}余额${item.amountMinor}`).join('；')}。`);
    }
  }

  if (includeAbilities) {
    const abilities = getAbilities(state);
    lines.push(`能力：${ABILITY_KEYS.map((key) => `${ABILITY_LABELS[key]}${abilities[key]}`).join('，')}。`);
  }

  if (includeMiscellaneous) {
    const misc = getMiscellaneous(state, { limit: 3 });
    if (misc.length) {
      lines.push(`杂项：${misc.map((item) => `${item.key}=${item.value}`).join('；')}。`);
    }
  }

  lines.push('</football_career_ledger>');
  return trimToMax(lines.join('\n'), maxChars);
}

export function buildMemoryProjection(state, options = {}) {
  const currentSeason = getCurrentSeason(state);
  const seasonSummary = summarizeSeason(state, currentSeason?.id);
  const activeContract = getActiveContract(state);
  const finance = getFinanceSummary(state);
  const notableMatchLimit = Math.max(0, Math.min(100, Math.floor(Number(options.notableMatchLimit ?? 10))));
  const notableMatches = queryMatches(state, { notableOnly: true, limit: notableMatchLimit });
  const abilityMilestoneLimit = Math.max(0, Math.min(100, Math.floor(Number(options.abilityMilestoneLimit ?? 10))));
  const financialMilestoneLimit = Math.max(0, Math.min(100, Math.floor(Number(options.financialMilestoneLimit ?? 10))));

  return {
    currentCareerState: `${state.player.name || '未命名'}，${state.player.currentClub || currentSeason?.club || '未填写球队'}，${state.player.primaryPosition || '未填写位置'}`,
    currentSeasonSummary: currentSeason && seasonSummary
      ? `${currentSeason.label || currentSeason.id}: ${seasonSummary.appearances}次出场，${seasonSummary.starts}次首发，${seasonSummary.goals}球${seasonSummary.assists}助攻`
      : '',
    notableMatches: notableMatches.map((match) => ({
      id: match.id,
      date: match.date,
      opponent: match.opponent,
      score: `${match.goalsFor}-${match.goalsAgainst}`,
      summary: formatMatch(match),
    })),
    contractMilestones: activeContract ? [{
      id: activeContract.id,
      club: activeContract.club,
      startDate: activeContract.startDate,
      endDate: activeContract.endDate,
      wageAmountMinor: activeContract.wageAmountMinor,
      wageCurrency: activeContract.wageCurrency,
    }] : [],
    abilityMilestones: state.abilities.history
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, abilityMilestoneLimit)
      .map((item) => ({
        id: item.id,
        date: item.date,
        ability: item.ability,
        before: item.before,
        after: item.after,
        reason: item.reason || '',
      })),
    financialMilestones: finance.balances
      .slice(0, financialMilestoneLimit)
      .map((item) => ({ currency: item.currency, balanceMinor: item.amountMinor })),
  };
}
