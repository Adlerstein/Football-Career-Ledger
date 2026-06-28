import { PROMPT_PRESETS } from '../../constants.js';
import { buildImportSummary, exportStateJson, parseImportJson } from '../../import-export.js';
import { buildPromptSummary } from '../../prompt.js';
import { buildModelSuggestionInstructions } from '../../suggestions.js';
import { actionbar, card, h, textarea } from '../dom.js';

export function renderData(state, actions) {
  const importBox = textarea('importJson', '', { class: 'fcl-import-box', placeholder: '粘贴完整 JSON 后点击导入' });
  const selfCheckResult = h('pre', { class: 'fcl-pre' });
  const summaryText = h('pre', { class: 'fcl-pre' }, buildPromptSummary(state, actions.settings));
  const presetPreview = h('pre', { class: 'fcl-pre' }, PROMPT_PRESETS.map((preset) => `# ${preset}\n${buildPromptSummary(state, { ...actions.settings, preset })}`).join('\n\n'));
  return h('div', { class: 'fcl-data-tools' }, [
    actionbar([
      h('button', { type: 'button', class: 'menu_button', text: '导出JSON', onclick: actions.exportJson }),
      h('button', { type: 'button', class: 'menu_button', text: '示例数据', onclick: actions.downloadExample }),
      h('button', { type: 'button', class: 'menu_button', text: '复制建议格式', onclick: () => navigator.clipboard?.writeText(buildModelSuggestionInstructions()) }),
      h('button', { type: 'button', class: 'menu_button', text: '清空本聊天', onclick: actions.clearData }),
      h('button', { type: 'button', class: 'menu_button', text: '恢复导入前备份', disabled: !actions.lastImportBackup, onclick: async () => actions.lastImportBackup && actions.importState(parseImportJson(actions.lastImportBackup)) }),
      h('button', { type: 'button', class: 'menu_button', text: 'API自检', onclick: async () => { selfCheckResult.textContent = JSON.stringify(await actions.selfCheck(), null, 2); } }),
    ]),
    card('余额怎么算', '余额是用期初金额加上每一笔收支自动算出来的。要是你在 MVU 里另外记了存款，两边可能对不上，以这里为准。'),
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
        if (!confirm(`确认导入？当前数据已经在这次会话里备份，导入后还能一键恢复。\n${JSON.stringify(summary, null, 2)}`)) return;
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
