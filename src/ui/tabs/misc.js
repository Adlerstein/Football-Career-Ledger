import { addMiscellaneous, deleteMiscellaneous, updateMiscellaneous } from '../../ledger-actions.js';
import { getMiscellaneous } from '../../selectors.js';
import { field, h, input, renderRecordForm, textarea } from '../dom.js';
import { currentLedgerDate, dateInput } from '../fields.js';

function miscFields(state, item = {}) {
  return [
    field('日期', dateInput('date', item.date || currentLedgerDate(state))),
    field('键', input('key', item.key || '')),
    field('值', input('value', item.value || '')),
    field('标签（用逗号隔开）', input('tags', item.tags?.join(', ') || '')),
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

export function renderMisc(state, actions) {
  const editor = actions.editing?.type === 'misc'
    ? state.miscellaneous.find((item) => item.id === actions.editing.id)
    : null;
  const rows = getMiscellaneous(state, { limit: 50, clone: false }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.key}=${row.value} ${row.tags.join(', ')}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('misc', row.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这条杂项？') && actions.save((draft) => deleteMiscellaneous(draft, row.id)) }),
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
