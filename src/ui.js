import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  CONTRACT_TYPES,
  DEFAULT_SETTINGS,
  EXTENSION_ID,
  FINANCE_CATEGORIES,
  HOME_AWAY_VALUES,
  TRANSACTION_TYPES,
  WAGE_PERIODS,
} from './constants.js';
import { createExampleState, exportStateJson, parseImportJson, buildImportSummary } from './import-export.js';
import { buildPromptSummary } from './prompt.js';
import { createId, readLedgerState, replaceLedgerState, clearLedgerState, writeLedgerState, upsertById } from './storage.js';
import {
  getAbilities,
  getActiveContract,
  getCurrentSeason,
  getFinanceSummary,
  getMiscellaneous,
  queryMatches,
  queryTransactions,
  summarizeSeason,
} from './selectors.js';

const tabDefs = [
  ['overview', '概览'],
  ['matches', '比赛'],
  ['contracts', '合同'],
  ['finance', '财务'],
  ['abilities', '能力'],
  ['misc', '杂项'],
  ['data', '数据管理'],
];

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'type') el.type = value;
    else if (key === 'value') el.value = value ?? '';
    else if (key === 'checked') el.checked = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) el.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

function field(label, input) {
  return h('label', { class: 'fcl-field' }, [h('span', { text: label }), input]);
}

function input(name, value = '', attrs = {}) {
  return h('input', { name, value, ...attrs });
}

function textarea(name, value = '', attrs = {}) {
  return h('textarea', { name, ...attrs }, value ?? '');
}

function select(name, value, options) {
  const el = h('select', { name });
  for (const option of options) {
    const opt = h('option', { value: option.value ?? option, text: option.label ?? option });
    opt.selected = (option.value ?? option) === value;
    el.append(opt);
  }
  return el;
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value) {
  return value === 'on' || value === 'true' || value === true;
}

function optionsFromRows(rows, emptyLabel = '未选择') {
  return [{ value: '', label: emptyLabel }, ...rows.map((row) => ({ value: row.id, label: row.label || row.id }))];
}

