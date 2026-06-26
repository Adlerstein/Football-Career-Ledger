import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  CAREER_STAGE_LABELS,
  CAREER_STAGE_SELECT_VALUES,
  CONTRACT_TYPES,
  CURRENCY_LABELS,
  CURRENCY_VALUES,
  DRAFT_STATUS_VALUES,
  DRAFT_TYPES,
  FINANCE_CATEGORIES,
  HOME_AWAY_VALUES,
  DEFAULT_SEASON_START_DATE,
  LEDGER_START_DATE,
  PROMPT_PRESETS,
  SQUAD_ROLE_LABELS,
  SQUAD_ROLE_VALUES,
  TRANSACTION_TYPES,
  WAGE_PERIODS,
} from './constants.js';
import { createExampleState, exportStateJson, parseImportJson, buildImportSummary } from './import-export.js';
import {
  addContract,
  addMatch,
  addMiscellaneous,
  addSeason,
  addTransaction,
  applyAbilityChange,
  closeSeason,
  confirmDraft,
  createNextSeason,
  deleteAbilityHistory,
  deleteContract,
  deleteSeason,
  deleteDraft,
  deleteMatch,
  deleteMiscellaneous,
  deleteOpeningBalance,
  deleteTransaction,
  rejectDraft,
  setActiveContract,
  setInitialAbilities,
  setOpeningBalance,
  undoLastOperation,
  updateContract,
  updateAbilityHistory,
  updateDraft,
  updateMatch,
  updateMiscellaneous,
  updatePlayerStatus,
  updateSeason,
  updateTransaction,
} from './ledger-actions.js';
import { buildModelSuggestionInstructions } from './suggestions.js';
import { buildPromptSummary } from './prompt.js';
import { getNextSeasonTemplate, getSeasonTemplateRows, parseSeasonInput } from './season-utils.js';
import { readLedgerState, replaceLedgerState, clearLedgerState, writeLedgerState } from './storage.js';
import {
  getAbilities,
  getActiveContract,
  getCurrentSeason,
  getDrafts,
  getFinanceSummary,
  getMiscellaneous,
  getOperationHistory,
  getPendingDraftCount,
  queryMatches,
  queryTransactions,
  summarizeSeason,
} from './selectors.js';

const tabDefs = [
  ['overview', '概览'],
  ['drafts', '草稿'],
  ['matches', '比赛'],
  ['seasons', '赛季'],
  ['contracts', '合同'],
  ['finance', '财务'],
  ['abilities', '能力'],
  ['misc', '杂项'],
  ['data', '数据管理'],
];

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'type') el.type = value;
    else if (key === 'value') el.value = value ?? '';
    else if (key === 'checked') el.checked = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) el.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

function field(label, input) {
  return h('label', { class: 'fcl-field' }, [h('span', { text: label }), input]);
}

function input(name, value = '', attrs = {}) {
  return h('input', { name, value, ...attrs });
}

function textarea(name, value = '', attrs = {}) {
  return h('textarea', { name, ...attrs }, value ?? '');
}

function select(name, value, options) {
  const el = h('select', { name });
  for (const option of options) {
    const opt = h('option', { value: option.value ?? option, text: option.label ?? option });
    opt.selected = String(option.value ?? option) === String(value ?? '');
    el.append(opt);
  }
  return el;
}

function optionRows(rows, emptyLabel = '未选择') {
  return [{ value: '', label: emptyLabel }, ...rows.map((row) => ({ value: row.id, label: row.label || row.id }))];
}

function enumRows(values, labels = {}) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

function enumRowsWithCurrent(values, labels, current) {
  const rows = enumRows(values, labels);
  if (current && !values.includes(current)) {
    rows.push({ value: current, label: labels[current] || current });
  }
  return rows;
}

function currencyRows(state) {
  const values = new Set([
    state.player.defaultCurrency || 'DEM',
    ...CURRENCY_VALUES,
    ...state.finance.openingBalances.map((row) => row.currency),
    ...state.finance.transactions.map((row) => row.currency),
    ...state.contracts.map((contract) => contract.wageCurrency),
  ].filter(Boolean));
  return Array.from(values).map((value) => ({ value, label: CURRENCY_LABELS[value] || value }));
}

function seasonRows(state, emptyLabel = '请先创建赛季') {
  return optionRows(
    state.seasons.map((season) => ({
      id: season.id,
      label: `${season.label || season.id}（${season.id}）`,
    })),
    emptyLabel,
  );
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value) {
  return value === 'on' || value === 'true' || value === true;
}

function currentLedgerDate(state) {
  return getCurrentSeason(state)?.startedAt || state.seasons[0]?.startedAt || LEDGER_START_DATE;
}

