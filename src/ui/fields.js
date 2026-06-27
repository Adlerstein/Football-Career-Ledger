// State-aware field builders shared across tabs: option rows, currency/team/season
// selects and the ledger-aware date input. These read the ledger state to derive
// sensible defaults and candidate lists, and compose the primitives in ./dom.js.

import {
  CURRENCY_LABELS,
  CURRENCY_VALUES,
  LEDGER_START_DATE,
} from '../constants.js';
import { getSeasonTemplateRows, parseSeasonInput } from '../season-utils.js';
import { getCurrentSeason } from '../selectors.js';
import { h, input, select, staticValue } from './dom.js';

export function optionRows(rows, emptyLabel = '未选择') {
  return [{ value: '', label: emptyLabel }, ...rows.map((row) => ({ value: row.id, label: row.label || row.id }))];
}

export function enumRows(values, labels = {}) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function enumRowsWithCurrent(values, labels, current) {
  const rows = enumRows(values, labels);
  if (current && !values.includes(current)) {
    rows.push({ value: current, label: labels[current] || current });
  }
  return rows;
}

export function currencyRows(state) {
  const values = new Set([
    state.player.defaultCurrency || 'DEM',
    ...CURRENCY_VALUES,
    ...state.finance.openingBalances.map((row) => row.currency),
    ...state.finance.transactions.map((row) => row.currency),
    ...state.contracts.map((contract) => contract.wageCurrency),
  ].filter(Boolean));
  return Array.from(values).map((value) => ({ value, label: CURRENCY_LABELS[value] || value }));
}

export function seasonRows(state, emptyLabel = '请先创建赛季') {
  return optionRows(
    state.seasons.map((season) => ({
      id: season.id,
      label: `${season.label || season.id}（${season.id}）`,
    })),
    emptyLabel,
  );
}

export function currentLedgerDate(state) {
  return getCurrentSeason(state)?.startedAt || state.seasons[0]?.startedAt || LEDGER_START_DATE;
}

export function dateInput(name, value = LEDGER_START_DATE, attrs = {}) {
  const resolved = value === undefined || value === null ? LEDGER_START_DATE : value;
  return input(name, resolved, { type: 'date', min: LEDGER_START_DATE, ...attrs });
}

export function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function teamCandidates(state) {
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

export function teamRows(state, value = '', emptyLabel = '未设置') {
  return [
    { value: '', label: emptyLabel },
    ...uniqueStrings([value, ...teamCandidates(state)]).map((team) => ({ value: team, label: team })),
  ];
}

export function teamSelect(name, state, value = '', emptyLabel = '未设置') {
  return select(name, value, teamRows(state, value, emptyLabel));
}

export function teamSelectWithCustom(name, customName, state, value = '', emptyLabel = '未设置') {
  return h('div', { class: 'fcl-stacked-control' }, [
    teamSelect(name, state, value, emptyLabel),
    input(customName, '', { placeholder: '其他队伍，可不填' }),
  ]);
}

export function currentTeamName(state) {
  return state.player.currentTeam || state.player.currentClub || '';
}

export function fixedTeamValue(name, value) {
  return h('div', { class: 'fcl-fixed-value' }, [
    staticValue(value, '先在“基础资料”里设好当前队伍'),
    input(name, value || '', { type: 'hidden' }),
  ]);
}

export function requireTeamValue(value) {
  const team = String(value || '').trim();
  if (!team) throw new Error('先在“基础资料”里设好当前队伍');
  return team;
}

export function resolveTeamValue(selected, custom) {
  return requireTeamValue(String(custom || '').trim() || selected);
}

export function seasonDefaultEndDate(season) {
  return season?.endedAt || parseSeasonInput(season?.id).endedAt || '';
}

export function seasonTemplateSelect(value = '1998-99') {
  return select('seasonTemplate', value, getSeasonTemplateRows());
}
