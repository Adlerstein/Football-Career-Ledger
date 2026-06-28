import { dateRangeAround, extractIsoDate, resolveRelativeDate } from './date-utils.js';

export function resolveTurnContext({
  userMessage = '',
  stateTime = '',
  ledgerSnapshot = null,
  profile = null,
  defaultSeasonId = '',
} = {}) {
  const text = String(userMessage || '');
  const stateDate = extractIsoDate(stateTime);
  const explicitDate = extractIsoDate(text);
  const ledgerContext = extractLedgerContext(ledgerSnapshot);
  const profileContext = extractProfileContext(profile);
  const base = {
    state_time: String(stateTime || ''),
    seasonId: profileContext.seasonId || ledgerContext.seasonId || defaultSeasonId || null,
    team: profileContext.team || ledgerContext.team || null,
    query_time: null,
    dateRange: null,
    round: extractRound(text),
    confidence: 'low',
    reason: 'No usable time clue found in the current turn.',
  };

  if (explicitDate) {
    return {
      ...base,
      query_time: explicitDate,
      dateRange: [explicitDate, explicitDate],
      confidence: 'high',
      reason: 'explicit date found in current user message',
    };
  }

  const relative = resolveRelativeDate(text, stateDate);
  if (relative?.date) {
    return {
      ...base,
      query_time: relative.date,
      dateRange: [relative.date, relative.date],
      confidence: 'medium',
      reason: `relative time clue '${relative.label}' resolved from committed state_time`,
    };
  }

  if (base.round === 'next') {
    return {
      ...base,
      confidence: 'low',
      reason: 'next-round wording is ambiguous without a schedule lookup',
    };
  }

  if (stateDate) {
    return {
      ...base,
      query_time: stateDate,
      dateRange: dateRangeAround(stateDate, 0),
      confidence: 'medium',
      reason: 'no current-turn time shift found; using committed state_time as lookup baseline',
    };
  }

  return base;
}

function extractProfileContext(profile) {
  const data = profile && typeof profile === 'object' ? profile : {};
  return {
    team: firstNonEmpty(data.team, data.currentTeam, data.currentClub),
    seasonId: firstNonEmpty(data.seasonId, data.currentSeasonId),
  };
}

function extractRound(text) {
  const value = String(text || '');
  if (/下[一]?轮|下一場|下一场|下场比赛/.test(value)) return 'next';
  const roundMatch = value.match(/第\s*([0-9]+|[一二两三四五六七八九十]+)\s*[轮輪]/);
  if (roundMatch) return `Round ${roundMatch[1]}`;
  return null;
}

function extractLedgerContext(snapshot) {
  const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const player = data.player && typeof data.player === 'object' ? data.player : {};
  const status = data.careerStatus && typeof data.careerStatus === 'object' ? data.careerStatus : {};
  const currentSeason = data.currentSeason && typeof data.currentSeason === 'object' ? data.currentSeason : {};
  const season = data.season && typeof data.season === 'object' ? data.season : {};

  return {
    team: firstNonEmpty(
      player.currentClub,
      player.currentTeam,
      status.currentClub,
      status.currentTeam,
      data.currentClub,
      data.currentTeam,
    ),
    seasonId: firstNonEmpty(
      player.currentSeasonId,
      status.currentSeasonId,
      currentSeason.id,
      season.id,
      data.currentSeasonId,
      data.seasonId,
    ),
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

