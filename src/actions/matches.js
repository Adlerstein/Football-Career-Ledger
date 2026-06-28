// Match CRUD actions.

import { HOME_AWAY_VALUES } from '../constants.js';
import { createLedgerId, upsertById } from '../utils.js';
import {
  asBoolean,
  asDate,
  asInteger,
  asObject,
  asString,
  clamp,
  pushOperation,
  requireKnownSeason,
  validateAndReturn,
  withMeta,
} from './core.js';

export function buildMatchRecord(state, payload, options = {}) {
  const data = asObject(payload);
  const seasonId = asString(data.seasonId || state.player.currentSeasonId);
  requireKnownSeason(state, seasonId);
  const homeAway = HOME_AWAY_VALUES.includes(data.homeAway) ? data.homeAway : 'home';
  const rating = data.rating === '' || data.rating === null || data.rating === undefined ? null : Number(data.rating);
  return withMeta({
    id: asString(data.id || createLedgerId('match')),
    seasonId,
    date: asDate(data.date),
    competition: asString(data.competition),
    club: asString(data.club || state.player.currentTeam || state.player.currentClub),
    opponent: asString(data.opponent),
    homeAway,
    goalsFor: Math.max(0, asInteger(data.goalsFor)),
    goalsAgainst: Math.max(0, asInteger(data.goalsAgainst)),
    started: asBoolean(data.started),
    minutes: clamp(asInteger(data.minutes), 0, 130),
    goals: Math.max(0, asInteger(data.goals)),
    assists: Math.max(0, asInteger(data.assists)),
    yellowCards: Math.max(0, asInteger(data.yellowCards)),
    redCards: Math.max(0, asInteger(data.redCards)),
    rating,
    notable: asBoolean(data.notable),
    notes: asString(data.notes),
  }, options, data.meta || null);
}

export function addMatch(state, payload, options = {}) {
  const match = buildMatchRecord(state, payload, options);
  state.matches = upsertById(state.matches, match);
  pushOperation(state, {
    type: 'create_match',
    entityType: 'match',
    entityId: match.id,
    before: null,
    after: match,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateMatch(state, id, patch, options = {}) {
  const before = state.matches.find((match) => match.id === id);
  if (!before) throw new Error(`比赛不存在：${id}`);
  const after = buildMatchRecord(state, { ...before, ...patch, id }, options);
  state.matches = state.matches.map((match) => match.id === id ? after : match);
  pushOperation(state, {
    type: 'update_match',
    entityType: 'match',
    entityId: id,
    before,
    after,
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteMatch(state, id, options = {}) {
  const before = state.matches.find((match) => match.id === id);
  if (!before) throw new Error(`比赛不存在：${id}`);
  state.matches = state.matches.filter((match) => match.id !== id);
  pushOperation(state, {
    type: 'delete_match',
    entityType: 'match',
    entityId: id,
    before,
    after: null,
  }, options.timestamp);
  return validateAndReturn(state);
}
