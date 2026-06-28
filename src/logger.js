// In-memory ring buffer of plugin runtime logs, surfaced by the "日志" tab.
// Every call also forwards to the browser console (prefixed) so existing DevTools
// debugging keeps working. Session-only; nothing is persisted.

const MAX_ENTRIES = 300;
const PREFIX = '[football-career-ledger]';
const entries = [];

function normalizeDetails(data) {
  if (data === undefined || data === null) return '';
  if (data instanceof Error) return data.message || String(data);
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }
  return String(data);
}

function record(level, message, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message: String(message),
    details: normalizeDetails(data),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  if (data === undefined) consoleFn(`${PREFIX} ${message}`);
  else consoleFn(`${PREFIX} ${message}`, data);
  return entry;
}

export const logger = {
  info: (message, data) => record('info', message, data),
  warn: (message, data) => record('warn', message, data),
  error: (message, data) => record('error', message, data),
  list: () => entries.slice(),
  clear: () => { entries.length = 0; },
};
