import { createExampleState, exportStateJson } from './import-export.js';
import { undoLastOperation } from './ledger-actions.js';
import { clearLedgerState, readLedgerState, replaceLedgerState, writeLedgerState } from './storage.js';
import { h, submitWithStatus } from './ui/dom.js';
import { renderAbilities } from './ui/tabs/abilities.js';
import { renderContracts } from './ui/tabs/contracts.js';
import { renderData } from './ui/tabs/data.js';
import { renderDrafts } from './ui/tabs/drafts.js';
import { renderFinance } from './ui/tabs/finance.js';
import { renderMatches } from './ui/tabs/matches.js';
import { renderMisc } from './ui/tabs/misc.js';
import { renderOverview } from './ui/tabs/overview.js';
import { renderSeasons } from './ui/tabs/seasons.js';

const tabDefs = [
  ['overview', '概览'],
  ['drafts', '草稿'],
  ['matches', '比赛'],
  ['seasons', '赛季'],
  ['contracts', '合同'],
  ['finance', '财务'],
  ['abilities', '能力'],
  ['misc', '杂项'],
  ['data', '数据管理'],
];

export class LedgerUi {
  constructor(context, api, settings, actions) {
    this.context = context;
    this.api = api;
    this.settings = settings;
    this.actions = actions;
    this.activeTab = 'overview';
    this.root = null;
    this.editing = null;
    this.matchLimit = 50;
    this.lastImportBackup = null;
  }

  mount(root) {
    this.root = root;
    this.render();
  }

  async refresh() {
    await this.render();
  }

  setEditing(type, id) {
    this.editing = { type, id };
    this.render();
  }

  clearEditing() {
    this.editing = null;
    this.render();
  }

  async render() {
    if (!this.root) return;
    this.root.textContent = '';
    const container = h('div', { class: 'fcl-panel' });
    container.append(h('div', { class: 'fcl-toolbar' }, [
      h('strong', { text: '足球生涯账本' }),
      h('span', { 'data-fcl-status': '', class: 'fcl-status', text: '' }),
    ]));
    container.append(h('div', { class: 'fcl-tabs' }, tabDefs.map(([id, label]) => h('button', {
      type: 'button',
      class: `menu_button ${this.activeTab === id ? 'fcl-active' : ''}`,
      text: label,
      onclick: () => {
        this.activeTab = id;
        this.editing = null;
        this.render();
      },
    }))));
    const body = h('div', { class: 'fcl-body' });
    container.append(body);
    this.root.append(container);

    let state;
    try {
      state = await readLedgerState(this.context);
    } catch (error) {
      body.append(h('p', { class: 'fcl-error', text: `读不到当前聊天的数据：${error.message}` }));
      return;
    }

    const save = async (reducer) => {
      await submitWithStatus(container, '已保存', async () => {
        await writeLedgerState(this.context, reducer);
        await this.actions.updatePrompt();
        await this.render();
      });
    };

    const sharedActions = {
      settings: this.settings,
      editing: this.editing,
      matchLimit: this.matchLimit,
      lastImportBackup: this.lastImportBackup,
      setImportBackup: (backup) => {
        this.lastImportBackup = backup;
      },
      save,
      setEditing: (type, id) => this.setEditing(type, id),
      clearEditing: () => this.clearEditing(),
      undo: () => save((draft) => undoLastOperation(draft)),
      exportJson: async () => {
        const current = await readLedgerState(this.context);
        this.context.download(exportStateJson(current), `football-career-ledger-${Date.now()}.json`, 'application/json');
      },
      downloadExample: () => this.context.download(exportStateJson(createExampleState()), 'football-career-ledger-example.json', 'application/json'),
      clearData: async () => {
        if (!confirm('确认清空这个聊天的账本数据？别的聊天不受影响。')) return;
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

    const renderers = {
      overview: () => renderOverview(state, sharedActions),
      drafts: () => renderDrafts(state, sharedActions),
      matches: () => renderMatches(state, sharedActions),
      seasons: () => renderSeasons(state, sharedActions),
      contracts: () => renderContracts(state, sharedActions),
      finance: () => renderFinance(state, sharedActions),
      abilities: () => renderAbilities(state, sharedActions),
      misc: () => renderMisc(state, sharedActions),
      data: () => renderData(state, sharedActions),
    };
    body.append(renderers[this.activeTab]());
  }
}