function dateInput(name, value = LEDGER_START_DATE, attrs = {}) {
  const resolved = value === undefined || value === null ? LEDGER_START_DATE : value;
  return input(name, resolved, { type: 'date', min: LEDGER_START_DATE, ...attrs });
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function teamCandidates(state) {
  const names = uniqueStrings([
    state.player.currentTeam,
    state.player.currentClub,
    ...state.seasons.map((season) => season.club),
    ...state.contracts.map((contract) => contract.club),
    ...state.matches.map((match) => match.club),
  ]);
  const suggestions = [];
  for (const name of names) {
    suggestions.push(name);
    if (!/(一线队|青年队|预备队|二队|U\d+|租借)/.test(name)) {
      suggestions.push(`${name}一线队`, `${name}二队`, `${name}青年队`);
    }
  }
  return uniqueStrings([...suggestions, '一线队', '二队', '预备队', '青年队']);
}

function teamPicker(name, state, value = '') {
  const target = input(name, value);
  const buttons = teamCandidates(state).slice(0, 12).map((team) => h('button', {
    type: 'button',
    class: 'menu_button fcl-small',
    text: team,
    onclick: () => { target.value = team; },
  }));
  return h('div', { class: 'fcl-combo' }, [
    target,
    h('details', { class: 'fcl-choice-drawer' }, [
      h('summary', { text: '选择常用队伍' }),
      h('div', { class: 'fcl-choice-grid' }, buttons),
    ]),
  ]);
}

function seasonDefaultEndDate(season) {
  return season?.endedAt || parseSeasonInput(season?.id).endedAt || '';
}

function seasonTemplateSelect(value = '1998-99') {
  return select('seasonTemplate', value, getSeasonTemplateRows());
}

function setStatus(root, message, kind = 'info') {
  const status = root.querySelector('[data-fcl-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

async function submitWithStatus(root, message, action) {
  try {
    await action();
    setStatus(root, message, 'success');
  } catch (error) {
    console.error('[football-career-ledger]', error);
    setStatus(root, error.message || String(error), 'error');
  }
}

function parseJsonField(value) {
  if (!String(value || '').trim()) return {};
  return JSON.parse(value);
}

function actionbar(buttons) {
  return h('div', { class: 'fcl-actionbar' }, buttons);
}

function card(title, body, actions = []) {
  return h('section', { class: 'fcl-card' }, [
    h('h4', { text: title }),
    typeof body === 'string' ? h('p', { text: body }) : body,
    actions.length ? actionbar(actions) : null,
  ]);
}

function renderRecordForm(title, fields, submitLabel, onSubmit) {
  const form = h('form', { class: 'fcl-form' }, [
    ...fields,
    h('button', { type: 'submit', class: 'menu_button', text: submitLabel }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit(formDataObject(form), form);
  });
  return h('section', { class: 'fcl-editor' }, [h('h3', { text: title }), form]);
}

function renderSummaryCards(state, actions) {
  const season = getCurrentSeason(state);
  const summary = summarizeSeason(state, season?.id);
  const contract = getActiveContract(state);
  const finance = getFinanceSummary(state);
  const abilities = getAbilities(state);
  const recent = queryMatches(state, { seasonId: season?.id, limit: 3 });
  const operations = getOperationHistory(state, { limit: 3 });
  const pendingDrafts = getPendingDraftCount(state);
  const grid = h('div', { class: 'fcl-summary-grid' });

  [
    ['球员', `${state.player.name || '未命名'} / ${state.player.primaryPosition || '未填写位置'}`],
    ['俱乐部与队伍', `${state.player.currentClub || '未填写'} / ${state.player.currentTeam || '未填写'}`],
    ['职业状态', `${CAREER_STAGE_LABELS[state.player.careerStage] || state.player.careerStage} / ${SQUAD_ROLE_LABELS[state.player.squadRole] || state.player.squadRole}`],
    ['当前赛季', season && summary ? `${season.label || season.id}：${summary.appearances}场 ${summary.goals}球 ${summary.assists}助` : '未设置'],
    ['活动合同', contract ? `${contract.club} ${contract.wageAmountMinor} ${contract.wageCurrency}/${contract.wagePeriod}` : '无'],
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

function renderOverview(state, actions) {
  const currentSeason = getCurrentSeason(state);
  return h('div', {}, [
    renderSummaryCards(state, actions),
    renderRecordForm('基础资料', [
      field('球员姓名', input('name', state.player.name)),
      field('当前俱乐部', input('currentClub', state.player.currentClub)),
      field('当前队伍', teamPicker('currentTeam', state, state.player.currentTeam)),
      field('主要位置', input('primaryPosition', state.player.primaryPosition)),
      field('副位置（逗号分隔）', input('secondaryPositions', state.player.secondaryPositions.join(', '))),
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

function matchFields(state, match = {}) {
  const currentSeason = getCurrentSeason(state);
  return [
    field('赛季', select('seasonId', match.seasonId || currentSeason?.id || '', seasonRows(state, '请先创建赛季'))),
    field('日期', dateInput('date', match.date || currentLedgerDate(state))),
    field('赛事', input('competition', match.competition || '')),
    field('球队', input('club', match.club || state.player.currentTeam || state.player.currentClub || currentSeason?.club || '')),
    field('对手', input('opponent', match.opponent || '')),
    field('主客场', select('homeAway', match.homeAway || 'home', HOME_AWAY_VALUES)),
    field('进球', input('goalsFor', match.goalsFor ?? 0, { type: 'number', min: '0' })),
    field('失球', input('goalsAgainst', match.goalsAgainst ?? 0, { type: 'number', min: '0' })),
    field('首发', h('input', { name: 'started', type: 'checkbox', checked: match.started })),
    field('分钟', input('minutes', match.minutes ?? 0, { type: 'number', min: '0', max: '130' })),
    field('个人进球', input('goals', match.goals ?? 0, { type: 'number', min: '0' })),
    field('助攻', input('assists', match.assists ?? 0, { type: 'number', min: '0' })),
    field('黄牌', input('yellowCards', match.yellowCards ?? 0, { type: 'number', min: '0' })),
    field('红牌', input('redCards', match.redCards ?? 0, { type: 'number', min: '0' })),
    field('评分', input('rating', match.rating ?? '', { type: 'number', min: '0', max: '10', step: '0.1' })),
    field('重要比赛', h('input', { name: 'notable', type: 'checkbox', checked: match.notable })),
    field('备注', textarea('notes', match.notes || '')),
  ];
}

function matchPayload(data) {
  return {
    seasonId: String(data.seasonId || ''),
    date: String(data.date || ''),
    competition: String(data.competition || ''),
    club: String(data.club || ''),
    opponent: String(data.opponent || ''),
    homeAway: String(data.homeAway || 'home'),
    goalsFor: numberValue(data.goalsFor),
    goalsAgainst: numberValue(data.goalsAgainst),
    started: boolValue(data.started),
    minutes: numberValue(data.minutes),
    goals: numberValue(data.goals),
    assists: numberValue(data.assists),
    yellowCards: numberValue(data.yellowCards),
    redCards: numberValue(data.redCards),
    rating: data.rating === '' ? null : numberValue(data.rating),
    notable: boolValue(data.notable),
    notes: String(data.notes || ''),
  };
}

function renderMatches(state, actions) {
  const list = queryMatches(state, { limit: actions.matchLimit || 50 });
  const editor = actions.editing?.type === 'match'
    ? state.matches.find((match) => match.id === actions.editing.id)
    : null;
  const rows = list.map((match) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${match.date} ${match.competition || ''} ${match.opponent} ${match.goalsFor}-${match.goalsAgainst}，${match.minutes}分钟 ${match.goals}球${match.assists}助` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('match', match.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这场比赛？') && actions.save((draft) => deleteMatch(draft, match.id)) }),
  ]));
  return h('div', {}, [
    state.seasons.length ? null : h('p', { class: 'fcl-muted', text: '新增比赛前需要先在“基础资料”或“赛季”页创建一个赛季。推荐模板：1998/99 会保存为赛季ID 1998-99。' }),
    editor ? renderRecordForm('编辑比赛', matchFields(state, editor), '保存比赛', async (data) => {
      await actions.save((draft) => updateMatch(draft, editor.id, matchPayload(data)));
      actions.clearEditing();
    }) : renderRecordForm('新增比赛', matchFields(state), '新增比赛', async (data, form) => {
      await actions.save((draft) => addMatch(draft, matchPayload(data)));
      form.reset();
    }),
    h('h3', { text: '比赛列表' }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function seasonFields(state, season = {}, mode = 'edit') {
  const parsedSeason = parseSeasonInput(season.id);
  const template = select('seasonTemplate', parsedSeason.id || '1998-99', getSeasonTemplateRows());
  template.addEventListener('change', (event) => {
    const parsed = parseSeasonInput(event.target.value);
    const form = event.target.closest('form');
    if (!form || !parsed.id) return;
    const id = form.querySelector('[name="id"]');
    const label = form.querySelector('[name="label"]');
    const startedAt = form.querySelector('[name="startedAt"]');
    const endedAt = form.querySelector('[name="endedAt"]');
    if (id) id.value = parsed.id;
    if (label) label.value = parsed.label;
    if (startedAt) startedAt.value = parsed.startedAt;
    if (endedAt && !endedAt.value) endedAt.value = parsed.endedAt;
  });
  const common = [
    field('赛季模板', template),
    field('俱乐部/队伍', teamPicker('club', state, season.club || state.player.currentTeam || state.player.currentClub)),
    field('开始日期', dateInput('startedAt', season.startedAt || parsedSeason.startedAt || DEFAULT_SEASON_START_DATE)),
    field('备注', textarea('notes', season.notes || '')),
  ];
  if (mode !== 'edit') return common;
  return [
    field('赛季模板', template),
    field('赛季ID', input('id', season.id || state.player.currentSeasonId || '1998-99')),
    field('标签', input('label', season.label || parsedSeason.label || '1998/99')),
    field('俱乐部/队伍', teamPicker('club', state, season.club || state.player.currentTeam || state.player.currentClub)),
    field('开始日期', dateInput('startedAt', season.startedAt || parsedSeason.startedAt || DEFAULT_SEASON_START_DATE)),
    field('结束日期', dateInput('endedAt', season.endedAt || '', { value: season.endedAt || '' })),
    field('状态', select('status', season.status || 'active', ['active', 'completed', 'planned'])),
    field('备注', textarea('notes', season.notes || '')),
  ];
}

function seasonPayload(data) {
  const parsed = parseSeasonInput(data.seasonTemplate || data.id);
  return {
    id: String(parsed.id || data.id || ''),
    label: String(data.label || parsed.label || data.id || ''),
    club: String(data.club || ''),
    startedAt: String(data.startedAt || parsed.startedAt || DEFAULT_SEASON_START_DATE),
    endedAt: data.endedAt ? String(data.endedAt) : null,
    status: String(data.status || 'planned'),
    notes: String(data.notes || ''),
  };
}

function renderSeasons(state, actions) {
  const currentSeason = getCurrentSeason(state);
  const activeSeason = state.seasons.find((season) => season.status === 'active') || null;
  const latestSeason = state.seasons.slice().sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0] || null;
  const nextTemplate = getNextSeasonTemplate(latestSeason);
  const editor = actions.editing?.type === 'season'
    ? state.seasons.find((season) => season.id === actions.editing.id)
    : null;
  const rows = state.seasons.map((season) => {
    const summary = summarizeSeason(state, season.id);
    return h('li', { class: 'fcl-list-row' }, [
      h('span', { text: `${season.label || season.id} ${season.status} ${summary?.appearances ?? 0}场 ${summary?.goals ?? 0}球 ${summary?.assists ?? 0}助` }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('season', season.id) }),
      season.status === 'active' ? h('button', { type: 'button', class: 'menu_button fcl-small', text: '结束', onclick: () => actions.setEditing('closeSeason', season.id) }) : null,
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该赛季？有比赛引用的赛季会被拒绝删除。') && actions.save((draft) => deleteSeason(draft, season.id)) }),
    ]);
  });
  const closeTarget = actions.editing?.type === 'closeSeason'
    ? state.seasons.find((season) => season.id === actions.editing.id)
    : null;
  const createInitialForm = !state.seasons.length ? renderRecordForm('创建开档赛季', seasonFields(state, {
    id: '1998-99',
    label: '1998/99',
    club: state.player.currentTeam || state.player.currentClub,
    startedAt: DEFAULT_SEASON_START_DATE,
    status: 'active',
  }, 'create'), '创建开档赛季', async (data, form) => {
    const parsed = parseSeasonInput(data.seasonTemplate);
    await actions.save((draft) => addSeason(draft, {
      id: parsed.id,
      label: parsed.label,
      club: data.club,
      startedAt: data.startedAt || parsed.startedAt,
      status: 'active',
      notes: data.notes,
    }));
    form.reset();
  }) : null;
  const closeForm = closeTarget ? renderRecordForm(`结束赛季：${closeTarget.label || closeTarget.id}`, [
    field('结束日期', dateInput('endedAt', seasonDefaultEndDate(closeTarget) || closeTarget.startedAt || currentLedgerDate(state))),
    field('赛季结果', input('teamOutcome', closeTarget.closedSummary?.teamOutcome || '')),
    field('球队最终成绩', input('finalStanding', closeTarget.closedSummary?.finalStanding || '')),
    field('赛季末队内角色', select('roleAtEnd', closeTarget.closedSummary?.roleAtEnd || state.player.squadRole, enumRows(SQUAD_ROLE_VALUES, SQUAD_ROLE_LABELS))),
    field('赛季简短总结', textarea('narrativeSummary', closeTarget.closedSummary?.narrativeSummary || '')),
    field('团队荣誉（逗号分隔）', input('teamHonors', closeTarget.closedSummary?.teamHonors?.join(', ') || '')),
    field('个人荣誉（逗号分隔）', input('individualHonors', closeTarget.closedSummary?.individualHonors?.join(', ') || '')),
  ], '确认结束赛季', async (data) => {
    if (!confirm('确认正式结束该赛季？关闭后仍保留所有比赛记录。')) return;
    await actions.save((draft) => closeSeason(draft, closeTarget.id, {
      endedAt: data.endedAt,
      teamOutcome: data.teamOutcome,
      finalStanding: data.finalStanding,
      roleAtEnd: data.roleAtEnd,
      narrativeSummary: data.narrativeSummary,
      teamHonors: String(data.teamHonors || '').split(',').map((item) => item.trim()).filter(Boolean),
      individualHonors: String(data.individualHonors || '').split(',').map((item) => item.trim()).filter(Boolean),
    }));
    actions.clearEditing();
  }) : null;
  const closeCurrentCard = activeSeason && !closeTarget ? card('当前赛季', `${activeSeason.label || activeSeason.id} 正在进行`, [
    h('button', { type: 'button', class: 'menu_button', text: '结束当前赛季', onclick: () => actions.setEditing('closeSeason', activeSeason.id) }),
  ]) : null;
  const createNextForm = state.seasons.length && !activeSeason ? renderRecordForm('创建下一赛季', [
    field('赛季模板', seasonTemplateSelect(nextTemplate.value)),
    field('队伍', teamPicker('club', state, state.player.currentTeam || state.player.currentClub)),
    field('开始日期', dateInput('startedAt', nextTemplate.startedAt)),
    field('当前俱乐部', input('currentClub', state.player.currentClub)),
    field('当前队伍', teamPicker('currentTeam', state, state.player.currentTeam || state.player.currentClub)),
  ], '创建下一赛季', async (data, form) => {
    const parsed = parseSeasonInput(data.seasonTemplate);
    await actions.save((draft) => createNextSeason(draft, {
      id: parsed.id,
      label: parsed.label,
      club: data.club,
      startedAt: data.startedAt || parsed.startedAt,
      currentClub: data.currentClub,
      currentTeam: data.currentTeam,
    }));
    form.reset();
  }) : null;
  return h('div', {}, [
    editor ? renderRecordForm('编辑赛季', seasonFields(state, editor), '保存赛季', async (data) => {
      await actions.save((draft) => updateSeason(draft, editor.id, seasonPayload(data)));
      actions.clearEditing();
    }) : null,
    createInitialForm,
    closeForm,
    closeCurrentCard,
    createNextForm,
    state.seasons.length && activeSeason ? h('p', { class: 'fcl-muted', text: '下一赛季会在结束当前活动赛季后开放。默认赛季边界采用 7月1日 至 次年6月30日，可在结束赛季时手动调整。' }) : null,
    h('h3', { text: '赛季列表' }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function contractFields(state, contract = {}) {
  return [
    field('俱乐部', input('club', contract.club || state.player.currentClub)),
    field('类型', select('contractType', contract.contractType || 'youth', CONTRACT_TYPES)),
    field('开始日期', dateInput('startDate', contract.startDate || currentLedgerDate(state))),
    field('结束日期', dateInput('endDate', contract.endDate || '', { value: contract.endDate || '' })),
    field('薪资最小单位', input('wageAmountMinor', contract.wageAmountMinor ?? 1, { type: 'number', min: '1' })),
    field('币种', select('wageCurrency', contract.wageCurrency || state.player.defaultCurrency || 'DEM', currencyRows(state))),
    field('周期', select('wagePeriod', contract.wagePeriod || 'weekly', WAGE_PERIODS)),
    field('活动合同', h('input', { name: 'active', type: 'checkbox', checked: contract.active })),
    field('奖金', textarea('bonuses', contract.bonuses || '')),
    field('条款', textarea('clauses', contract.clauses || '')),
    field('备注', textarea('notes', contract.notes || '')),
  ];
}

function contractPayload(data) {
  return {
    club: String(data.club || ''),
    contractType: String(data.contractType || 'other'),
    startDate: String(data.startDate || ''),
    endDate: data.endDate ? String(data.endDate) : null,
    wageAmountMinor: numberValue(data.wageAmountMinor, 1),
    wageCurrency: String(data.wageCurrency || ''),
    wagePeriod: String(data.wagePeriod || 'weekly'),
    active: boolValue(data.active),
    bonuses: String(data.bonuses || ''),
    clauses: String(data.clauses || ''),
    notes: String(data.notes || ''),
  };
}

function renderContracts(state, actions) {
  const editor = actions.editing?.type === 'contract'
    ? state.contracts.find((contract) => contract.id === actions.editing.id)
    : null;
  const rows = state.contracts.map((contract) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${contract.active ? '活动：' : ''}${contract.club} ${contract.startDate} - ${contract.endDate || '未定'} ${contract.wageAmountMinor} ${contract.wageCurrency}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('contract', contract.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: contract.active ? '停用' : '设为当前', onclick: () => actions.save((draft) => contract.active ? updateContract(draft, contract.id, { active: false }) : setActiveContract(draft, contract.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm(contract.active ? '该合同是活动合同，确认删除？' : '确认删除该合同？') && actions.save((draft) => deleteContract(draft, contract.id)) }),
  ]));
  return h('div', {}, [
    editor ? renderRecordForm('编辑合同', contractFields(state, editor), '保存合同', async (data) => {
      await actions.save((draft) => updateContract(draft, editor.id, contractPayload(data)));
      actions.clearEditing();
    }) : renderRecordForm('新增合同', contractFields(state), '新增合同', async (data, form) => {
      if (boolValue(data.active) && state.contracts.some((contract) => contract.active) && !confirm('当前已有活动合同，是否停用旧合同并启用新合同？')) return;
      await actions.save((draft) => addContract(draft, contractPayload(data)));
      form.reset();
    }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function renderFinance(state, actions) {
  const balances = getFinanceSummary(state).balances;
  const rows = queryTransactions(state, { limit: 50 }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.type} ${row.category} ${row.amountMinor} ${row.currency} ${row.description}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('transaction', row.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该流水？') && actions.save((draft) => deleteTransaction(draft, row.id)) }),
  ]));
  const editor = actions.editing?.type === 'transaction'
    ? state.finance.transactions.find((transaction) => transaction.id === actions.editing.id)
    : null;
  const transactionFields = (row = {}) => [
    field('日期', dateInput('date', row.date || currentLedgerDate(state))),
    field('类型', select('type', row.type || 'income', TRANSACTION_TYPES)),
    field('类别', select('category', row.category || 'salary', FINANCE_CATEGORIES)),
    field('金额最小单位', input('amountMinor', row.amountMinor ?? 1, { type: 'number', min: '1' })),
    field('币种', select('currency', row.currency || state.player.defaultCurrency || 'DEM', currencyRows(state))),
    field('说明', input('description', row.description || '')),
    field('备注', textarea('notes', row.notes || '')),
  ];
  return h('div', {}, [
    h('h3', { text: '余额' }),
    h('div', { class: 'fcl-summary-grid' }, balances.map((balance) => card(balance.currency, String(balance.amountMinor), [
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '复制余额', onclick: () => navigator.clipboard?.writeText(`${balance.currency} ${balance.amountMinor}`) }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除期初', onclick: () => confirm('确认删除该币种期初余额？') && actions.save((draft) => deleteOpeningBalance(draft, balance.currency)) }),
    ]))),
    renderRecordForm('设置期初余额', [
      field('币种', select('currency', state.player.defaultCurrency || 'DEM', currencyRows(state))),
      field('期初余额', input('amountMinor', 0, { type: 'number' })),
    ], '保存期初余额', async (data) => {
      await actions.save((draft) => setOpeningBalance(draft, { currency: data.currency, amountMinor: numberValue(data.amountMinor) }));
    }),
    editor ? renderRecordForm('编辑流水', transactionFields(editor), '保存流水', async (data) => {
      await actions.save((draft) => updateTransaction(draft, editor.id, {
        date: data.date,
        type: data.type,
        category: data.category,
        amountMinor: numberValue(data.amountMinor, 1),
        currency: data.currency,
        description: data.description,
        notes: data.notes,
        relatedContractId: editor.relatedContractId,
      }));
      actions.clearEditing();
    }) : renderRecordForm('新增流水', transactionFields(), '新增流水', async (data, form) => {
      await actions.save((draft) => addTransaction(draft, {
        date: data.date,
        type: data.type,
        category: data.category,
        amountMinor: numberValue(data.amountMinor, 1),
        currency: data.currency,
        description: data.description,
        notes: data.notes,
        relatedContractId: null,
      }));
      form.reset();
    }),
    h('h3', { text: '流水列表' }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function renderAbilities(state, actions) {
  const abilities = getAbilities(state);
  const editor = actions.editing?.type === 'abilityHistory'
    ? state.abilities.history.find((item) => item.id === actions.editing.id)
    : null;
  const canSetInitialAbilities = state.abilities.history.length === 0;
  const initialForm = renderRecordForm('设置初始能力', [
    ...ABILITY_KEYS.map((key) => field(ABILITY_LABELS[key], input(`initial_${key}`, abilities[key], { type: 'number', min: '0', max: '99' }))),
    field('基准日期', dateInput('date', LEDGER_START_DATE)),
    field('来源说明', input('reason', '初始能力导入')),
  ], '保存初始能力', async (data) => {
    if (!canSetInitialAbilities) throw new Error('已有能力历史时不能覆盖初始能力，请先编辑或删除相关历史记录');
    await actions.save((draft) => setInitialAbilities(draft, {
      date: data.date,
      reason: data.reason,
      values: Object.fromEntries(ABILITY_KEYS.map((key) => [key, numberValue(data[`initial_${key}`])])),
    }));
  });
  const form = renderRecordForm('修改能力', [
    field('日期', dateInput('date', currentLedgerDate(state))),
    field('能力项', select('ability', 'passing', ABILITY_KEYS.map((key) => ({ value: key, label: ABILITY_LABELS[key] })))),
    field('变化量', input('delta', 1, { type: 'number', min: '-2', max: '2' })),
    field('原因', input('reason', '')),
    ...ABILITY_KEYS.map((key) => field(ABILITY_LABELS[key], input(`current_${key}`, abilities[key], { type: 'number', min: '0', max: '99', disabled: true }))),
  ], '确认能力变化', async (data) => {
    if (Math.abs(numberValue(data.delta)) === 2 && !confirm('本次能力变化为 ±2，确认这是正式评估结果？')) return;
    await actions.save((draft) => applyAbilityChange(draft, {
      date: data.date,
      ability: data.ability,
      delta: numberValue(data.delta),
      reason: data.reason,
    }));
  });
  const editForm = editor ? renderRecordForm('编辑能力历史', [
    field('日期', dateInput('date', editor.date || currentLedgerDate(state))),
    field('能力项', select('ability', editor.ability, ABILITY_KEYS.map((key) => ({ value: key, label: ABILITY_LABELS[key] })))),
    field('Before', input('before', editor.before, { type: 'number', min: '0', max: '99' })),
    field('After', input('after', editor.after, { type: 'number', min: '0', max: '99' })),
    field('原因', input('reason', editor.reason || '')),
    field('备注', textarea('notes', editor.notes || '')),
  ], '保存能力历史', async (data) => {
    await actions.save((draft) => updateAbilityHistory(draft, editor.id, {
      date: data.date,
      ability: data.ability,
      before: numberValue(data.before),
      after: numberValue(data.after),
      reason: data.reason,
      notes: data.notes,
    }));
    actions.clearEditing();
  }) : null;
  const history = state.abilities.history.slice(0, 50).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${ABILITY_LABELS[row.ability]} ${row.before} -> ${row.after} ${row.reason || ''}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('abilityHistory', row.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该能力历史？') && actions.save((draft) => deleteAbilityHistory(draft, row.id)) }),
  ]));
  return h('div', {}, [
    initialForm,
    canSetInitialAbilities ? null : h('p', { class: 'fcl-muted', text: '已有能力变化历史后，初始能力不再允许直接覆盖；请通过增量修改或编辑历史记录调整。' }),
    form,
    editForm,
    h('h3', { text: '能力历史' }),
    h('ul', { class: 'fcl-list' }, history),
  ]);
}

function miscFields(state, item = {}) {
  return [
    field('日期', dateInput('date', item.date || currentLedgerDate(state))),
    field('键', input('key', item.key || '')),
    field('值', input('value', item.value || '')),
    field('标签（逗号分隔）', input('tags', item.tags?.join(', ') || '')),
    field('备注', textarea('notes', item.notes || '')),
  ];
}

function miscPayload(data) {
  return {
    date: data.date,
    key: data.key,
    value: data.value,
    tags: String(data.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    notes: data.notes,
  };
}

function renderMisc(state, actions) {
  const editor = actions.editing?.type === 'misc'
    ? state.miscellaneous.find((item) => item.id === actions.editing.id)
    : null;
  const rows = getMiscellaneous(state, { limit: 50 }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.key}=${row.value} ${row.tags.join(', ')}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('misc', row.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该杂项？') && actions.save((draft) => deleteMiscellaneous(draft, row.id)) }),
  ]));
  return h('div', {}, [
    editor ? renderRecordForm('编辑杂项', miscFields(state, editor), '保存杂项', async (data) => {
      await actions.save((draft) => updateMiscellaneous(draft, editor.id, miscPayload(data)));
      actions.clearEditing();
    }) : renderRecordForm('新增杂项', miscFields(state), '新增杂项', async (data, form) => {
      await actions.save((draft) => addMiscellaneous(draft, miscPayload(data)));
      form.reset();
    }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function draftSummary(draft) {
  if (draft.status === 'invalid') return draft.validationErrors.join('；') || '无效草稿';
  if (draft.type === 'match') return `${draft.payload.date || ''} ${draft.payload.opponent || ''} ${draft.payload.goalsFor ?? '?'}-${draft.payload.goalsAgainst ?? '?'}`;
  if (draft.type === 'contract') return `${draft.payload.club || ''} ${draft.payload.contractType || ''}`;
  if (draft.type === 'transaction') return `${draft.payload.date || ''} ${draft.payload.direction || draft.payload.type || ''} ${draft.payload.amountMinor || ''} ${draft.payload.currency || ''}`;
  if (draft.type === 'ability_change') return `${ABILITY_LABELS[draft.payload.ability] || draft.payload.ability || ''} ${draft.payload.delta ?? ''}`;
  return `${draft.payload.date || ''} ${draft.payload.key || ''}=${draft.payload.value || ''}`;
}

function renderDrafts(state, actions) {
  const drafts = getDrafts(state, { limit: 100 });
  const editor = actions.editing?.type === 'draft'
    ? state.drafts.find((draft) => draft.id === actions.editing.id)
    : null;
  const rows = drafts.map((draft) => h('li', { class: 'fcl-list-row fcl-draft-row' }, [
    h('span', { text: `${draft.status} / ${draft.type} / ${draftSummary(draft)}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('draft', draft.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '确认', disabled: draft.status !== 'pending', onclick: () => actions.save((stateDraft) => confirmDraft(stateDraft, draft.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '拒绝', disabled: draft.status !== 'pending', onclick: () => actions.save((stateDraft) => rejectDraft(stateDraft, draft.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该草稿？') && actions.save((stateDraft) => deleteDraft(stateDraft, draft.id)) }),
  ]));
  return h('div', {}, [
    editor ? renderRecordForm(`编辑草稿：${editor.type}`, [
      field('类型', select('type', editor.type, DRAFT_TYPES)),
      field('状态', select('status', editor.status, DRAFT_STATUS_VALUES)),
      field('Payload JSON', textarea('payload', JSON.stringify(editor.payload, null, 2), { class: 'fcl-import-box' })),
      editor.validationErrors.length ? h('p', { class: 'fcl-error', text: editor.validationErrors.join('；') }) : null,
    ], '保存草稿 Payload', async (data) => {
      await actions.save((draft) => updateDraft(draft, editor.id, {
        type: data.type,
        status: data.status,
        payload: parseJsonField(data.payload),
      }));
      actions.clearEditing();
    }) : null,
    h('h3', { text: '草稿列表' }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function renderData(state, actions) {
  const importBox = textarea('importJson', '', { class: 'fcl-import-box', placeholder: '粘贴完整 JSON 后点击导入' });
  const selfCheckResult = h('pre', { class: 'fcl-pre' });
  const summaryText = h('pre', { class: 'fcl-pre' }, buildPromptSummary(state, actions.settings));
  const presetPreview = h('pre', { class: 'fcl-pre' }, PROMPT_PRESETS.map((preset) => `# ${preset}\n${buildPromptSummary(state, { ...actions.settings, preset })}`).join('\n\n'));
  return h('div', { class: 'fcl-data-tools' }, [
    actionbar([
      h('button', { type: 'button', class: 'menu_button', text: '导出JSON', onclick: actions.exportJson }),
      h('button', { type: 'button', class: 'menu_button', text: '示例数据', onclick: actions.downloadExample }),
      h('button', { type: 'button', class: 'menu_button', text: '复制模型建议规则', onclick: () => navigator.clipboard?.writeText(buildModelSuggestionInstructions()) }),
      h('button', { type: 'button', class: 'menu_button', text: '清空本聊天', onclick: actions.clearData }),
      h('button', { type: 'button', class: 'menu_button', text: '恢复导入前备份', disabled: !actions.lastImportBackup, onclick: async () => actions.lastImportBackup && actions.importState(parseImportJson(actions.lastImportBackup)) }),
      h('button', { type: 'button', class: 'menu_button', text: 'API自检', onclick: async () => { selfCheckResult.textContent = JSON.stringify(await actions.selfCheck(), null, 2); } }),
    ]),
    card('财务边界', '插件财务余额是结构化账本计算结果。如果 MVU 同时维护个人存款，两者可能冲突；推荐以插件余额为权威来源。'),
    h('h3', { text: '导入JSON' }),
    importBox,
    h('button', {
      type: 'button',
      class: 'menu_button',
      text: '解析并导入',
      onclick: async () => {
        const backup = exportStateJson(state);
        const nextState = parseImportJson(importBox.value);
        const summary = buildImportSummary(nextState);
        if (!confirm(`确认导入？导入前已在本次会话保留内存备份。\n${JSON.stringify(summary, null, 2)}`)) return;
        actions.setImportBackup(backup);
        await actions.importState(nextState);
      },
    }),
    h('h3', { text: '当前摘要预览' }),
    summaryText,
    h('h3', { text: '三档预设预览' }),
    presetPreview,
    h('h3', { text: 'API自检结果' }),
    selfCheckResult,
  ]);
}

export class LedgerUi {
  constructor(context, api, settings, actions) {
    this.context = context;
    this.api = api;
    this.settings = settings;
    this.actions = actions;
    this.activeTab = 'overview';
    this.root = null;
    this.editing = null;
    this.matchLimit = 50;
    this.lastImportBackup = null;
  }

  mount(root) {
    this.root = root;
    this.render();
  }

  async refresh() {
    await this.render();
  }

  setEditing(type, id) {
    this.editing = { type, id };
    this.render();
  }

  clearEditing() {
    this.editing = null;
    this.render();
  }

  async render() {
    if (!this.root) return;
    this.root.textContent = '';
    const container = h('div', { class: 'fcl-panel' });
    container.append(h('div', { class: 'fcl-toolbar' }, [
      h('strong', { text: '足球生涯账本' }),
      h('span', { 'data-fcl-status': '', class: 'fcl-status', text: '' }),
    ]));
    container.append(h('div', { class: 'fcl-tabs' }, tabDefs.map(([id, label]) => h('button', {
      type: 'button',
      class: `menu_button ${this.activeTab === id ? 'fcl-active' : ''}`,
      text: label,
      onclick: () => {
        this.activeTab = id;
        this.editing = null;
        this.render();
      },
    }))));
    const body = h('div', { class: 'fcl-body' });
    container.append(body);
    this.root.append(container);

    let state;
    try {
      state = await readLedgerState(this.context);
    } catch (error) {
      body.append(h('p', { class: 'fcl-error', text: `无法读取当前聊天数据：${error.message}` }));
      return;
    }

    const save = async (reducer) => {
      await submitWithStatus(container, '已保存', async () => {
        await writeLedgerState(this.context, reducer);
        await this.actions.updatePrompt();
        await this.render();
      });
    };

    const sharedActions = {
      settings: this.settings,
      editing: this.editing,
      matchLimit: this.matchLimit,
      lastImportBackup: this.lastImportBackup,
      setImportBackup: (backup) => {
        this.lastImportBackup = backup;
      },
      save,
      setEditing: (type, id) => this.setEditing(type, id),
      clearEditing: () => this.clearEditing(),
      undo: () => save((draft) => undoLastOperation(draft)),
      exportJson: async () => {
        const current = await readLedgerState(this.context);
        this.context.download(exportStateJson(current), `football-career-ledger-${Date.now()}.json`, 'application/json');
      },
      downloadExample: () => this.context.download(exportStateJson(createExampleState()), 'football-career-ledger-example.json', 'application/json'),
      clearData: async () => {
        if (!confirm('确认清空当前聊天的足球生涯账本数据？此操作不会影响其他聊天。')) return;
        await clearLedgerState(this.context);
        await this.actions.updatePrompt();
        await this.render();
      },
      importState: async (nextState) => {
        await submitWithStatus(container, '导入完成', async () => {
          await replaceLedgerState(this.context, nextState);
          await this.actions.updatePrompt();
          await this.render();
        });
      },
      selfCheck: this.actions.selfCheck,
    };

    const renderers = {
      overview: () => renderOverview(state, sharedActions),
      drafts: () => renderDrafts(state, sharedActions),
      matches: () => renderMatches(state, sharedActions),
      seasons: () => renderSeasons(state, sharedActions),
      contracts: () => renderContracts(state, sharedActions),
      finance: () => renderFinance(state, sharedActions),
      abilities: () => renderAbilities(state, sharedActions),
      misc: () => renderMisc(state, sharedActions),
      data: () => renderData(state, sharedActions),
    };
    body.append(renderers[this.activeTab]());
  }
}
