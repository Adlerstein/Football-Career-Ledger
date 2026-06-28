import { DEFAULT_SETTINGS, EXTENSION_ID } from './constants.js';

export function ensureSettings(context) {
  if (!context.extensionSettings || typeof context.extensionSettings !== 'object') {
    context.extensionSettings = {};
  }

  context.extensionSettings[EXTENSION_ID] = {
    ...DEFAULT_SETTINGS,
    ...(context.extensionSettings[EXTENSION_ID] || {}),
  };

  const settings = context.extensionSettings[EXTENSION_ID];
  settings.nearbyDays = clampInteger(settings.nearbyDays, 0, 14, DEFAULT_SETTINGS.nearbyDays);
  settings.promptMaxChars = clampInteger(settings.promptMaxChars, 500, 10000, DEFAULT_SETTINGS.promptMaxChars);
  settings.nextInjectionArmed = Boolean(settings.nextInjectionArmed);
  settings.autoSyncMvuTime = Boolean(settings.autoSyncMvuTime);
  settings.mvuTimeOverride = Boolean(settings.mvuTimeOverride);
  settings.enabled = Boolean(settings.enabled);
  return settings;
}

export function saveSettings(context, settings) {
  context.extensionSettings[EXTENSION_ID] = settings;
  context.saveSettingsDebounced?.();
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}
