import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  CAREER_STAGE_LABELS,
  CAREER_STAGE_SELECT_VALUES,
  SQUAD_ROLE_LABELS,
  SQUAD_ROLE_VALUES,
} from '../../constants.js';
import { updatePlayerStatus } from '../../ledger-actions.js';
import {
  getAbilities,
  getActiveContract,
  getCurrentSeason,
  getFinanceSummary,
  getOperationHistory,
  getPendingDraftCount,
  queryMatches,
  summarizeSeason,
} from '../../selectors.js';
import { card, field, h, input, renderRecordForm, select } from '../dom.js';
import { currencyRows, enumRows, enumRowsWithCurrent, seasonRows, teamSelect } from '../fields.js';

function renderSummaryCards(state, actions) {
  const season = getCurrentSeason(state);
  const summary = summarizeSeason(state, season?.id);
  const contract = getActiveContract(state);
  const finance = getFinanceSummary(state);
  const abilities = getAbilities(state);
  const recent = queryMatches(state, { seasonId: season?.id, limit: 3, clone: false });
  const operations = getOperationHistory(state, { limit: 3, clone: false });
  const pendingDrafts = getPendingDraftCount(state);
  const grid = h('div', { class: 'fcl-summary-grid' });

  [
    ['球员', `${state.player.name || '未命名'} / ${state.player.primaryPosition || '未填写位置'}`],
    ['俱乐部与队伍', `${state.player.currentClub || '未填写'} / ${state.player.currentTeam || '未填写'}`],
    ['职业状态', `${CAREER_STAGE_LABELS[state.player.careerStage] || state.player.careerStage} / ${SQUAD_ROLE_LABELS[state.player.squadRole] || state.player.squadRole}`],
    ['当前赛季', season && summary ? `${season.label || season.id}：${summary.appearances}场 ${summary.goals}球 ${summary.assists}助` : '未设置'],
    ['当前合同', contract ? `${contract.club} ${contract.wageAmountMinor} ${contract.wageCurrency}/${contract.wagePeriod}` : '无'],
    ['余额', finance.balances.length ? finance.balances.map((row) => `${row.currency} ${row.amountMinor}`).join('；') : '无'],
    ['能力概况', ABILITY_KEYS.map((key) => `${ABILITY_LABELS[key]}${abilities[key]}`).join(' / ')],
    ['待确认草稿', `${pendingDrafts} 条`],
  ].forEach(([title, body]) => grid.append(card(title, body)));

  grid.append(card('最近比赛', recent.length
    ? h('ul', {}, recent.map((match) => h('li', { text: `${match.date} ${match.opponent} ${match.goalsFor}-${match.goalsAgainst}` })))
    : '暂无比赛'));
  grid.append(card('最近操作', operations.length
    ? h('ul', {}, operations.map((operation) => h('li', { text: `${operation.createdAt.slice(0, 10)} ${operation.type}${operation.undoneAt ? '（已撤销）' : ''}` })))
    : '暂无操作', [
    h('button', { type: 'button', class: 'menu_button', text: '撤销最近操作', onclick: actions.undo }),
  ]));
  return grid;
}

export function renderOverview(state, actions) {
  const currentSeason = getCurrentSeason(state);
  return h('div', {}, [
    renderSummaryCards(state, actions),
    renderRecordForm('基础资料', [
      field('球员姓名', input('name', state.player.name)),
      field('当前俱乐部', input('currentClub', state.player.currentClub)),
      field('当前队伍', teamSelect('currentTeam', state, state.player.currentTeam)),
      field('主要位置', input('primaryPosition', state.player.primaryPosition)),
      field('副位置（用逗号隔开）', input('secondaryPositions', state.player.secondaryPositions.join(', '))),
      field('职业阶段', select('careerStage', state.player.careerStage, enumRowsWithCurrent(CAREER_STAGE_SELECT_VALUES, CAREER_STAGE_LABELS, state.player.careerStage))),
      field('队内角色', select('squadRole', state.player.squadRole, enumRows(SQUAD_ROLE_VALUES, SQUAD_ROLE_LABELS))),
      field('默认币种', select('defaultCurrency', state.player.defaultCurrency || 'DEM', currencyRows(state))),
      field('当前赛季', select('currentSeasonId', state.player.currentSeasonId || currentSeason?.id || '', seasonRows(state, '未设置'))),
    ], '保存基础资料', async (data) => {
      await actions.save((draft) => updatePlayerStatus(draft, {
        name: String(data.name || ''),
        currentClub: String(data.currentClub || ''),
        currentTeam: String(data.currentTeam || ''),
        primaryPosition: String(data.primaryPosition || ''),
        secondaryPositions: String(data.secondaryPositions || '').split(',').map((item) => item.trim()).filter(Boolean),
        careerStage: String(data.careerStage || 'youth'),
        squadRole: String(data.squadRole || 'rotation'),
        defaultCurrency: String(data.defaultCurrency || 'DEM').trim() || 'DEM',
        currentSeasonId: String(data.currentSeasonId || ''),
      }));
    }),
  ]);
}
