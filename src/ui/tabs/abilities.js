import { ABILITY_KEYS, ABILITY_LABELS, LEDGER_START_DATE } from '../../constants.js';
import {
  applyAbilityChange,
  deleteAbilityHistory,
  setInitialAbilities,
  updateAbilityHistory,
} from '../../ledger-actions.js';
import { getAbilities } from '../../selectors.js';
import { field, h, input, numberValue, renderRecordForm, select, textarea } from '../dom.js';
import { currentLedgerDate, dateInput } from '../fields.js';

export function renderAbilities(state, actions) {
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
    if (!canSetInitialAbilities) throw new Error('已经有能力历史了，不能直接覆盖初始值；先去编辑或删掉相关历史');
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
    if (Math.abs(numberValue(data.delta)) === 2 && !confirm('这次是 ±2 的变动，确定是正式评估的结果？')) return;
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
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这条能力历史？') && actions.save((draft) => deleteAbilityHistory(draft, row.id)) }),
  ]));
  return h('div', {}, [
    initialForm,
    canSetInitialAbilities ? null : h('p', { class: 'fcl-muted', text: '已经有能力变动记录后，初始值就不能直接改了；想调整就用上面的“修改能力”，或编辑对应的历史记录。' }),
    form,
    editForm,
    h('h3', { text: '能力历史' }),
    h('ul', { class: 'fcl-list' }, history),
  ]);
}
