// "日志" tab — a viewer over the in-memory runtime log buffer (src/logger.js).
// Level + search filter client-side (toggling row visibility, no panel re-render);
// 刷新 pulls the latest buffer, 清空 empties it.

import { actionbar, field, h } from '../dom.js';
import { logger } from '../../logger.js';

const LEVEL_TEXT = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' };
const LEVEL_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'error', label: '错误' },
  { value: 'warn', label: '警告' },
  { value: 'info', label: '信息' },
];

function formatLine(entry) {
  return `${entry.ts} [${(LEVEL_TEXT[entry.level] || entry.level)}] ${entry.message}${entry.details ? ` ${entry.details}` : ''}`;
}

export function renderLogs(state, actions) {
  const entries = logger.list().reverse();
  const refresh = actions.refresh || (() => {});

  const rows = entries.map((entry) => {
    const searchText = `${entry.message} ${entry.details}`.toLowerCase();
    return h('li', {
      class: `fcl-log-row fcl-log-${entry.level}`,
      'data-level': entry.level,
      'data-text': searchText,
    }, [
      h('span', { class: 'fcl-log-time', text: entry.ts.slice(11, 19) }),
      h('span', { class: 'fcl-log-level', text: LEVEL_TEXT[entry.level] || entry.level }),
      h('span', { class: 'fcl-log-msg', text: entry.details ? `${entry.message} · ${entry.details}` : entry.message }),
    ]);
  });

  const levelSelect = h('select', {}, LEVEL_OPTIONS.map((o) => h('option', { value: o.value, text: o.label })));
  const searchInput = h('input', { type: 'text', placeholder: '搜索消息…' });
  const applyFilter = () => {
    const level = levelSelect.value;
    const query = searchInput.value.trim().toLowerCase();
    for (const row of rows) {
      const okLevel = level === 'all' || row.dataset.level === level;
      const okQuery = !query || row.dataset.text.includes(query);
      row.hidden = !(okLevel && okQuery);
    }
  };
  levelSelect.addEventListener('change', applyFilter);
  searchInput.addEventListener('input', applyFilter);

  return h('div', { class: 'fcl-logs' }, [
    h('p', { class: 'fcl-muted', text: '插件运行日志（本会话，仅保留最近若干条）。点「刷新」拉取最新。' }),
    h('div', { class: 'fcl-form fcl-compact-form' }, [
      field('级别', levelSelect),
      field('搜索', searchInput),
    ]),
    actionbar([
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '刷新', onclick: () => refresh() }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '复制全部', onclick: () => navigator.clipboard?.writeText(entries.map(formatLine).join('\n')) }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '清空', onclick: () => { logger.clear(); refresh(); } }),
    ]),
    entries.length
      ? h('ul', { class: 'fcl-log-list' }, rows)
      : h('p', { class: 'fcl-muted', text: '暂无日志。' }),
  ]);
}
