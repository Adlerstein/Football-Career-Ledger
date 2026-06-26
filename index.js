import { DEFAULT_SETTINGS, EXTENSION_ID, PROMPT_KEY } from './src/constants.js';
import { buildPromptSummary } from './src/prompt.js';
import { createPublicApi, runApiSelfCheck } from './src/public-api.js';
import { copyBranchState, readLedgerState } from './src/storage.js';
import { LedgerUi } from './src/ui.js';

let context = null;
let api = null;
let ui = null;
let settings = null;

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
    context.setExtensionPrompt(PROMPT_KEY, summary, promptTypes.IN_CHAT, 0, false, promptRoles.SYSTEM);
  } catch (error) {
    console.error('[football-career-ledger] failed to update prompt summary', error);
    context.setExtensionPrompt(PROMPT_KEY, '', promptTypes.NONE, 0, false, promptRoles.SYSTEM);
  }
}

function applySettingsToForm(root) {
  root.querySelector('#fcl_enabled').checked = Boolean(settings.enabled);
  root.querySelector('#fcl_prompt_injection').checked = Boolean(settings.promptInjectionEnabled);
  root.querySelector('#fcl_prompt_max_chars').value = String(settings.promptMaxChars);
  root.querySelector('#fcl_recent_match_limit').value = String(settings.recentMatchLimit);
  root.querySelector('#fcl_include_contracts').checked = Boolean(settings.includeContracts);
  root.querySelector('#fcl_include_finance').checked = Boolean(settings.includeFinance);
  root.querySelector('#fcl_include_abilities').checked = Boolean(settings.includeAbilities);
  root.querySelector('#fcl_include_miscellaneous').checked = Boolean(settings.includeMiscellaneous);
}

function bindSettings(root) {
  const updateSetting = () => {
    settings.enabled = root.querySelector('#fcl_enabled').checked;
    settings.promptInjectionEnabled = root.querySelector('#fcl_prompt_injection').checked;
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

  root.querySelectorAll('input').forEach((element) => {
    element.addEventListener('change', updateSetting);
  });

  root.querySelector('#fcl_open_panel').addEventListener('click', () => {
    document.querySelector('#fcl_manager_panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
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
    console.error('[football-career-ledger] panel host was not found');
    return;
  }

  ui = new LedgerUi(context, api, settings, {
    updatePrompt: updatePromptInjection,
    selfCheck: () => runApiSelfCheck(context, api, () => readLedgerState(context)),
  });
  ui.mount(host);
}

function registerEvents() {
  const eventSource = context.eventSource;
  const types = context.eventTypes;
  eventSource?.on(types.CHAT_CHANGED, async () => {
    await updatePromptInjection();
    await ui?.refresh();
  });
  eventSource?.on(types.CHAT_BRANCH_CREATED, async (payload) => {
    try {
      await copyBranchState(context, payload);
    } catch (error) {
      console.warn('[football-career-ledger] branch state copy failed', error);
    }
  });
}

async function init() {
  context = globalThis.Luker?.getContext?.();
  if (!context) {
    console.error('[football-career-ledger] Luker.getContext() is unavailable');
    return;
  }

  getSettings();
  api = createPublicApi(() => readLedgerState(context), settings);
  context.registerExtensionApi?.(EXTENSION_ID, api);
  await mountSettings();
  mountPanel();
  registerEvents();
  await updatePromptInjection();
  console.info('[football-career-ledger] loaded');
}

if (globalThis.jQuery) {
  globalThis.jQuery(init);
} else {
  document.addEventListener('DOMContentLoaded', init, { once: true });
}
