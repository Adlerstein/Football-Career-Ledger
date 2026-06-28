import {
  DEFAULT_SEASON_START_DATE,
  MANUAL_TOTAL_KEYS,
  MANUAL_TOTAL_LABELS,
  SQUAD_ROLE_LABELS,
  SQUAD_ROLE_VALUES,
} from '../../constants.js';
import { formatSeasonTotals } from '../../formatters.js';
import { addSeason, closeSeason, createNextSeason, deleteSeason, recalculateSeasonClosure, updateSeason } from '../../ledger-actions.js';
import { getNextSeasonTemplate, getSeasonTemplateRows, parseSeasonInput } from '../../season-utils.js';
import { summarizeSeason } from '../../selectors.js';
import { card, field, h, input, renderRecordForm, select, staticValue, textarea } from '../dom.js';
import {
  currentLedgerDate,
  currentTeamName,
  dateInput,
  enumRows,
  fixedTeamValue,
  requireTeamValue,
  resolveTeamValue,
  seasonDefaultEndDate,
  seasonTemplateSelect,
  teamSelect,
  teamSelectWithCustom,
} from '../fields.js';

// Optional manual season tallies. Each left blank falls back to the value
// aggregated from matches; a number overrides it. `autoTotals` (from
// summarizeSeason) drives the "current auto value" hint in the placeholder.
function manualTotalFields(season = {}, autoTotals = null) {
  const manual = season.manualTotals || {};
  return MANUAL_TOTAL_KEYS.map((key) => {
    const auto = autoTotals ? (autoTotals[key] ?? 0) : null;
    const placeholder = auto === null ? '不填就按比赛算' : `不填按比赛算（现在 ${auto}）`;
    const current = manual[key] === null || manual[key] === undefined ? '' : manual[key];
    return field(`赛季${MANUAL_TOTAL_LABELS[key]}（可留空，填了就盖过自动统计）`, input(`manual_${key}`, current, { type: 'number', min: '0', placeholder }));
  });
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
    field('本赛季球队', fixedTeamValue('club', season.club || currentTeamName(state))),
    field('开始日期', dateInput('startedAt', season.startedAt || parsedSeason.startedAt || DEFAULT_SEASON_START_DATE)),
    field('备注', textarea('notes', season.notes || '')),
  ];
  if (mode !== 'edit') return common;
  const editAutoTotals = season.id ? summarizeSeason(state, season.id)?.autoTotals : null;
  return [
    field('赛季模板', template),
    field('赛季ID', input('id', season.id || state.player.currentSeasonId || '1998-99')),
    field('标签', input('label', season.label || parsedSeason.label || '1998/99')),
    field('赛季球队', teamSelect('club', state, season.club || currentTeamName(state))),
    field('开始日期', dateInput('startedAt', season.startedAt || parsedSeason.startedAt || DEFAULT_SEASON_START_DATE)),
    field('结束日期', dateInput('endedAt', season.endedAt || '', { value: season.endedAt || '' })),
    field('状态', select('status', season.status || 'active', ['active', 'completed', 'planned'])),
    field('备注', textarea('notes', season.notes || '')),
    ...manualTotalFields(season, editAutoTotals),
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
    manualTotals: readManualTotals(data),
  };
}

// Pull the manual-override inputs (manual_<key>) out of a submitted form object.
function readManualTotals(data) {
  return Object.fromEntries(MANUAL_TOTAL_KEYS.map((key) => [key, data[`manual_${key}`]]));
}

