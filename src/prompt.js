import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  CAREER_STAGE_LABELS,
  DEFAULT_PROMPT_MAX_CHARS,
  DEFAULT_RECENT_MATCH_LIMIT,
  PROMPT_PRESETS,
  SQUAD_ROLE_LABELS,
} from './constants.js';
import { formatSeasonTotals } from './formatters.js';
import {
  getAbilities,
  getActiveContract,
  getCurrentSeason,
  getFinanceSummary,
  getMiscellaneous,
  getPendingDraftCount,
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
  const score = `${match.goalsFor}-${match.goalsAgainst}`;
  const role = match.started ? '首发' : '替补';
  const parts = [`${match.date || '未填写日期'} ${match.competition || '未填写赛事'}`, `对${match.opponent || '未知对手'} ${score}`, `${role}${match.minutes}分钟`];
  if (match.goals) parts.push(`${match.goals}球`);
  if (match.assists) parts.push(`${match.assists}次助攻`);
  return parts.join('，');
}

function formatAbilitySummary(abilities) {
  const rows = ABILITY_KEYS.map((key) => ({ key, value: abilities[key] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const top = rows.slice(0, 2).map((row) => `${ABILITY_LABELS[row.key]}${row.value}`).join('、');
  const weak = rows.slice(-2).map((row) => `${ABILITY_LABELS[row.key]}${row.value}`).join('、');
  return `能力：优势 ${top || '无'}；短板 ${weak || '无'}`;
}

function formatList(values) {
  return values?.length ? values.join('、') : '无';
}

function formatTableCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim() || '无';
}

function latestClosedSeason(state) {
  return state.seasons
    .filter((season) => season.status === 'completed' && season.closedSummary)
    .slice()
    .sort((a, b) => String(b.endedAt || b.startedAt || '').localeCompare(String(a.endedAt || a.startedAt || '')))
    [0] || null;
}

function pushSection(lines, title, rows) {
  const filtered = rows.filter(Boolean);
  if (!filtered.length) return;
  lines.push(`[${title}]`);
  filtered.forEach((row) => lines.push(`- ${row}`));
}

function historicalSeasonTable(state, limit = 8) {
  const seasons = state.seasons
    .filter((season) => season.status === 'completed')
    .slice()
    .sort((a, b) => String(b.startedAt || b.id || '').localeCompare(String(a.startedAt || a.id || '')))
    .slice(0, limit);
  if (!seasons.length) return [];

  const rows = [
    '[历史赛季]',
    '| 赛季 | 球队 | 出场 | 首发 | 进球 | 助攻 | 球队成绩 | 荣誉 |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const season of seasons) {
    const summary = summarizeSeason(state, season.id);
    const closure = season.closedSummary || {};
    const totals = closure.calculatedTotals || summary || {};
    const honors = [
      ...(Array.isArray(closure.teamHonors) ? closure.teamHonors : []),
      ...(Array.isArray(closure.individualHonors) ? closure.individualHonors : []),
    ];
    rows.push(`| ${formatTableCell(season.label || season.id)} | ${formatTableCell(season.club)} | ${totals.appearances ?? 0} | ${totals.starts ?? 0} | ${totals.goals ?? 0} | ${totals.assists ?? 0} | ${formatTableCell(closure.finalStanding || season.status)} | ${formatTableCell(formatList(honors))} |`);
  }
  return rows;
}

export function buildPromptSummary(state, options = {}) {
  const maxChars = Math.max(0, Math.floor(Number(options.maxChars ?? DEFAULT_PROMPT_MAX_CHARS)));
  if (maxChars === 0) return '';

  const recentMatchLimit = Math.max(0, Math.min(10, Math.floor(Number(options.recentMatchLimit ?? DEFAULT_RECENT_MATCH_LIMIT))));
  const preset = PROMPT_PRESETS.includes(options.preset || options.promptPreset) ? (options.preset || options.promptPreset) : 'standard';
  const includeContracts = preset !== 'minimal' && options.includeContracts !== false;
  const includeFinance = preset === 'full' && options.includeFinance !== false;
  const includeAbilities = preset !== 'minimal' && options.includeAbilities !== false;
  const includeFullAbilities = preset === 'full';
  const includeMiscellaneous = preset === 'full' && options.includeMiscellaneous !== false;

  const currentSeason = getCurrentSeason(state);
  const summary = summarizeSeason(state, currentSeason?.id);
  const recentMatches = queryMatches(state, { seasonId: currentSeason?.id, limit: recentMatchLimit });
  const closedSeason = latestClosedSeason(state);
  const closedSummary = closedSeason?.closedSummary || null;
  const closedTotals = closedSummary?.calculatedTotals || null;
  const lines = [];

  lines.push('<football_career_ledger readonly="true">');
  lines.push('以下为插件提供的结构化账本摘要，只供叙事参考；不要原文输出，不要写入MVU，不要自行修改这些数值。');
  pushSection(lines, '球员', [
    `姓名：${state.player.name || '未命名'}`,
    `俱乐部：${state.player.currentClub || currentSeason?.club || '未填写'}`,
    `队伍：${state.player.currentTeam || state.player.currentClub || currentSeason?.club || '未填写'}`,
    `位置：${state.player.primaryPosition || '未填写'}${state.player.secondaryPositions.length ? `；副位置：${state.player.secondaryPositions.join('、')}` : ''}`,
    `职业阶段：${CAREER_STAGE_LABELS[state.player.careerStage] || state.player.careerStage}`,
    `队内角色：${SQUAD_ROLE_LABELS[state.player.squadRole] || state.player.squadRole}`,
  ]);

  if (currentSeason && summary) {
    pushSection(lines, '当前赛季', [
      `${currentSeason.label || currentSeason.id}；状态：${currentSeason.status}；球队：${currentSeason.club || '未填写'}`,
      `时间：${currentSeason.startedAt || '未填写'} 至 ${currentSeason.endedAt || '进行中'}`,
      `累计：${formatSeasonTotals(summary)}`,
    ]);
  }

  if (closedSeason && closedSummary) {
    pushSection(lines, '最近结束赛季', [
      `${closedSeason.label || closedSeason.id}；球队：${closedSeason.club || '未填写'}；结束日期：${closedSeason.endedAt || '未填写'}`,
      closedTotals ? `最终统计：${formatSeasonTotals(closedTotals)}` : '',
      `球队赛季成绩：${closedSummary.finalStanding || '未填写'}`,
      `赛季末队内角色：${SQUAD_ROLE_LABELS[closedSummary.roleAtEnd] || closedSummary.roleAtEnd || '未填写'}`,
      `赛季总结：${closedSummary.narrativeSummary || '未填写'}`,
      `团队荣誉：${formatList(closedSummary.teamHonors)}`,
      `个人荣誉：${formatList(closedSummary.individualHonors)}`,
    ]);
  }

  lines.push(...historicalSeasonTable(state, 8));

  if (recentMatches.length) {
    pushSection(lines, '最近比赛', recentMatches.map(formatMatch));
  }

  if (includeContracts) {
    const contract = getActiveContract(state);
    if (contract) {
      pushSection(lines, '合同', [
        `${contract.club}；${contract.contractType}合同；${contract.startDate || '未填写'} 至 ${contract.endDate || '未填写'}`,
        `${contract.wagePeriod}薪 ${formatMoney(contract.wageAmountMinor, contract.wageCurrency)}`,
      ]);
    }
  }

  if (includeFinance) {
    const finance = getFinanceSummary(state);
    if (finance.balances.length) {
      pushSection(lines, '财务', finance.balances.map((item) => `${item.currency} 余额 ${item.amountMinor}`));
    }
  }

  if (includeAbilities) {
    const abilities = getAbilities(state);
    pushSection(lines, '能力', [
      includeFullAbilities
        ? ABILITY_KEYS.map((key) => `${ABILITY_LABELS[key]}${abilities[key]}`).join('，')
        : formatAbilitySummary(abilities),
    ]);
  }

  if (includeMiscellaneous) {
    const misc = getMiscellaneous(state, { limit: 3 });
    if (misc.length) {
      pushSection(lines, '杂项', misc.map((item) => `${item.date || '未填写日期'} ${item.key}=${item.value}`));
    }
  }

  const pendingDrafts = getPendingDraftCount(state);
  if (pendingDrafts) {
    pushSection(lines, '草稿', [`当前有 ${pendingDrafts} 条待确认账本草稿，尚未写入正式数据`]);
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
      ? `${currentSeason.label || currentSeason.id}: ${formatSeasonTotals(seasonSummary)}`
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
