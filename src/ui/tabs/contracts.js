import { CONTRACT_TYPES, WAGE_PERIODS } from '../../constants.js';
import { addContract, deleteContract, setActiveContract, updateContract } from '../../ledger-actions.js';
import { boolValue, field, h, input, numberValue, renderRecordForm, select, textarea } from '../dom.js';
import { currencyRows, currentLedgerDate, dateInput } from '../fields.js';

function contractFields(state, contract = {}) {
  return [
    field('俱乐部', input('club', contract.club || state.player.currentClub)),
    field('类型', select('contractType', contract.contractType || 'youth', CONTRACT_TYPES)),
    field('开始日期', dateInput('startDate', contract.startDate || currentLedgerDate(state))),
    field('结束日期', dateInput('endDate', contract.endDate || '', { value: contract.endDate || '' })),
    field('薪资金额', input('wageAmountMinor', contract.wageAmountMinor ?? 1, { type: 'number', min: '1' })),
    field('币种', select('wageCurrency', contract.wageCurrency || state.player.defaultCurrency || 'DEM', currencyRows(state))),
    field('周期', select('wagePeriod', contract.wagePeriod || 'weekly', WAGE_PERIODS)),
    field('设为当前合同', h('input', { name: 'active', type: 'checkbox', checked: contract.active })),
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

export function renderContracts(state, actions) {
  const editor = actions.editing?.type === 'contract'
    ? state.contracts.find((contract) => contract.id === actions.editing.id)
    : null;
  const rows = state.contracts.map((contract) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${contract.active ? '当前：' : ''}${contract.club} ${contract.startDate} - ${contract.endDate || '未定'} ${contract.wageAmountMinor} ${contract.wageCurrency}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('contract', contract.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: contract.active ? '停用' : '设为当前', onclick: () => actions.save((draft) => contract.active ? updateContract(draft, contract.id, { active: false }) : setActiveContract(draft, contract.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm(contract.active ? '这是当前生效的合同，确定删除？' : '确认删除这份合同？') && actions.save((draft) => deleteContract(draft, contract.id)) }),
  ]));
  return h('div', {}, [
    editor ? renderRecordForm('编辑合同', contractFields(state, editor), '保存合同', async (data) => {
      await actions.save((draft) => updateContract(draft, editor.id, contractPayload(data)));
      actions.clearEditing();
    }) : renderRecordForm('新增合同', contractFields(state), '新增合同', async (data, form) => {
      if (boolValue(data.active) && state.contracts.some((contract) => contract.active) && !confirm('已经有一份当前合同了，停掉旧的、换成这份？')) return;
      await actions.save((draft) => addContract(draft, contractPayload(data)));
      form.reset();
    }),
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}
