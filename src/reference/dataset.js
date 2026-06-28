import {
  DEFAULT_QUERY_LIMIT,
  MAX_DETAIL_EVENTS,
  MAX_DETAIL_LINEUPS,
  MAX_QUERY_LIMIT,
} from './constants.js';

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeLabel(value) {
  return String(value ?? '').trim().toLowerCase();
}

function cloneScore(score) {
  if (!score || typeof score !== 'object') {
    return null;
  }

  return {
    home: score.home ?? null,
    away: score.away ?? null,
  };
}

function clampLimit(value, fallback = DEFAULT_QUERY_LIMIT, maximum = MAX_QUERY_LIMIT) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(maximum, Math.floor(numeric)));
}

function projectMatch(match, competitionName, teamsById) {
  return {
    matchId: match.id,
    seasonId: match.seasonId ?? null,
    competition: competitionName ?? null,
    round: match.round ?? null,
    date: match.date ?? null,
    homeTeam: teamsById.get(match.homeTeamId)?.name ?? match.homeTeamId ?? null,
    awayTeam: teamsById.get(match.awayTeamId)?.name ?? match.awayTeamId ?? null,
    score: cloneScore(match.score),
    sourceIds: Array.isArray(match.sourceIds) ? [...match.sourceIds] : [],
  };
}

