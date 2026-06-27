import { ABILITY_LABELS, DRAFT_STATUS_VALUES, DRAFT_TYPES } from '../../constants.js';
import { confirmDraft, deleteDraft, rejectDraft, updateDraft } from '../../ledger-actions.js';
import { getDrafts } from '../../selectors.js';
import { field, h, parseJsonField, renderRecordForm, select, textarea } from '../dom.js';

function draftSummary(draft) {
  if (draft.status === 'invalid') return draft.validationErrors.join('；') || '无效草稿';
  if (draft.type === 'match') return `${draft.payload.date || ''} ${draft.payload.opponent || ''} ${draft.payload.goalsFor ?? '?'}-${draft.payload.goalsAgainst ?? '?'}`;
  if (draft.type === 'contract') return `${draft.payload.club || ''} ${draft.payload.contractType || ''}`;
  if (draft.type === 'transaction') return `${draft.payload.date || ''} ${draft.payload.direction || draft.payload.type || ''} ${draft.payload.amountMinor || ''} ${draft.payload.currency || ''}`;
  if (draft.type === 'ability_change') return `${ABILITY_LABELS[draft.payload.ability] || draft.payload.ability || ''} ${draft.payload.delta ?? ''}`;
  if (draft.type === 'career_start') {
    const player = draft.payload.player || {};
    const season = draft.payload.season || {};
    return `${player.name || '未命名'} / ${player.primaryPosition || '未填写位置'} / ${season.id || draft.payload.date || '开局'}`;
  }
  return `${draft.payload.date || ''} ${draft.payload.key || ''}=${draft.payload.value || ''}`;
}

export function renderDrafts(state, actions) {
  const drafts = getDrafts(state, { limit: 100 });
  const editor = actions.editing?.type === 'draft'
    ? state.drafts.find((draft) => draft.id === actions.editing.id)
    : null;
  const rows = drafts.map((draft) => h('li', { class: 'fcl-list-row fcl-draft-row' }, [
    h('span', { text: `${draft.status} / ${draft.type} / ${draftSummary(draft)}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '编辑', onclick: () => actions.setEditing('draft', draft.id) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '确认', disabled: draft.status !== 'pending', onclick: () => actions.save((stateDraft) => confirmDraft(stateDraft, draft.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '拒绝', disabled: draft.status !== 'pending', onclick: () => actions.save((stateDraft) => rejectDraft(stateDraft, draft.id)) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除这条草稿？') && actions.save((stateDraft) => deleteDraft(stateDraft, draft.id)) }),
  ]));
  return h('div', {}, [
    editor ? renderRecordForm(`编辑草稿：${editor.type}`, [
      field('类型', select('type', editor.type, DRAFT_TYPES)),
      field('状态', select('status', editor.status, DRAFT_STATUS_VALUES)),
      field('Payload JSON', textarea('payload', JSON.stringify(editor.payload, null, 2), { class: 'fcl-import-box' })),
      editor.validationErrors.length ? h('p', { class: 'fcl-error', text: editor.validationErrors.join('；') }) : null,
    ], '保存草稿', async (data) => {
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
