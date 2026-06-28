// Season actions: CRUD plus closing/recalculating closure and rolling to the
// next season. Season state changes can also touch player.currentSeasonId/team,
// so before/after snapshots carry both seasons and player.

import { formatSeasonTotals } from '../formatters.js';
import { cloneJson, normalizeManualTotals, nowIso } from '../schema.js';
import { parseSeasonInput } from '../season-utils.js';
import { applyManualTotals, summarizeSeason } from '../selectors.js';
import { upsertById } from '../utils.js';
import {
  asArray,
  asObject,
  asString,
  asDate,
  pushOperation,
  validateAndReturn,
  withMeta,
} from './core.js';

export function buildSeasonRecord(payload, options = {}) {
  const data = asObject(payload);
  const parsed = parseSeasonInput(data.id);
  return withMeta({
    id: asString(parsed.id || data.id),
    label: asString(data.label || parsed.label || data.id),
    club: asString(data.club),
    startedAt: asDate(data.startedAt || parsed.startedAt),
    endedAt: data.endedAt || null,
    status: asString(data.status || 'planned'),
    notes: asString(data.notes),
    closedSummary: data.closedSummary ?? null,
    manualTotals: normalizeManualTotals(data.manualTotals),
  }, options, data.meta || null);
}

export function addSeason(state, payload, options = {}) {
  const season = buildSeasonRecord(payload, options);
  if (!season.id) throw new Error('赛季 id 不能为空');
  const beforeSeasons = cloneJson(state.seasons);
  const beforePlayer = cloneJson(state.player);
  if (season.status === 'active') {
    state.seasons = state.seasons.map((row) => ({ ...row, status: row.status === 'active' ? 'completed' : row.status }));
    state.player.currentSeasonId = season.id;
    state.player.currentTeam = season.club || state.player.currentTeam;
  }
  state.seasons = upsertById(state.seasons, season);
  pushOperation(state, {
    type: 'create_season',
    entityType: 'season',
    entityId: season.id,
    before: { seasons: beforeSeasons, player: beforePlayer },
    after: { seasons: state.seasons, player: state.player },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function updateSeason(state, id, patch, options = {}) {
  const beforeSeasons = cloneJson(state.seasons);
  const beforePlayer = cloneJson(state.player);
  const before = state.seasons.find((season) => season.id === id);
  if (!before) throw new Error(`赛季不存在：${id}`);
  const after = buildSeasonRecord({ ...before, ...patch, id }, options);
  state.seasons = state.seasons.map((season) => season.id === id ? after : season);
  if (after.status === 'active') {
    state.seasons = state.seasons.map((season) => ({ ...season, status: season.id === id ? 'active' : season.status === 'active' ? 'completed' : season.status }));
    state.player.currentSeasonId = id;
    state.player.currentTeam = after.club || state.player.currentTeam;
  }
  pushOperation(state, {
    type: 'update_season',
    entityType: 'season',
    entityId: id,
    before: { seasons: beforeSeasons, player: beforePlayer },
    after: { seasons: state.seasons, player: state.player },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function deleteSeason(state, id, options = {}) {
  if (state.matches.some((match) => match.seasonId === id)) {
    throw new Error('这个赛季仍有比赛记录，删不了');
  }
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const existing = state.seasons.find((season) => season.id === id);
  if (!existing) throw new Error(`赛季不存在：${id}`);
  state.seasons = state.seasons.filter((season) => season.id !== id);
  if (state.player.currentSeasonId === id) {
    state.player.currentSeasonId = '';
  }
  pushOperation(state, {
    type: 'delete_season',
    entityType: 'season',
    entityId: id,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function closeSeason(state, seasonId, closure, options = {}) {
  const season = state.seasons.find((item) => item.id === seasonId);
  if (!season) throw new Error(`赛季不存在：${seasonId}`);
  const data = asObject(closure);
  const summary = summarizeSeason(state, seasonId);
  // Manual overrides from the closing form (if any) win over season.manualTotals.
  const nextManual = data.manualTotals !== undefined
    ? normalizeManualTotals(data.manualTotals)
    : (season.manualTotals ?? null);
  // Effective totals = match aggregation with the manual overrides applied.
  const totals = summary
    ? { matchCount: summary.matchCount, ...applyManualTotals(summary.autoTotals, nextManual) }
    : null;
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const closedAt = options.timestamp || nowIso();
  const after = withMeta({
    ...season,
    endedAt: data.endedAt || season.endedAt || closedAt.slice(0, 10),
    status: 'completed',
    manualTotals: nextManual,
    closedSummary: {
      calculatedTotals: totals ? {
        matchCount: totals.matchCount,
        appearances: totals.appearances,
        starts: totals.starts,
        minutes: totals.minutes,
        goals: totals.goals,
        assists: totals.assists,
        yellowCards: totals.yellowCards,
        redCards: totals.redCards,
        averageRating: totals.averageRating,
        notableMatches: state.matches.filter((match) => match.seasonId === seasonId && match.notable).length,
      } : {},
      teamOutcome: asString(data.teamOutcome) || formatSeasonTotals(totals),
      finalStanding: asString(data.finalStanding),
      roleAtEnd: asString(data.roleAtEnd),
      narrativeSummary: asString(data.narrativeSummary),
      teamHonors: asArray(data.teamHonors).length ? asArray(data.teamHonors).map((item) => asString(item)).filter(Boolean) : asString(data.teamHonors).split(',').map((item) => item.trim()).filter(Boolean),
      individualHonors: asArray(data.individualHonors).length ? asArray(data.individualHonors).map((item) => asString(item)).filter(Boolean) : asString(data.individualHonors).split(',').map((item) => item.trim()).filter(Boolean),
      closedAt,
    },
  }, options, season.meta);
  state.seasons = state.seasons.map((item) => item.id === seasonId ? after : item);
  if (state.player.currentSeasonId === seasonId) {
    state.player.currentSeasonId = '';
  }
  pushOperation(state, {
    type: 'close_season',
    entityType: 'season',
    entityId: seasonId,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function recalculateSeasonClosure(state, seasonId, options = {}) {
  const season = state.seasons.find((item) => item.id === seasonId);
  if (!season?.closedSummary) throw new Error('这个赛季还没结束');
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const totals = summarizeSeason(state, seasonId);
  const after = withMeta({
    ...season,
    closedSummary: {
      ...season.closedSummary,
      calculatedTotals: totals ? {
        matchCount: totals.matchCount,
        appearances: totals.appearances,
        starts: totals.starts,
        minutes: totals.minutes,
        goals: totals.goals,
        assists: totals.assists,
        yellowCards: totals.yellowCards,
        redCards: totals.redCards,
        averageRating: totals.averageRating,
        notableMatches: state.matches.filter((match) => match.seasonId === seasonId && match.notable).length,
      } : {},
    },
  }, options, season.meta);
  state.seasons = state.seasons.map((item) => item.id === seasonId ? after : item);
  pushOperation(state, {
    type: 'recalculate_season_closure',
    entityType: 'season',
    entityId: seasonId,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}

export function createNextSeason(state, payload, options = {}) {
  if (state.seasons.some((season) => season.status === 'active')) {
    throw new Error('先结束当前赛季，再开下一个');
  }
  const before = {
    seasons: cloneJson(state.seasons),
    player: cloneJson(state.player),
  };
  const season = buildSeasonRecord({ ...payload, status: 'active' }, options);
  if (!season.id) throw new Error('赛季 id 不能为空');
  state.seasons = state.seasons.map((item) => ({ ...item, status: item.status === 'active' ? 'completed' : item.status }));
  state.seasons = upsertById(state.seasons, season);
  state.player = {
    ...state.player,
    currentSeasonId: season.id,
    currentClub: asString(payload.currentClub ?? state.player.currentClub),
    currentTeam: asString(payload.currentTeam ?? season.club ?? state.player.currentTeam),
  };
  pushOperation(state, {
    type: 'create_next_season',
    entityType: 'season',
    entityId: season.id,
    before,
    after: {
      seasons: cloneJson(state.seasons),
      player: cloneJson(state.player),
    },
  }, options.timestamp);
  return validateAndReturn(state);
}
