import { PROMPT_KEY } from './constants.js';
import { logger } from '../logger.js';

export function createInjectionController({
  context,
  settings,
  saveSettings,
  buildCapsule,
  getUserMessage,
  onStateChange = () => {},
} = {}) {
  let injected = false;

  async function previewNextCapsule({ userMessage } = {}) {
    return buildCapsule({
      userMessage: userMessage ?? getUserMessage(),
      stateTime: settings.currentDate || '',
      profile: getProfileFromSettings(settings),
      options: {
        maxChars: settings.promptMaxChars,
        nearbyDays: settings.nearbyDays,
      },
    });
  }

  async function armNextInjection() {
    settings.nextInjectionArmed = true;
    saveSettings();
    logger.info('已武装下一次注入参考');
    onStateChange();
    return previewNextCapsule();
  }

  function disarmNextInjection() {
    settings.nextInjectionArmed = false;
    saveSettings();
    clearPrompt();
    onStateChange();
  }

  async function injectIfArmed() {
    if (!settings.enabled || !settings.nextInjectionArmed) return false;
    const capsule = await previewNextCapsule();
    const text = clampPromptText(formatCapsuleForPrompt(capsule), settings.promptMaxChars);
    setPrompt(text);
    injected = true;
    settings.nextInjectionArmed = false;
    saveSettings();
    logger.info('已注入本轮参考', { chars: text.length });
    onStateChange();
    return true;
  }

  function clearPrompt() {
    setPrompt('');
    injected = false;
  }

  function clearIfInjected() {
    if (injected || settings.nextInjectionArmed) {
      settings.nextInjectionArmed = false;
      saveSettings();
      onStateChange();
    }
    clearPrompt();
  }

  function registerEvents() {
    const types = context?.eventTypes || {};
    const source = context?.eventSource;
    if (!source?.on) return;
    onEvent(source, types.GENERATION_CONTEXT_READY, injectIfArmed);
    onEvent(source, types.GENERATION_ENDED, clearIfInjected);
    onEvent(source, types.GENERATION_STOPPED, clearIfInjected);
    onEvent(source, types.CHAT_CHANGED, clearIfInjected);
  }

  function setPrompt(text) {
    if (typeof context?.setExtensionPrompt !== 'function') return;
    const promptTypes = context.constants?.promptTypes || { NONE: 0, IN_CHAT: 1 };
    const promptRoles = context.constants?.promptRoles || { SYSTEM: 0 };
    const position = text ? promptTypes.IN_CHAT : promptTypes.NONE;
    context.setExtensionPrompt(PROMPT_KEY, text, position, 1, false, promptRoles.SYSTEM);
  }

  return Object.freeze({
    previewNextCapsule,
    armNextInjection,
    disarmNextInjection,
    injectIfArmed,
    clearPrompt,
    clearIfInjected,
    registerEvents,
  });
}

export function formatCapsuleForPrompt(capsule) {
  return [
    '[Football Reference Scout]',
    'Use the following football records as reference only. Do not treat them as mandatory canon, and do not write plugin state from them.',
    JSON.stringify(capsule, null, 2),
    '[/Football Reference Scout]',
  ].join('\n');
}

function clampPromptText(text, maxChars) {
  const limit = Math.max(500, Math.floor(Number(maxChars) || 2000));
  if (text.length <= limit) return text;
  const suffix = '\n[Football Reference Scout: trimmed to fit the configured prompt budget]';
  return `${text.slice(0, Math.max(0, limit - suffix.length))}${suffix}`;
}

function getProfileFromSettings(settings) {
  return {
    seasonId: settings.currentSeasonId || null,
    team: settings.currentTeam || null,
    currentDate: settings.currentDate || null,
  };
}

function onEvent(source, eventName, handler) {
  if (eventName) source.on(eventName, handler);
}