export function validateReferenceDataset(dataset) {
  const errors = [];
  const warnings = [];

  if (!dataset || typeof dataset !== 'object') {
    return {
      ok: false,
      errors: ['Dataset must be an object.'],
      warnings,
    };
  }

  const requiredArrays = [
    'seasons',
    'competitions',
    'teams',
    'matches',
    'events',
    'lineups',
    'sources',
  ];

  if (dataset.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }

  if (!dataset.meta || typeof dataset.meta !== 'object') {
    errors.push('meta must be an object.');
  }

  for (const key of requiredArrays) {
    if (!Array.isArray(dataset[key])) {
      errors.push(`${key} must be an array.`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const seasonIds = new Set();
  const competitionIds = new Set();
  const teamIds = new Set();
  const matchIds = new Set();
  const sourceIds = new Set();

  for (const season of dataset.seasons) {
    if (!season?.id) {
      errors.push('Each season must have an id.');
      continue;
    }
    seasonIds.add(season.id);
  }

  for (const competition of dataset.competitions) {
    if (!competition?.id) {
      errors.push('Each competition must have an id.');
      continue;
    }
    competitionIds.add(competition.id);
    if (competition.seasonId && !seasonIds.has(competition.seasonId)) {
      errors.push(`Competition ${competition.id} references unknown seasonId ${competition.seasonId}.`);
    }
  }

  for (const team of dataset.teams) {
    if (!team?.id) {
      errors.push('Each team must have an id.');
      continue;
    }
    teamIds.add(team.id);
    if (!team.name) {
      warnings.push(`Team ${team.id} is missing a name.`);
    }
    if (team.aliases != null && !Array.isArray(team.aliases)) {
      errors.push(`Team ${team.id} aliases must be an array when present.`);
    }
  }

  for (const source of dataset.sources) {
    if (!source?.id) {
      errors.push('Each source must have an id.');
      continue;
    }
    sourceIds.add(source.id);
  }

  for (const match of dataset.matches) {
    if (!match?.id) {
      errors.push('Each match must have an id.');
      continue;
    }
    if (matchIds.has(match.id)) {
      errors.push(`Duplicate match id ${match.id}.`);
    }
    matchIds.add(match.id);

    if (match.seasonId && !seasonIds.has(match.seasonId)) {
      errors.push(`Match ${match.id} references unknown seasonId ${match.seasonId}.`);
    }
    if (match.competitionId && !competitionIds.has(match.competitionId)) {
      errors.push(`Match ${match.id} references unknown competitionId ${match.competitionId}.`);
    }
    if (match.homeTeamId && !teamIds.has(match.homeTeamId)) {
      errors.push(`Match ${match.id} references unknown homeTeamId ${match.homeTeamId}.`);
    }
    if (match.awayTeamId && !teamIds.has(match.awayTeamId)) {
      errors.push(`Match ${match.id} references unknown awayTeamId ${match.awayTeamId}.`);
    }
    if (!Array.isArray(match.sourceIds)) {
      warnings.push(`Match ${match.id} has no sourceIds array.`);
    } else {
      for (const sourceId of match.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          errors.push(`Match ${match.id} references unknown sourceId ${sourceId}.`);
        }
      }
    }
  }

  for (const event of dataset.events) {
    if (!matchIds.has(event?.matchId)) {
      errors.push(`Event references unknown matchId ${event?.matchId ?? '(missing)'}.`);
    }
    if (event?.teamId && !teamIds.has(event.teamId)) {
      errors.push(`Event for match ${event.matchId} references unknown teamId ${event.teamId}.`);
    }
  }

  for (const lineup of dataset.lineups) {
    if (!matchIds.has(lineup?.matchId)) {
      errors.push(`Lineup references unknown matchId ${lineup?.matchId ?? '(missing)'}.`);
    }
    if (lineup?.teamId && !teamIds.has(lineup.teamId)) {
      errors.push(`Lineup for match ${lineup.matchId} references unknown teamId ${lineup.teamId}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function createReferenceIndex(dataset) {
  const validation = validateReferenceDataset(dataset);
  if (!validation.ok) {
    throw new Error(`Invalid reference dataset: ${validation.errors.join(' ')}`);
  }

  const teamsById = new Map();
  const teamLookup = new Map();
  for (const team of dataset.teams) {
    teamsById.set(team.id, team);
    const keys = [team.id, team.name, ...(team.aliases ?? [])];
    for (const key of keys) {
      const normalized = normalizeToken(key);
      if (normalized) {
        teamLookup.set(normalized, team.id);
      }
    }
  }

  const competitionsById = new Map();
  const competitionNameLookup = new Map();
  for (const competition of dataset.competitions) {
    competitionsById.set(competition.id, competition);
    const normalized = normalizeLabel(competition.name);
    if (normalized) {
      competitionNameLookup.set(normalized, competition.id);
    }
  }

  const sourcesById = new Map();
  for (const source of dataset.sources) {
    sourcesById.set(source.id, source);
  }

  const matchesById = new Map();
  const eventsByMatchId = new Map();
  const lineupsByMatchId = new Map();

  for (const event of dataset.events) {
    const bucket = eventsByMatchId.get(event.matchId) ?? [];
    bucket.push({
      minute: event.minute ?? null,
      type: event.type ?? null,
      teamId: event.teamId ?? null,
      team: teamsById.get(event.teamId)?.name ?? null,
      player: event.player ?? null,
      assist: event.assist ?? null,
      playerOut: event.playerOut ?? null,
      playerIn: event.playerIn ?? null,
    });
    eventsByMatchId.set(event.matchId, bucket);
  }

  for (const lineup of dataset.lineups) {
    const bucket = lineupsByMatchId.get(lineup.matchId) ?? [];
    bucket.push({
      teamId: lineup.teamId ?? null,
      team: teamsById.get(lineup.teamId)?.name ?? null,
      starters: Array.isArray(lineup.starters)
        ? lineup.starters.map((player) => ({
            player: player?.player ?? null,
            position: player?.position ?? null,
          }))
        : [],
      substitutes: Array.isArray(lineup.substitutes)
        ? lineup.substitutes.map((player) => ({
            player: player?.player ?? null,
            position: player?.position ?? null,
          }))
        : [],
    });
    lineupsByMatchId.set(lineup.matchId, bucket);
  }

  const matchRows = dataset.matches.map((match) => {
    const competition = competitionsById.get(match.competitionId);
    const row = projectMatch(match, competition?.name ?? null, teamsById);
    const entry = {
      raw: match,
      row,
      teamIds: new Set([match.homeTeamId, match.awayTeamId].filter(Boolean)),
      competitionNameKey: normalizeLabel(competition?.name),
      roundKey: normalizeLabel(match.round),
    };
    matchesById.set(match.id, entry);
    return entry;
  });

  matchRows.sort((left, right) => {
    const dateCompare = String(left.raw.date ?? '').localeCompare(String(right.raw.date ?? ''));
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return String(left.raw.id).localeCompare(String(right.raw.id));
  });

  function resolveTeamId(teamId, team) {
    if (teamId && teamsById.has(teamId)) {
      return teamId;
    }

    const normalized = normalizeToken(team);
    return normalized ? teamLookup.get(normalized) ?? null : null;
  }

  function resolveCompetitionId(competitionId, competition) {
    if (competitionId && competitionsById.has(competitionId)) {
      return competitionId;
    }

    const normalized = normalizeLabel(competition);
    return normalized ? competitionNameLookup.get(normalized) ?? null : null;
  }

  return {
    getStatus() {
      return {
        ok: true,
        datasetId: dataset.meta?.datasetId ?? null,
        title: dataset.meta?.title ?? '',
        defaultSeasonId: dataset.meta?.defaultSeasonId ?? null,
        seasonCount: dataset.seasons.length,
        competitionCount: dataset.competitions.length,
        teamCount: dataset.teams.length,
        matchCount: dataset.matches.length,
        eventCount: dataset.events.length,
        lineupCount: dataset.lineups.length,
        sourceCount: dataset.sources.length,
      };
    },

    queryMatches({
      seasonId,
      competitionId,
      competition,
      teamId,
      team,
      dateRange,
      date,
      round,
      limit,
    } = {}) {
      const resolvedTeamId = resolveTeamId(teamId, team);
      const resolvedCompetitionId = resolveCompetitionId(competitionId, competition);
      const roundKey = normalizeLabel(round);
      const exactDate = date ?? null;
      const rangeStart = Array.isArray(dateRange) ? dateRange[0] ?? null : null;
      const rangeEnd = Array.isArray(dateRange) ? dateRange[1] ?? null : null;

      let rows = matchRows.filter(({ raw, teamIds, roundKey: matchRoundKey }) => {
        if (seasonId && raw.seasonId !== seasonId) {
          return false;
        }
        if (resolvedCompetitionId && raw.competitionId !== resolvedCompetitionId) {
          return false;
        }
        if (resolvedTeamId && !teamIds.has(resolvedTeamId)) {
          return false;
        }
        if (exactDate && raw.date !== exactDate) {
          return false;
        }
        if (rangeStart && String(raw.date ?? '') < String(rangeStart)) {
          return false;
        }
        if (rangeEnd && String(raw.date ?? '') > String(rangeEnd)) {
          return false;
        }
        if (roundKey && matchRoundKey !== roundKey) {
          return false;
        }
        return true;
      });

      rows = rows.slice(0, clampLimit(limit));

      return rows.map(({ row }) => ({
        ...row,
        sourceIds: [...row.sourceIds],
        score: cloneScore(row.score),
      }));
    },

    getMatchDetail({ matchId } = {}) {
      const entry = matchesById.get(matchId);
      if (!entry) {
        return null;
      }

      const sourceIds = Array.isArray(entry.raw.sourceIds) ? entry.raw.sourceIds : [];
      return {
        match: {
          ...entry.row,
          sourceIds: [...entry.row.sourceIds],
          score: cloneScore(entry.row.score),
        },
        events: (eventsByMatchId.get(matchId) ?? [])
          .slice(0, MAX_DETAIL_EVENTS)
          .map((event) => ({ ...event })),
        lineups: (lineupsByMatchId.get(matchId) ?? [])
          .slice(0, MAX_DETAIL_LINEUPS)
          .map((lineup) => ({
            ...lineup,
            starters: lineup.starters.map((player) => ({ ...player })),
            substitutes: lineup.substitutes.map((player) => ({ ...player })),
          })),
        sources: sourceIds
          .map((sourceId) => sourcesById.get(sourceId))
          .filter(Boolean)
          .map((source) => ({
            id: source.id,
            label: source.label ?? null,
            url: source.url ?? null,
            confidence: source.confidence ?? null,
          })),
      };
    },
  };
}
