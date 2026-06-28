// MVU world-time bridge. The football card maintains a `世界.当前时间` variable
// (format "YYYY-MM-DD 时段", updated via <UpdateVariable> JSON patches in AI
// replies). This reads it, validates it, and derives the football season.
//
// Time is PREFERRED but never ABSOLUTE: the AI can hallucinate or leave the
// value vague, so callers validate (full ISO date within a sane year range) and
// the user can override. Auto-sync is opt-in and pauses on manual edits.

import { extractIsoDate } from './date-utils.js';
import { seasonIdFromStartYear } from '../season-utils.js';

const MIN_YEAR = 1990;
const MAX_YEAR = 2040;

export function readMvuWorldTime(context) {
  const candidates = [
    context?.variables?.global?.世界?.当前时间,
    context?.variables?.local?.世界?.当前时间,
    context?.chatMetadata?.variables?.世界?.当前时间,
    globalThis?.chat_metadata?.variables?.世界?.当前时间,
    globalThis?.stat_data?.世界?.当前时间,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

// Latest user message text from the host chat (context.chat, falling back to the
// global chat array). Shared by the injection feed and the orchestrator tool.
export function getLastUserMessage(context) {
  const chat = Array.isArray(context?.chat)
    ? context.chat
    : (Array.isArray(globalThis.chat) ? globalThis.chat : []);
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    const message = chat[index];
    if (message?.is_user || message?.role === 'user') {
      return String(message.mes || message.content || '');
    }
  }
  return '';
}

// A football season runs Jul..Jun, so a date in Jan-Jun belongs to the season
// that started the previous year.
export function deriveSeasonIdFromIso(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  return seasonIdFromStartYear(month >= 7 ? year : year - 1);
}

// Resolve the raw MVU value into { raw, iso, seasonId, ok, reason }.
// reason: 'none' | 'unparsed' | 'out-of-range' | 'ok'
export function resolveMvuTime(context) {
  const raw = readMvuWorldTime(context);
  if (!raw) return { raw: '', iso: '', seasonId: '', ok: false, reason: 'none' };
  const iso = extractIsoDate(raw);
  if (!iso) return { raw, iso: '', seasonId: '', ok: false, reason: 'unparsed' };
  const year = Number(iso.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { raw, iso, seasonId: '', ok: false, reason: 'out-of-range' };
  }
  return { raw, iso, seasonId: deriveSeasonIdFromIso(iso), ok: true, reason: 'ok' };
}

// Auto-sync controller. apply() writes the resolved MVU time into the profile
// (via applyProfile) only when allowed; force:true bypasses the gate for an
// explicit "adopt now" click.
export function createMvuTimeSync({ context, getSettings, applyProfile, onChange = () => {} }) {
  function apply({ force = false } = {}) {
    const settings = getSettings() || {};
    if (!force && (!settings.autoSyncMvuTime || settings.mvuTimeOverride)) return false;
    const info = resolveMvuTime(context);
    if (!info.ok) return false;
    if (info.iso === settings.currentDate && info.seasonId === settings.currentSeasonId) return false;
    applyProfile({ currentDate: info.iso, seasonId: info.seasonId });
    onChange();
    return true;
  }

  function registerEvents() {
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    if (types.GENERATION_ENDED) source.on(types.GENERATION_ENDED, () => apply());
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, () => apply());
  }

  return { resolve: () => resolveMvuTime(context), apply, registerEvents };
}
