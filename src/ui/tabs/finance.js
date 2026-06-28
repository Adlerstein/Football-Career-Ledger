import { FINANCE_CATEGORIES, TRANSACTION_TYPES } from '../../constants.js';
import {
  addTransaction,
  deleteOpeningBalance,
  deleteTransaction,
  setOpeningBalance,
  updateTransaction,
} from '../../ledger-actions.js';
import { getFinanceSummary, queryTransactions } from '../../selectors.js';
import { card, field, h, input, numberValue, renderRecordForm, select, textarea } from '../dom.js';
import { currencyRows, mvuOrLedgerDate } from '../fields.js';
import { dateSelect } from '../date-parts.js';

export function renderFinance(state, actions) {
  const balances = getFinanceSummary(state).balances;
  const rows = queryTransactions(state, { limit: 50, clone: false }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.type} ${row.category} ${row.amountMinor} ${row.currency} ${row.description}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('transaction', row.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这条流水？') && actions.save((draft) => deleteTransaction(draft, row.id)) }),
  ]));
  const editor = actions.editing?.type === 'transaction'
    ? state.finance.transactions.find((transaction) => transaction.id === actions.editing.id)
    : null;
  const transactionFields = (row = {}) => [
    field('日期', dateSelect('date', row.date || mvuOrLedgerDate(state, actions))),
    field('类型', select('type', row.type || 'income', TRANSACTION_TYPES)),
    field('类别', select('category', row.category || 'salary', FINANCE_CATEGORIES)),
    field('金额', input('amountMinor', row.amountMinor ?? 1, { type: 'number', min: '1' })),
    field('币种', select('currency', row.currency || state.player.defaultCurrency || 'DEM', currencyRows(state))),
    field('说明', input('description', row.description || '')),
    field('备注', textarea('notes', row.notes || '')),
  ];
  return h('div', {}, [
    h('h3', { text: '余额' }),
    h('div', { class: 'fcl-summary-grid' }, balances.map((balance) => card(balance.currency, String(balance.amountMinor), [
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '复制余额', onclick: () => navigator.clipboard?.writeText(`${balance.currency} ${balance.amountMinor}`) }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除期初', onclick: () => confirm('确认删除这个币种的期初余额？') && actions.save((draft) => deleteOpeningBalance(draft, balance.currency)) }),
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