export function renderSeasons(state, actions) {
  const activeSeason = state.seasons.find((season) => season.status === 'active') || null;
  const latestSeason = state.seasons.slice().sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0] || null;
  const nextTemplate = getNextSeasonTemplate(latestSeason);
  const editor = actions.editing?.type === 'season'
    ? state.seasons.find((season) => season.id === actions.editing.id)
    : null;
  const rows = state.seasons.map((season) => {
    const summary = summarizeSeason(state, season.id);
    return h('li', { class: 'fcl-list-row' }, [
      h('span', { text: `${season.label || season.id} ${season.status} ${summary?.appearances ?? 0}场 ${summary?.goals ?? 0}球 ${summary?.assists ?? 0}助${summary?.hasManualTotals ? ' ·手动' : ''}` }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('season', season.id) }),
      season.status === 'active' ? h('button', { type: 'button', class: 'menu_button fcl-small', text: '结束', onclick: () => actions.setEditing('closeSeason', season.id) }) : null,
      season.closedSummary ? h('button', { type: 'button', class: 'menu_button fcl-small', text: '重算', title: '按当前比赛重新计算本赛季的自动统计，保留手填荣誉/小结', onclick: () => actions.save((draft) => recalculateSeasonClosure(draft, season.id)) }) : null,
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这个赛季？还挂着比赛记录的赛季删不了。') && actions.save((draft) => deleteSeason(draft, season.id)) }),
    ]);
  });
  const closeTarget = actions.editing?.type === 'closeSeason'
    ? state.seasons.find((season) => season.id === actions.editing.id)
    : null;
  const createInitialForm = !state.seasons.length ? renderRecordForm('创建开档赛季', seasonFields(state, {
    id: '1998-99',
    label: '1998/99',
    club: currentTeamName(state),
    startedAt: DEFAULT_SEASON_START_DATE,
    status: 'active',
  }, 'create'), '创建开档赛季', async (data, form) => {
    const parsed = parseSeasonInput(data.seasonTemplate);
    const team = requireTeamValue(data.club);
    await actions.save((draft) => addSeason(draft, {
      id: parsed.id,
      label: parsed.label,
      club: team,
      startedAt: data.startedAt || parsed.startedAt,
      status: 'active',
      notes: data.notes,
    }));
    form.reset();
  }) : null;
  const closeForm = closeTarget ? renderRecordForm(`结束赛季：${closeTarget.label || closeTarget.id}`, [
    field('结束日期', dateInput('endedAt', seasonDefaultEndDate(closeTarget) || closeTarget.startedAt || currentLedgerDate(state))),
    field('比赛累计', staticValue(formatSeasonTotals(summarizeSeason(state, closeTarget.id)?.autoTotals, 'compact'), '还没有比赛')),
    field('球队赛季成绩', input('finalStanding', closeTarget.closedSummary?.finalStanding || '', { placeholder: '例如 青年联赛第二 / 杯赛四强' })),
    field('赛季末队内角色', select('roleAtEnd', closeTarget.closedSummary?.roleAtEnd || state.player.squadRole, enumRows(SQUAD_ROLE_VALUES, SQUAD_ROLE_LABELS))),
    field('赛季小结', textarea('narrativeSummary', closeTarget.closedSummary?.narrativeSummary || '')),
    field('团队荣誉（用逗号隔开）', input('teamHonors', closeTarget.closedSummary?.teamHonors?.join(', ') || '', { placeholder: '例如 青年联赛冠军，没有就留空' })),
    field('个人荣誉（用逗号隔开）', input('individualHonors', closeTarget.closedSummary?.individualHonors?.join(', ') || '')),
    ...manualTotalFields(closeTarget, summarizeSeason(state, closeTarget.id)?.autoTotals),
  ], '确认结束赛季', async (data) => {
    if (!confirm('确认结束这个赛季？比赛记录会照常保留。')) return;
    await actions.save((draft) => closeSeason(draft, closeTarget.id, {
      endedAt: data.endedAt,
      finalStanding: data.finalStanding,
      roleAtEnd: data.roleAtEnd,
      narrativeSummary: data.narrativeSummary,
      teamHonors: String(data.teamHonors || '').split(',').map((item) => item.trim()).filter(Boolean),
      individualHonors: String(data.individualHonors || '').split(',').map((item) => item.trim()).filter(Boolean),
      manualTotals: readManualTotals(data),
    }));
    actions.clearEditing();
  }) : null;
  const closeCurrentCard = activeSeason && !closeTarget ? card('当前赛季', `${activeSeason.label || activeSeason.id} 正在进行`, [
    h('button', { type: 'button', class: 'menu_button', text: '结束当前赛季', onclick: () => actions.setEditing('closeSeason', activeSeason.id) }),
  ]) : null;
  const createNextForm = state.seasons.length && !activeSeason ? renderRecordForm('创建下一赛季', [
    field('赛季模板', seasonTemplateSelect(nextTemplate.value)),
    field('新赛季俱乐部', input('currentClub', state.player.currentClub || '')),
    field('新赛季队伍', teamSelectWithCustom('club', 'customTeam', state, currentTeamName(state), '请选择队伍')),
    field('开始日期', dateInput('startedAt', nextTemplate.startedAt)),
  ], '创建下一赛季', async (data, form) => {
    const parsed = parseSeasonInput(data.seasonTemplate);
    const team = resolveTeamValue(data.club, data.customTeam);
    const club = String(data.currentClub || state.player.currentClub || '').trim();
    await actions.save((draft) => createNextSeason(draft, {
      id: parsed.id,
      label: parsed.label,
      club: team,
      currentClub: club,
      currentTeam: team,
      startedAt: data.startedAt || parsed.startedAt,
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
    state.seasons.length && activeSeason ? h('p', { class: 'fcl-muted', text: '结束当前赛季后才能开下一个。赛季默认从 7月1日 到次年 6月30日，结束时可以自己改。' }) : null,
    h('h3', { text: '赛季列表' }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}
