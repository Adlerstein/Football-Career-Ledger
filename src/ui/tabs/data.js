import { buildImportSummary, exportStateJson, parseImportJson } from '../../import-export.js';
import { buildPromptSummary } from '../../prompt.js';
import { buildModelSuggestionInstructions } from '../../suggestions.js';
import { actionbar, h } from '../dom.js';

export function renderData(state, actions) {
  const selfCheckResult = h('pre', { class: 'fcl-pre' });
  const summaryText = h('pre', { class: 'fcl-pre' }, buildPromptSummary(state, actions.settings));

  const importInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    style: 'display:none',
    onchange: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      let nextState;
      try {
        nextState = parseImportJson(await file.text());
      } catch (error) {
        alert(`导入失败：${error.message}`);
        return;
      }
      const summary = buildImportSummary(nextState);
      if (!confirm(`确认导入？当前数据已在本次会话备份，导入后可一键恢复。\n${JSON.stringify(summary, null, 2)}`)) return;
      actions.setImportBackup(exportStateJson(state));
      await actions.importState(nextState);
    },
  });

  return h('div', { class: 'fcl-data-tools' }, [
    actionbar([
      h('button', { type: 'button', class: 'menu_button', text: '导出JSON', onclick: actions.exportJson }),
      h('button', { type: 'button', class: 'menu_button', text: '示例数据', onclick: actions.downloadExample }),
      h('button', { type: 'button', class: 'menu_button', text: '复制建议格式', onclick: () => navigator.clipboard?.writeText(buildModelSuggestionInstructions()) }),
      h('button', { type: 'button', class: 'menu_button', text: '清空本聊天', onclick: actions.clearData }),
      h('button', { type: 'button', class: 'menu_button', text: '恢复导入前备份', disabled: !actions.lastImportBackup, onclick: async () => actions.lastImportBackup && actions.importState(parseImportJson(actions.lastImportBackup)) }),
      h('button', { type: 'button', class: 'menu_button', text: 'API自检', onclick: async () => { selfCheckResult.textContent = JSON.stringify(await actions.selfCheck(), null, 2); } }),
    ]),
    h('h3', { text: '导入JSON' }),
    h('label', { class: 'menu_button fcl-file-button' }, ['选择 JSON 文件导入', importInput]),
    h('h3', { text: '当前摘要预览' }),
    summaryText,
    h('h3', { text: 'API自检结果' }),
    selfCheckResult,
  ]);
}
