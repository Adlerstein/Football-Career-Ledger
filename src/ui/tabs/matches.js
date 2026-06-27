import { HOME_AWAY_VALUES } from '../../constants.js';
import { addMatch, deleteMatch, updateMatch } from '../../ledger-actions.js';
import { getCurrentSeason, queryMatches } from '../../selectors.js';
import { boolValue, field, h, input, numberValue, renderRecordForm, select, textarea } from '../dom.js';
import { currentLedgerDate, currentTeamName, dateInput, seasonRows, teamSelect } from '../fields.js';

function matchFields(state, match = {}) {
  const currentSeason = getCurrentSeason(state);
  return [
    field('赛季', select('seasonId', match.seasonId || currentSeason?.id || '', seasonRows(state, '请先创建赛季'))),
    field('日期', dateInput('date', match.date || currentLedgerDate(state))),
    field('赛事', input('competition', match.competition || '')),
    field('球队', teamSelect('club', state, match.club || currentTeamName(state) || currentSeason?.club || '')),
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

export function renderMatches(state, actions) {
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
    state.seasons.length ? null : h('p', { class: 'fcl-muted', text: '还没有赛季，先去“基础资料”或“赛季”页建一个。比如选 1998/99，赛季ID 会存成 1998-99。' }),
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
