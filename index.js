import { DEFAULT_SETTINGS, EXTENSION_ID, PROMPT_KEY } from './src/constants.js';
import { logger } from './src/logger.js';
import { buildPromptSummary } from './src/prompt.js';
import { createPublicApi, runApiSelfCheck } from './src/public-api.js';
import { resolveHostContext } from './src/host-context.js';
import { copyBranchState, readLedgerState, writeLedgerState } from './src/storage.js';
import { createMessageIngestor, resolveMessageId } from './src/message-ingest.js';
import { LedgerUi } from './src/ui.js';
import { ensureSettings as ensureReferenceSettings, saveSettings as persistReferenceSettings } from './src/reference/settings.js';
import { createDatasetStore } from './src/reference/storage.js';
import { createPublicApi as createReferenceApi } from './src/reference/public-api.js';
import { createInjectionController as createReferenceInjection } from './src/reference/injection.js';
import { registerOrchestratorTools as registerReferenceOrchestratorTools } from './src/reference/orchestrator-tools.js';
import { createMvuTimeSync, getLastUserMessage } from './src/reference/mvu-time.js';
import { EXTENSION_ID as REFERENCE_EXTENSION_ID } from './src/reference/constants.js';

let context = null;
let api = null;
let ui = null;
let settings = null;
let ingestor = null;
let referenceApi = null;
let referenceSettings = null;
let referenceInjection = null;
let mvuTimeSync = null;
const PROMPT_IN_CHAT_DEPTH = 1;
const processedMessageKeys = new Set();

function getSettings() {
  context.extensionSettings[EXTENSION_ID] = {
    ...DEFAULT_SETTINGS,
    ...(context.extensionSettings[EXTENSION_ID] || {}),
  };
  settings = context.extensionSettings[EXTENSION_ID];
  return settings;
}

function saveSettings() {
  context.extensionSettings[EXTENSION_ID] = settings;
  context.saveSettingsDebounced?.();
}

async function updatePromptInjection() {
  if (!context?.setExtensionPrompt) return;
  const promptTypes = context.constants?.promptTypes || { IN_CHAT: 1, NONE: 0 };
  const promptRoles = context.constants?.promptRoles || { SYSTEM: 0 };

  if (!settings.enabled || !settings.promptInjectionEnabled) {
    context.setExtensionPrompt(PROMPT_KEY, '', promptTypes.NONE, 0, false, promptRoles.SYSTEM);
    return;
  }

  try {
    const state = await readLedgerState(context);
    const summary = buildPromptSummary(state, settings);
    context.setExtensionPrompt(PROMPT_KEY, summary, promptTypes.IN_CHAT, PROMPT_IN_CHAT_DEPTH, false, promptRoles.SYSTEM);
  } catch (error) {
    logger.error('更新提示词摘要失败', error);
    context.setExtensionPrompt(PROMPT_KEY, '', promptTypes.NONE, 0, false, promptRoles.SYSTEM);
  }
}

function applySettingsToForm(root) {
  root.querySelector('#fcl_enabled').checked = Boolean(settings.enabled);
  root.querySelector('#fcl_prompt_injection').checked = Boolean(settings.promptInjectionEnabled);
  root.querySelector('#fcl_prompt_preset').value = settings.promptPreset || 'standard';
  root.querySelector('#fcl_prompt_max_chars').value = String(settings.promptMaxChars);
  root.querySelector('#fcl_recent_match_limit').value = String(settings.recentMatchLimit);
  root.querySelector('#fcl_include_contracts').checked = Boolean(settings.includeContracts);
  root.querySelector('#fcl_include_finance').checked = Boolean(settings.includeFinance);
  root.querySelector('#fcl_include_abilities').checked = Boolean(settings.includeAbilities);
  root.querySelector('#fcl_include_miscellaneous').checked = Boolean(settings.includeMiscellaneous);
  syncPanelVisibility(root);
}

