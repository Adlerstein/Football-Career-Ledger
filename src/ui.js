import { createExampleState, exportStateJson } from './import-export.js';
import { undoLastOperation } from './ledger-actions.js';
import { clearLedgerState, readLedgerState, replaceLedgerState, writeLedgerState } from './storage.js';
import { h, submitWithStatus, detectThemeMode } from './ui/dom.js';
import { renderAbilities } from './ui/tabs/abilities.js';
import { renderContracts } from './ui/tabs/contracts.js';
import { renderData } from './ui/tabs/data.js';
import { renderDrafts } from './ui/tabs/drafts.js';
import { renderFinance } from './ui/tabs/finance.js';
import { renderMatches } from './ui/tabs/matches.js';
import { renderMisc } from './ui/tabs/misc.js';
import { renderOverview } from './ui/tabs/overview.js';
import { renderReference } from './ui/tabs/reference.js';
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
  ['reference', '球探资料'],
  ['data', '数据管理'],
];

// Nearest scrollable ancestor, so a re-render can preserve the scroll position
// instead of letting the panel jump to the top.
function getScrollParent(node) {
  let el = node?.parentElement;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

export class LedgerUi {
  constructor(context, api, settings, actions, reference = null) {
    this.context = context;
    this.api = api;
    this.settings = settings;
    this.actions = actions;
    this.reference = reference;
    this.referenceView = { statusText: '', preview: null };
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
    // Skip rebuilding the panel while it is collapsed/hidden: generation, MVU
    // sync and chat-change events all call render(), and doing the full DOM +
    // selector work for an invisible panel is wasted battery on mobile. The
    // open handler re-renders once the panel is shown.
    if (this.root.hidden) return;
    // Build the new panel off-DOM and swap it in atomically at the end. The panel
    // never collapses to empty mid-render, so the scroll position is preserved.
    const scroller = getScrollParent(this.root);
    const prevScrollTop = scroller ? scroller.scrollTop : 0;
    const container = h('div', { class: 'fcl-panel' });
    container.dataset.fclTheme = detectThemeMode();
    container.append(h('div', { class: 'fcl-toolbar' }, [
      h('strong', { class: 'fcl-title', text: '绿茵生涯账册' }),
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

    let state;
    try {
      state = await readLedgerState(this.context);
    } catch (error) {
      body.append(h('p', { class: 'fcl-error', text: `读不到当前聊天的数据：${error.message}` }));
      this.root.replaceChildren(container);
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
      reference: this.reference ? {
        ...this.reference,
        view: this.referenceView,
        context: this.context,
        refresh: () => this.render(),
      } : null,
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
      reference: () => renderReference(state, sharedActions),
      data: () => renderData(state, sharedActions),
    };
    body.append(await renderers[this.activeTab]());
    this.root.replaceChildren(container);
    if (scroller) scroller.scrollTop = prevScrollTop;
  }
}
