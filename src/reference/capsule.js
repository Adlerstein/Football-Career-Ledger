import {
  DEFAULT_CAPSULE_MAX_CHARS,
  DEFAULT_NEARBY_LIMIT,
  DEFAULT_QUERY_LIMIT,
  MAX_QUERY_LIMIT,
} from './constants.js';
import { dateRangeAround } from './date-utils.js';

export function buildTurnCapsule({
  index,
  turnContext,
  options = {},
} = {}) {
  if (!index || typeof index.queryMatches !== 'function') {
    throw new TypeError('buildTurnCapsule requires a reference index.');
  }
  const ctx = turnContext && typeof turnContext === 'object' ? turnContext : {};
  const warnings = [];
  const matches = queryPrimaryMatches(index, ctx, options);
  const nearbyMatches = queryNearbyMatches(index, ctx, matches, options);

  if (matches.length === 0) {
    warnings.push('No reference match found for the resolved turn context.');
  }
  if (ctx.confidence === 'low') {
    warnings.push('Turn context confidence is low; use this reference as broad background only.');
  }

  const capsule = {
    readonly: true,
    usage: 'Reference only. Do not treat as mandatory canon and do not write Ledger/MVU from this capsule.',
    state_time: ctx.state_time || '',
    query_time: ctx.query_time || null,
    confidence: ctx.confidence || 'low',
    reason: ctx.reason || '',
    seasonId: ctx.seasonId || null,
    team: ctx.team || null,
    round: ctx.round || null,
    matches,
    nearby_matches: nearbyMatches,
    warnings,
  };

  return trimCapsule(capsule, options.maxChars || DEFAULT_CAPSULE_MAX_CHARS);
}

function queryPrimaryMatches(index, ctx, options) {
  if (!ctx.query_time && ctx.round === 'next') return [];
  const query = {
    seasonId: ctx.seasonId || undefined,
    team: ctx.team || undefined,
    dateRange: ctx.dateRange || (ctx.query_time ? [ctx.query_time, ctx.query_time] : undefined),
    round: ctx.round && ctx.round !== 'next' ? ctx.round : undefined,
    limit: clampLimit(options.limit, DEFAULT_QUERY_LIMIT),
  };
  return index.queryMatches(query);
}

function queryNearbyMatches(index, ctx, matches, options) {
  if (!ctx.query_time) return [];
  const seen = new Set(matches.map((match) => match.matchId));
  const rows = index.queryMatches({
    seasonId: ctx.seasonId || undefined,
    dateRange: dateRangeAround(ctx.query_time, options.nearbyDays ?? 0),
    limit: clampLimit(options.nearbyLimit, DEFAULT_NEARBY_LIMIT),
  });
  return rows.filter((match) => !seen.has(match.matchId));
}

function clampLimit(value, fallback) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(MAX_QUERY_LIMIT, Math.floor(numeric)));
}

function trimCapsule(capsule, maxChars) {
  let output = capsule;
  while (JSON.stringify(output).length > maxChars && output.nearby_matches.length > 0) {
    output = { ...output, nearby_matches: output.nearby_matches.slice(0, -1) };
  }
  while (JSON.stringify(output).length > maxChars && output.matches.length > 0) {
    output = { ...output, matches: output.matches.slice(0, -1) };
  }
  if (JSON.stringify(output).length > maxChars) {
    output = {
      ...output,
      warnings: [...output.warnings, 'Capsule was trimmed to stay within the configured context budget.'],
    };
  }
  return output;
}