function setStatus(root, message, kind = 'info') {
  const status = root.querySelector('[data-fcl-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

async function submitWithStatus(root, message, action) {
  try {
    await action();
    setStatus(root, message, 'success');
  } catch (error) {
    console.error('[football-career-ledger]', error);
    setStatus(root, error.message || String(error), 'error');
  }
}

function renderSummaryCards(state) {
  const season = getCurrentSeason(state);
  const summary = summarizeSeason(state, season?.id);
  const contract = getActiveContract(state);
  const finance = getFinanceSummary(state);
  const abilities = getAbilities(state);
  const recent = queryMatches(state, { seasonId: season?.id, limit: 3 });
  const grid = h('div', { class: 'fcl-summary-grid' });
  const cards = [
    ['球员', `${state.player.name || '未命名'} / ${state.player.primaryPosition || '未填写位置'}`],
    ['球队', state.player.currentClub || season?.club || '未填写'],
    ['当前赛季', season ? `${season.label || season.id}：${summary.appearances}场 ${summary.goals}球 ${summary.assists}助` : '未设置'],
    ['活动合同', contract ? `${contract.club} ${contract.wageAmountMinor} ${contract.wageCurrency}/${contract.wagePeriod}` : '无'],
    ['余额', finance.balances.length ? finance.balances.map((row) => `${row.currency} ${row.amountMinor}`).join('；') : '无'],
    ['能力', ABILITY_KEYS.map((key) => `${ABILITY_LABELS[key]}${abilities[key]}`).join(' / ')],
  ];
  for (const [title, body] of cards) {
    grid.append(h('section', { class: 'fcl-card' }, [h('h4', { text: title }), h('p', { text: body })]));
  }
  grid.append(h('section', { class: 'fcl-card fcl-wide' }, [
    h('h4', { text: '最近三场比赛' }),
    recent.length ? h('ul', {}, recent.map((match) => h('li', { text: `${match.date} ${match.opponent} ${match.goalsFor}-${match.goalsAgainst}` }))) : h('p', { text: '暂无比赛' }),
  ]));
  return grid;
}

function playerSeasonForm(state, save) {
  const form = h('form', { class: 'fcl-form' }, [
    field('球员姓名', input('name', state.player.name)),
    field('当前球队', input('currentClub', state.player.currentClub)),
    field('主要位置', input('primaryPosition', state.player.primaryPosition)),
    field('默认币种', input('defaultCurrency', state.player.defaultCurrency)),
    field('赛季ID', input('seasonId', state.player.currentSeasonId || '1998-99')),
    field('赛季标签', input('seasonLabel', getCurrentSeason(state)?.label || '1998/99')),
    field('赛季球队', input('seasonClub', getCurrentSeason(state)?.club || state.player.currentClub)),
    h('button', { type: 'submit', class: 'menu_button', text: '保存概览' }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(form);
    await save((draft) => {
      const seasonId = String(data.seasonId || '').trim();
      draft.player = {
        ...draft.player,
        name: String(data.name || ''),
        currentClub: String(data.currentClub || ''),
        primaryPosition: String(data.primaryPosition || ''),
        defaultCurrency: String(data.defaultCurrency || 'DEM').trim() || 'DEM',
        currentSeasonId: seasonId,
      };
      if (seasonId) {
        const season = {
          id: seasonId,
          label: String(data.seasonLabel || seasonId),
          club: String(data.seasonClub || data.currentClub || ''),
          startedAt: getCurrentSeason(draft)?.startedAt || '1998-07-01',
          endedAt: null,
          status: 'active',
          notes: '',
        };
        draft.seasons = draft.seasons.map((row) => row.id === seasonId ? { ...row, ...season } : { ...row, status: row.status === 'active' ? 'completed' : row.status });
        if (!draft.seasons.some((row) => row.id === seasonId)) draft.seasons.unshift(season);
      }
      return draft;
    });
  });
  return form;
}

function renderOverview(state, save) {
  return h('div', {}, [renderSummaryCards(state), h('h3', { text: '基础资料' }), playerSeasonForm(state, save)]);
}

function renderMatches(state, save) {
  const currentSeason = getCurrentSeason(state);
  const list = queryMatches(state, { limit: 50 });
  const form = h('form', { class: 'fcl-form' }, [
    field('赛季', select('seasonId', currentSeason?.id || '', optionsFromRows(state.seasons, '请选择赛季'))),
    field('日期', input('date', new Date().toISOString().slice(0, 10), { type: 'date' })),
    field('赛事', input('competition', '')),
    field('球队', input('club', state.player.currentClub || currentSeason?.club || '')),
    field('对手', input('opponent', '')),
    field('主客场', select('homeAway', 'home', HOME_AWAY_VALUES)),
    field('进球', input('goalsFor', '0', { type: 'number', min: '0' })),
    field('失球', input('goalsAgainst', '0', { type: 'number', min: '0' })),
    field('首发', h('input', { name: 'started', type: 'checkbox' })),
    field('分钟', input('minutes', '0', { type: 'number', min: '0', max: '130' })),
    field('个人进球', input('goals', '0', { type: 'number', min: '0' })),
    field('助攻', input('assists', '0', { type: 'number', min: '0' })),
    field('黄牌', input('yellowCards', '0', { type: 'number', min: '0' })),
    field('红牌', input('redCards', '0', { type: 'number', min: '0' })),
    field('评分', input('rating', '', { type: 'number', min: '0', max: '10', step: '0.1' })),
    field('重要比赛', h('input', { name: 'notable', type: 'checkbox' })),
    field('备注', textarea('notes')),
    h('button', { type: 'submit', class: 'menu_button', text: '新增比赛' }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(form);
    await save((draft) => {
      draft.matches = upsertById(draft.matches, {
        id: createId('match'),
        seasonId: String(data.seasonId || ''),
        date: String(data.date || ''),
        competition: String(data.competition || ''),
        club: String(data.club || ''),
        opponent: String(data.opponent || ''),
        homeAway: String(data.homeAway || 'home'),
        goalsFor: numberValue(data.goalsFor),
        goalsAgainst: numberValue(data.goalsAgainst),
        started: boolValue(data.started),
        minutes: numberValue(data.minutes),
        goals: numberValue(data.goals),
        assists: numberValue(data.assists),
        yellowCards: numberValue(data.yellowCards),
        redCards: numberValue(data.redCards),
        rating: data.rating === '' ? null : numberValue(data.rating),
        notable: boolValue(data.notable),
        notes: String(data.notes || ''),
      });
      return draft;
    });
    form.reset();
  });

  const rows = list.map((match) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${match.date} ${match.competition} ${match.opponent} ${match.goalsFor}-${match.goalsAgainst}` }),
    h('button', {
      type: 'button',
      class: 'menu_button fcl-small',
      text: '删除',
      onclick: () => {
        if (!confirm('确认删除这场比赛？')) return;
        save((draft) => ({ ...draft, matches: draft.matches.filter((row) => row.id !== match.id) }));
      },
    }),
  ]));
  return h('div', {}, [h('h3', { text: '新增比赛' }), form, h('h3', { text: '最近比赛' }), h('ul', { class: 'fcl-list' }, rows)]);
}

function renderContracts(state, save) {
  const form = h('form', { class: 'fcl-form' }, [
    field('俱乐部', input('club', state.player.currentClub)),
    field('类型', select('contractType', 'youth', CONTRACT_TYPES)),
    field('开始日期', input('startDate', new Date().toISOString().slice(0, 10), { type: 'date' })),
    field('结束日期', input('endDate', '', { type: 'date' })),
    field('薪资最小单位', input('wageAmountMinor', '0', { type: 'number', min: '1' })),
    field('币种', input('wageCurrency', state.player.defaultCurrency || 'DEM')),
    field('周期', select('wagePeriod', 'weekly', WAGE_PERIODS)),
    field('设为活动合同', h('input', { name: 'active', type: 'checkbox' })),
    field('奖金', textarea('bonuses')),
    field('条款', textarea('clauses')),
    field('备注', textarea('notes')),
    h('button', { type: 'submit', class: 'menu_button', text: '新增合同' }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(form);
    await save((draft) => {
      const active = boolValue(data.active);
      if (active && draft.contracts.some((row) => row.active) && !confirm('已有活动合同。是否停用原活动合同并启用新合同？')) {
        return draft;
      }
      if (active) draft.contracts = draft.contracts.map((row) => ({ ...row, active: false }));
      draft.contracts.unshift({
        id: createId('contract'),
        club: String(data.club || ''),
        contractType: String(data.contractType || 'other'),
        startDate: String(data.startDate || ''),
        endDate: data.endDate ? String(data.endDate) : null,
        wageAmountMinor: numberValue(data.wageAmountMinor),
        wageCurrency: String(data.wageCurrency || ''),
        wagePeriod: String(data.wagePeriod || 'weekly'),
        bonuses: String(data.bonuses || ''),
        clauses: String(data.clauses || ''),
        active,
        notes: String(data.notes || ''),
      });
      return draft;
    });
    form.reset();
  });

  const rows = state.contracts.map((contract) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${contract.active ? '活动：' : ''}${contract.club} ${contract.startDate} - ${contract.endDate || '未定'} ${contract.wageAmountMinor} ${contract.wageCurrency}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: contract.active ? '停用' : '启用', onclick: () => save((draft) => ({ ...draft, contracts: draft.contracts.map((row) => ({ ...row, active: row.id === contract.id ? !contract.active : false })) })) }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该合同？') && save((draft) => ({ ...draft, contracts: draft.contracts.filter((row) => row.id !== contract.id) })) }),
  ]));
  return h('div', {}, [form, h('ul', { class: 'fcl-list' }, rows)]);
}

function renderFinance(state, save) {
  const balances = getFinanceSummary(state).balances;
  const balanceForm = h('form', { class: 'fcl-form fcl-compact-form' }, [
    field('币种', input('currency', state.player.defaultCurrency || 'DEM')),
    field('期初余额', input('amountMinor', '0', { type: 'number' })),
    h('button', { type: 'submit', class: 'menu_button', text: '设置期初余额' }),
  ]);
  balanceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(balanceForm);
    await save((draft) => {
      const currency = String(data.currency || '').trim();
      draft.finance.openingBalances = [
        ...draft.finance.openingBalances.filter((row) => row.currency !== currency),
        { currency, amountMinor: numberValue(data.amountMinor) },
      ];
      return draft;
    });
  });

  const transactionForm = h('form', { class: 'fcl-form' }, [
    field('日期', input('date', new Date().toISOString().slice(0, 10), { type: 'date' })),
    field('类型', select('type', 'income', TRANSACTION_TYPES)),
    field('类别', select('category', 'salary', FINANCE_CATEGORIES)),
    field('金额最小单位', input('amountMinor', '1', { type: 'number', min: '1' })),
    field('币种', input('currency', state.player.defaultCurrency || 'DEM')),
    field('说明', input('description', '')),
    field('备注', textarea('notes')),
    h('button', { type: 'submit', class: 'menu_button', text: '新增流水' }),
  ]);
  transactionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(transactionForm);
    await save((draft) => {
      draft.finance.transactions.unshift({
        id: createId('transaction'),
        date: String(data.date || ''),
        type: String(data.type || 'income'),
        category: String(data.category || 'other'),
        amountMinor: numberValue(data.amountMinor),
        currency: String(data.currency || ''),
        description: String(data.description || ''),
        relatedContractId: null,
        notes: String(data.notes || ''),
      });
      return draft;
    });
    transactionForm.reset();
  });

  const rows = queryTransactions(state, { limit: 50 }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.type} ${row.category} ${row.amountMinor} ${row.currency} ${row.description}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该流水？') && save((draft) => ({ ...draft, finance: { ...draft.finance, transactions: draft.finance.transactions.filter((item) => item.id !== row.id) } })) }),
  ]));
  return h('div', {}, [
    h('h3', { text: '余额' }),
    h('p', { text: balances.length ? balances.map((row) => `${row.currency}: ${row.amountMinor}`).join('；') : '暂无余额' }),
    balanceForm,
    h('h3', { text: '流水' }),
    transactionForm,
    h('ul', { class: 'fcl-list' }, rows),
  ]);
}

function renderAbilities(state, save) {
  const abilities = getAbilities(state);
  const form = h('form', { class: 'fcl-form' }, [
    ...ABILITY_KEYS.map((key) => field(ABILITY_LABELS[key], input(key, String(abilities[key]), { type: 'number', min: '0', max: '99' }))),
    field('变更原因', input('reason', '手动调整')),
    h('button', { type: 'submit', class: 'menu_button', text: '保存能力并记录变化' }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(form);
    await save((draft) => {
      for (const key of ABILITY_KEYS) {
        const before = draft.abilities.current[key] ?? 0;
        const after = numberValue(data[key]);
        if (before !== after) {
          draft.abilities.history.unshift({
            id: createId('ability'),
            date: new Date().toISOString().slice(0, 10),
            ability: key,
            before,
            after,
            reason: String(data.reason || ''),
            notes: '',
          });
          draft.abilities.current[key] = after;
        }
      }
      return draft;
    });
  });
  const history = state.abilities.history.slice(0, 20).map((row) => h('li', { text: `${row.date} ${ABILITY_LABELS[row.ability]} ${row.before} -> ${row.after} ${row.reason || ''}` }));
  return h('div', {}, [form, h('h3', { text: '最近变化' }), h('ul', { class: 'fcl-list' }, history)]);
}

function renderMisc(state, save) {
  const form = h('form', { class: 'fcl-form' }, [
    field('日期', input('date', new Date().toISOString().slice(0, 10), { type: 'date' })),
    field('键', input('key', '')),
    field('值', input('value', '')),
    field('标签（逗号分隔）', input('tags', '')),
    field('备注', textarea('notes')),
    h('button', { type: 'submit', class: 'menu_button', text: '新增杂项' }),
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(form);
    await save((draft) => {
      draft.miscellaneous.unshift({
        id: createId('misc'),
        date: String(data.date || ''),
        key: String(data.key || ''),
        value: String(data.value || ''),
        tags: String(data.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: String(data.notes || ''),
      });
      return draft;
    });
    form.reset();
  });
  const rows = getMiscellaneous(state, { limit: 50 }).map((row) => h('li', { class: 'fcl-list-row' }, [
    h('span', { text: `${row.date} ${row.key}=${row.value} ${row.tags.join(', ')}` }),
    h('button', { type: 'button', class: 'menu_button fcl-small', text: '删除', onclick: () => confirm('确认删除该杂项？') && save((draft) => ({ ...draft, miscellaneous: draft.miscellaneous.filter((item) => item.id !== row.id) })) }),
  ]));
  return h('div', {}, [form, h('ul', { class: 'fcl-list' }, rows)]);
}

function renderData(state, actions) {
  const importBox = textarea('importJson', '', { class: 'fcl-import-box', placeholder: '粘贴完整 JSON 后点击导入' });
  const selfCheckResult = h('pre', { class: 'fcl-pre' });
  const summaryText = h('pre', { class: 'fcl-pre' }, buildPromptSummary(state, actions.settings));
  return h('div', { class: 'fcl-data-tools' }, [
    h('div', { class: 'fcl-actionbar' }, [
      h('button', { type: 'button', class: 'menu_button', text: '导出JSON', onclick: actions.exportJson }),
      h('button', { type: 'button', class: 'menu_button', text: '示例数据', onclick: actions.downloadExample }),
      h('button', { type: 'button', class: 'menu_button', text: '清空本聊天', onclick: actions.clearData }),
      h('button', { type: 'button', class: 'menu_button', text: 'API自检', onclick: async () => { selfCheckResult.textContent = JSON.stringify(await actions.selfCheck(), null, 2); } }),
    ]),
    h('h3', { text: '导入JSON' }),
    importBox,
    h('button', {
      type: 'button',
      class: 'menu_button',
      text: '解析并导入',
      onclick: async () => {
        const nextState = parseImportJson(importBox.value);
        const summary = buildImportSummary(nextState);
        if (!confirm(`确认导入？\n${JSON.stringify(summary, null, 2)}`)) return;
        await actions.importState(nextState);
      },
    }),
    h('h3', { text: '当前摘要预览' }),
    summaryText,
    h('h3', { text: 'API自检结果' }),
    selfCheckResult,
  ]);
}

export class LedgerUi {
  constructor(context, api, settings, actions) {
    this.context = context;
    this.api = api;
    this.settings = settings;
    this.actions = actions;
    this.activeTab = 'overview';
    this.root = null;
  }

  mount(root) {
    this.root = root;
    this.render();
  }

  async refresh() {
    await this.render();
  }

  async render() {
    if (!this.root) return;
    this.root.textContent = '';
    const container = h('div', { class: 'fcl-panel' });
    container.append(h('div', { class: 'fcl-toolbar' }, [
      h('strong', { text: '足球生涯账本' }),
      h('span', { 'data-fcl-status': '', class: 'fcl-status', text: '' }),
    ]));
    const tabs = h('div', { class: 'fcl-tabs' }, tabDefs.map(([id, label]) => h('button', {
      type: 'button',
      class: `menu_button ${this.activeTab === id ? 'fcl-active' : ''}`,
      text: label,
      onclick: () => {
        this.activeTab = id;
        this.render();
      },
    })));
    container.append(tabs);
    const body = h('div', { class: 'fcl-body' });
    container.append(body);
    this.root.append(container);

    let state;
    try {
      state = await readLedgerState(this.context);
    } catch (error) {
      body.append(h('p', { class: 'fcl-error', text: `无法读取当前聊天数据：${error.message}` }));
      return;
    }

    const save = async (reducer) => {
      await submitWithStatus(container, '已保存', async () => {
        await writeLedgerState(this.context, reducer);
        await this.actions.updatePrompt();
        await this.render();
      });
    };

    const dataActions = {
      settings: this.settings,
      exportJson: async () => {
        const current = await readLedgerState(this.context);
        this.context.download(exportStateJson(current), `football-career-ledger-${Date.now()}.json`, 'application/json');
      },
      downloadExample: () => this.context.download(exportStateJson(createExampleState()), 'football-career-ledger-example.json', 'application/json'),
      clearData: async () => {
        if (!confirm('确认清空当前聊天的足球生涯账本数据？此操作不会影响其他聊天。')) return;
        await clearLedgerState(this.context);
        await this.actions.updatePrompt();
        await this.render();
      },
      importState: async (nextState) => {
        await submitWithStatus(container, '导入完成', async () => {
          await replaceLedgerState(this.context, nextState);
          await this.actions.updatePrompt();
          await this.render();
        });
      },
      selfCheck: this.actions.selfCheck,
    };

    const content = {
      overview: () => renderOverview(state, save),
      matches: () => renderMatches(state, save),
      contracts: () => renderContracts(state, save),
      finance: () => renderFinance(state, save),
      abilities: () => renderAbilities(state, save),
      misc: () => renderMisc(state, save),
      data: () => renderData(state, dataActions),
    }[this.activeTab]();
    body.append(content);
  }
}