function syncPanelVisibility(root = document) {
  const panel = root.querySelector('#fcl_manager_panel') || document.querySelector('#fcl_manager_panel');
  const button = root.querySelector('#fcl_open_panel') || document.querySelector('#fcl_open_panel');
  const isOpen = Boolean(settings.panelOpen);
  if (panel) {
    panel.hidden = !isOpen;
  }
  if (button) {
    button.textContent = isOpen ? '收起账本面板' : '打开账本面板';
    button.setAttribute('aria-expanded', String(isOpen));
  }
}

function bindSettings(root) {
  const updateSetting = () => {
    settings.enabled = root.querySelector('#fcl_enabled').checked;
    settings.promptInjectionEnabled = root.querySelector('#fcl_prompt_injection').checked;
    settings.promptPreset = root.querySelector('#fcl_prompt_preset').value || 'standard';
    settings.promptMaxChars = Math.max(100, Math.min(10000, Number(root.querySelector('#fcl_prompt_max_chars').value || 2000)));
    settings.recentMatchLimit = Math.max(0, Math.min(10, Number(root.querySelector('#fcl_recent_match_limit').value || 3)));
    settings.includeContracts = root.querySelector('#fcl_include_contracts').checked;
    settings.includeFinance = root.querySelector('#fcl_include_finance').checked;
    settings.includeAbilities = root.querySelector('#fcl_include_abilities').checked;
    settings.includeMiscellaneous = root.querySelector('#fcl_include_miscellaneous').checked;
    saveSettings();
    updatePromptInjection();
    ui?.refresh();
  };

  root.querySelectorAll('input, select').forEach((element) => {
    element.addEventListener('change', updateSetting);
  });

  root.querySelector('#fcl_open_panel').addEventListener('click', () => {
    settings.panelOpen = !settings.panelOpen;
    saveSettings();
    syncPanelVisibility(root);
    if (settings.panelOpen) {
      ui?.refresh();
      root.querySelector('#fcl_manager_panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

function getIngestor() {
  if (ingestor) return ingestor;
  ingestor = createMessageIngestor({
    processedMessageKeys,
    getSettings: () => settings,
    getChat: () => context?.chat || globalThis.chat,
    getChatId: () => context?.getCurrentChatId?.() || context?.chatId || '',
    applyDrafts: (reducer) => writeLedgerState(context, reducer),
    onDraftsAdded: async () => {
      await updatePromptInjection();
      await ui?.refresh();
    },
  });
  return ingestor;
}

async function processSuggestionMessage(messageId, eventType = 'message') {
  return getIngestor().processSuggestionMessage(messageId, eventType);
}

async function scanRecentMessagesForSuggestions(limit = 5, eventType = 'scan') {
  return getIngestor().scanRecentMessagesForSuggestions(limit, eventType);
}

async function ingestEventPayload(payload, eventType) {
  const messageId = resolveMessageId(payload);
  if (messageId !== null) {
    await processSuggestionMessage(messageId, eventType);
  } else {
    await scanRecentMessagesForSuggestions(5, `${eventType}_scan`);
  }
}

async function mountSettings() {
  const url = new URL('./settings.html', import.meta.url);
  const html = await fetch(url).then((response) => response.text());
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content.cloneNode(true);
  const settingsRoot = fragment.querySelector('[data-extension-name="football-career-ledger"]');
  document.querySelector('#extensions_settings')?.append(fragment);
  if (settingsRoot) {
    applySettingsToForm(settingsRoot);
    bindSettings(settingsRoot);
  }
}

function mountPanel() {
  const host = document.querySelector('#fcl_manager_panel');
  if (!host) {
    logger.error('未找到面板挂载点 #fcl_manager_panel');
    return;
  }
  host.hidden = !settings.panelOpen;

  ui = new LedgerUi(context, api, settings, {
    updatePrompt: updatePromptInjection,
    selfCheck: () => runApiSelfCheck(context, api, () => readLedgerState(context)),
  }, referenceApi ? {
    api: referenceApi,
    injection: referenceInjection,
    mvuTime: mvuTimeSync,
    settings: referenceSettings,
    saveSettings: () => persistReferenceSettings(context, referenceSettings),
  } : null);
  ui.mount(host);
}

function onEventIfAvailable(eventName, handler) {
  const type = context.eventTypes?.[eventName];
  if (type !== undefined && type !== null && context.eventSource?.on) {
    context.eventSource.on(type, handler);
  }
}

function registerEvents() {
  const eventSource = context.eventSource;
  const types = context.eventTypes;
  eventSource?.on(types.CHAT_CHANGED, async () => {
    processedMessageKeys.clear();
    await updatePromptInjection();
    await ui?.refresh();
    await scanRecentMessagesForSuggestions(10, 'chat_changed');
  });

  // Parse explicit suggestion blocks in any non-system message, regardless of role.
  // Multiple events may fire for one message; processedMessageKeys keeps it idempotent.
  onEventIfAvailable('MESSAGE_SENT', async (payload) => {
    await ingestEventPayload(payload, 'sent');
    await scanRecentMessagesForSuggestions(5, 'sent_scan');
  });
  onEventIfAvailable('USER_MESSAGE_SENT', async (payload) => {
    await ingestEventPayload(payload, 'user_sent');
    await scanRecentMessagesForSuggestions(5, 'user_sent_scan');
  });
  onEventIfAvailable('MESSAGE_ADDED', async (payload) => {
    await ingestEventPayload(payload, 'added');
  });
  onEventIfAvailable('MESSAGE_RECEIVED', async (payload) => {
    await ingestEventPayload(payload, 'received');
  });
  onEventIfAvailable('GENERATION_ENDED', async (payload) => {
    await ingestEventPayload(payload, 'generation');
    await scanRecentMessagesForSuggestions(5, 'generation_scan');
  });

  onEventIfAvailable('CHAT_BRANCH_CREATED', async (payload) => {
    try {
      await copyBranchState(context, payload);
    } catch (error) {
      logger.warn('分支状态复制失败', error);
    }
  });
}

async function loadReferenceDataset() {
  const url = new URL('./data/sample-dataset.json', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load football reference dataset: ${response.status}`);
  return response.json();
}

// Football Reference Scout subsystem: read-only reference lookup + orchestrator
// tool + one-shot prompt injection. Its settings (extensionSettings namespace)
// and IndexedDB dataset store are independent of the chat-scoped ledger state;
// it is surfaced through the "球探资料" panel tab.
function setupReference() {
  referenceSettings = ensureReferenceSettings(context);
  const saveReference = (next = referenceSettings) => {
    referenceSettings = next;
    persistReferenceSettings(context, referenceSettings);
  };
  const datasetStore = createDatasetStore();
  referenceApi = createReferenceApi({
    loadDataset: loadReferenceDataset,
    datasetStore,
    getSettings: () => referenceSettings,
    saveSettings: saveReference,
    onDatasetChanged: () => ui?.render(),
  });
  context.registerExtensionApi?.(REFERENCE_EXTENSION_ID, referenceApi);
  referenceInjection = createReferenceInjection({
    context,
    settings: referenceSettings,
    saveSettings: saveReference,
    buildCapsule: (args) => referenceApi.buildTurnCapsule(args),
    getUserMessage: () => getLastUserMessage(context),
    onStateChange: () => ui?.render(),
  });
  registerReferenceOrchestratorTools(context, referenceApi);
  referenceInjection.registerEvents();
  mvuTimeSync = createMvuTimeSync({
    context,
    getSettings: () => referenceSettings,
    applyProfile: (profile) => referenceApi.updateActiveProfile(profile),
    onChange: () => ui?.render(),
  });
  mvuTimeSync.registerEvents();
}

async function init() {
  context = resolveHostContext(globalThis);
  if (!context) {
    logger.error('SillyTavern/Luker getContext() 不可用');
    return;
  }

  getSettings();
  api = createPublicApi(() => readLedgerState(context), settings);
  context.registerExtensionApi?.(EXTENSION_ID, api);
  setupReference();
  await mountSettings();
  mountPanel();
  registerEvents();
  await updatePromptInjection();
  logger.info('插件已加载');
}

if (globalThis.jQuery) {
  globalThis.jQuery(init);
} else {
  document.addEventListener('DOMContentLoaded', init, { once: true });
}
