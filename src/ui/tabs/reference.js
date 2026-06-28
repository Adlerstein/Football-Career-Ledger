// "球探资料" tab — the Football Reference Scout subsystem rendered inside the
// ledger panel. Read-only football reference lookup: manage datasets, set the
// lookup profile, preview the turn capsule, and arm a one-shot prompt injection.
// All state lives in the reference subsystem (actions.reference), separate from
// the chat-scoped ledger state.

import { actionbar, card, field, h } from '../dom.js';
import { getSeasonTemplateRows } from '../../season-utils.js';

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function downloadJson(context, value, filename) {
  const text = JSON.stringify(value, null, 2);
  if (typeof context?.download === 'function') {
    context.download(text, filename, 'application/json');
    return;
  }
  const blob = new Blob([text], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- date helpers: year/month/day selects compose to YYYY-MM-DD ---
function pad2(value) {
  return String(value).padStart(2, '0');
}
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function range(start, end) {
  const out = [];
  for (let value = start; value <= end; value += 1) out.push(value);
  return out;
}
function parseDateParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? { y: String(Number(match[1])), mo: String(Number(match[2])), d: String(Number(match[3])) }
    : { y: '', mo: '', d: '' };
}

export async function renderReference(state, actions) {
  const ref = actions.reference;
  if (!ref?.api) {
    return h('p', { class: 'fcl-muted', text: '资料子系统未初始化（当前宿主可能不支持）。' });
  }
  const { api, injection, settings, view, context } = ref;
  const refresh = () => ref.refresh();
  const setStatus = (message) => { view.statusText = message; };
  if (!view.dateParts) view.dateParts = parseDateParts(settings.currentDate);

  const [datasets, status] = await Promise.all([
    safe(() => api.listDatasets(), []),
    safe(() => api.getReferenceStatus(), null),
  ]);

  const armed = Boolean(settings.nextInjectionArmed);

  // --- settings ---
  const enableRow = h('label', { class: 'checkbox_label' }, [
    h('input', {
      type: 'checkbox',
      checked: settings.enabled,
      onchange: (event) => { settings.enabled = event.target.checked; ref.saveSettings(); refresh(); },
    }),
    '启用资料参考',
  ]);
  const numberField = (label, key, attrs, fallback) => field(label, h('input', {
    type: 'number',
    value: String(settings[key] ?? fallback),
    ...attrs,
    onchange: (event) => { settings[key] = Number(event.target.value || fallback); ref.saveSettings(); refresh(); },
  }));
  const settingsCard = card('设置', h('div', {}, [
    enableRow,
    h('div', { class: 'fcl-form fcl-compact-form' }, [
      numberField('附近天数', 'nearbyDays', { min: '0', max: '14' }, 0),
      numberField('最大注入字符', 'promptMaxChars', { min: '500', max: '10000', step: '100' }, 2000),
    ]),
  ]));

  // --- dataset library ---
  const datasetSelect = h('select', {
    onchange: (event) => { api.updateActiveProfile({ activeDatasetId: event.target.value }); setStatus(''); refresh(); },
  }, [
    h('option', { value: '', text: datasets.length ? '内置样例或未选择' : '内置样例' }),
    ...datasets.map((dataset) => {
      const option = h('option', {
        value: dataset.datasetId,
        text: `${dataset.title || dataset.datasetId}（${dataset.matchCount || 0} 场）`,
      });
      option.selected = String(dataset.datasetId) === String(settings.activeDatasetId || '');
      return option;
    }),
  ]);
  const importLabel = h('label', { class: 'menu_button fcl-small fcl-file-button' }, [
    '导入 JSON',
    h('input', {
      type: 'file',
      accept: '.json,application/json',
      style: 'display:none',
      onchange: async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
          const dataset = JSON.parse(await file.text());
          const imported = await api.importDatasetFromJson(dataset);
          setStatus(`已导入：${imported.title || imported.datasetId}`);
        } catch (error) {
          setStatus(`导入失败：${error.message}`);
        }
        refresh();
      },
    }),
  ]);
  const datasetCard = card('资料库', h('div', {}, [
    h('p', { class: 'fcl-muted', text: status?.title
      ? `${status.title}：${status.matchCount || 0} 场比赛 / ${status.eventCount || 0} 事件 / ${status.lineupCount || 0} 阵容`
      : '未加载资料库，导入标准 JSON 后可用。' }),
    field('当前资料库', datasetSelect),
  ]), [
    importLabel,
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '导出当前', onclick: async () => {
      const id = settings.activeDatasetId;
      if (!id) { setStatus('当前是内置样例，无外部资料可导出。'); refresh(); return; }
      const dataset = await safe(() => api.exportDataset(id), null);
      if (!dataset) { setStatus('找不到当前资料库。'); refresh(); return; }
      downloadJson(context, dataset, `football-reference-${id}.json`);
      setStatus('已导出当前资料。'); refresh();
    } }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除当前', onclick: async () => {
      const id = settings.activeDatasetId;
      if (!id) { setStatus('当前没有选中的外部资料库。'); refresh(); return; }
      if (!confirm(`删除资料库 ${id}？`)) return;
      await safe(() => api.deleteDataset(id), false);
      view.preview = null;
      setStatus('已删除资料库。'); refresh();
    } }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '自检', onclick: async () => {
      const result = await safe(() => api.getReferenceStatus(), null);
      setStatus(result ? `自检通过：${result.title || result.datasetId}，${result.matchCount || 0} 场比赛。` : '自检失败：读不到资料库。');
      refresh();
    } }),
  ]);

  // --- lookup profile: team text, season select, year/month/day date pickers ---
  const seasonSelect = h('select', {
    onchange: (event) => { api.updateActiveProfile({ seasonId: event.target.value }); refresh(); },
  }, [
    (() => { const option = h('option', { value: '', text: '未选择' }); option.selected = !settings.currentSeasonId; return option; })(),
    ...getSeasonTemplateRows(1998, 2024).map((row) => {
      const option = h('option', { value: row.value, text: row.label });
      option.selected = String(row.value) === String(settings.currentSeasonId || '');
      return option;
    }),
  ]);

  const dateOption = (value, label, current) => {
    const option = h('option', { value, text: label });
    option.selected = String(value) === String(current ?? '');
    return option;
  };
  const parts = view.dateParts;
  const yNum = Number(parts.y);
  const moNum = Number(parts.mo);
  const maxDay = (Number.isInteger(yNum) && Number.isInteger(moNum)) ? daysInMonth(yNum, moNum) : 31;
  const composeDate = () => {
    const y = Number(view.dateParts.y);
    const mo = Number(view.dateParts.mo);
    let d = Number(view.dateParts.d);
    if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return '';
    const max = daysInMonth(y, mo);
    if (d > max) { d = max; view.dateParts.d = String(d); }
    return `${y}-${pad2(mo)}-${pad2(d)}`;
  };
  const onDatePart = (key, value) => {
    view.dateParts[key] = value;
    const y = Number(view.dateParts.y);
    const mo = Number(view.dateParts.mo);
    if (Number.isInteger(y) && Number.isInteger(mo) && Number(view.dateParts.d) > daysInMonth(y, mo)) {
      view.dateParts.d = String(daysInMonth(y, mo));
    }
    api.updateActiveProfile({ currentDate: composeDate() });
    refresh();
  };
  const dateRow = h('div', { class: 'fcl-date-row' }, [
    h('select', { onchange: (event) => onDatePart('y', event.target.value) },
      [dateOption('', '年', parts.y), ...range(1998, 2025).map((value) => dateOption(String(value), `${value}`, parts.y))]),
    h('select', { onchange: (event) => onDatePart('mo', event.target.value) },
      [dateOption('', '月', parts.mo), ...range(1, 12).map((value) => dateOption(String(value), `${value}月`, parts.mo))]),
    h('select', { onchange: (event) => onDatePart('d', event.target.value) },
      [dateOption('', '日', parts.d), ...range(1, maxDay).map((value) => dateOption(String(value), `${value}日`, parts.d))]),
  ]);
  const profileCard = card('查询档案', h('div', {}, [
    field('球队', h('input', {
      type: 'text',
      placeholder: 'Arsenal',
      value: settings.currentTeam || '',
      onchange: (event) => { api.updateActiveProfile({ team: event.target.value }); refresh(); },
    })),
    field('赛季', seasonSelect),
    field('当前日期', dateRow),
  ]));

  // --- turn reference / injection ---
  const previewText = view.preview
    ? JSON.stringify(view.preview, null, 2)
    : '点击「预览本轮参考」查看将注入给 AI 的短资料。';
  const turnCard = card('本轮参考', h('div', {}, [
    actionbar([
      h('button', { type: 'button', class: 'menu_button', text: '预览本轮参考', onclick: async () => {
        view.preview = await safe(() => injection.previewNextCapsule(), null);
        setStatus(view.preview ? '预览已更新。' : '预览失败。');
        refresh();
      } }),
      h('button', {
        type: 'button',
        class: armed ? 'menu_button fcl-small' : 'menu_button',
        text: armed ? '取消下一次注入' : '下一次生成注入参考',
        onclick: async () => {
          if (armed) {
            injection.disarmNextInjection();
            setStatus('已取消下一次注入。');
          } else {
            view.preview = await safe(() => injection.armNextInjection(), null);
            setStatus('已准备：下一次生成会注入这份参考。');
          }
          refresh();
        },
      }),
      h('button', { type: 'button', class: 'menu_button fcl-small', text: '清空当前注入', onclick: () => {
        injection.clearIfInjected();
        view.preview = null;
        setStatus('已清空当前注入。');
        refresh();
      } }),
      h('span', { class: `fcl-ref-pill${armed ? ' fcl-ref-pill-live' : ''}`, text: armed ? '下一次生成会注入' : '待命' }),
    ]),
    h('pre', { class: 'fcl-pre', text: previewText }),
  ]));

  return h('div', { class: 'fcl-reference' }, [
    h('p', { class: 'fcl-muted', text: '只读足球资料库，供叙事参考；不写账本、MVU、世界书或赛季状态。' }),
    h('div', { class: 'fcl-summary-grid' }, [settingsCard, datasetCard, profileCard]),
    turnCard,
    view.statusText ? h('p', { class: 'fcl-status', 'data-kind': 'info', text: view.statusText }) : null,
  ]);
}
