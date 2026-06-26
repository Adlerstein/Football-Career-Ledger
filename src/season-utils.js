import {
  DEFAULT_SEASON_START_DATE,
  SEASON_TEMPLATE_END_YEAR,
  SEASON_TEMPLATE_START_YEAR,
} from './constants.js';

function twoDigitYear(year) {
  return String(year % 100).padStart(2, '0');
}

export function seasonIdFromStartYear(year) {
  const startYear = Number(year);
  if (!Number.isInteger(startYear)) return '';
  return `${startYear}-${twoDigitYear(startYear + 1)}`;
}

export function seasonLabelFromStartYear(year) {
  const startYear = Number(year);
  if (!Number.isInteger(startYear)) return '';
  return `${startYear}/${twoDigitYear(startYear + 1)}`;
}

export function seasonStartedAtFromStartYear(year) {
  const startYear = Number(year);
  if (!Number.isInteger(startYear)) return DEFAULT_SEASON_START_DATE;
  return `${startYear}-07-01`;
}

export function seasonEndedAtFromStartYear(year) {
  const startYear = Number(year);
  if (!Number.isInteger(startYear)) return '';
  return `${startYear + 1}-06-30`;
}

export function getSeasonTemplateRows(startYear = SEASON_TEMPLATE_START_YEAR, endYear = SEASON_TEMPLATE_END_YEAR) {
  const rows = [];
  for (let year = startYear; year <= endYear; year += 1) {
    rows.push({
      value: seasonIdFromStartYear(year),
      label: seasonLabelFromStartYear(year),
      startedAt: seasonStartedAtFromStartYear(year),
      endedAt: seasonEndedAtFromStartYear(year),
    });
  }
  return rows;
}

export function parseSeasonInput(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})[/-](\d{2}|\d{4})$/);
  if (!match) {
    return {
      id: raw,
      label: raw,
      startedAt: DEFAULT_SEASON_START_DATE,
      endedAt: '',
    };
  }
  const startYear = Number(match[1]);
  return {
    id: seasonIdFromStartYear(startYear),
    label: seasonLabelFromStartYear(startYear),
    startedAt: seasonStartedAtFromStartYear(startYear),
    endedAt: seasonEndedAtFromStartYear(startYear),
  };
}

export function getNextSeasonTemplate(currentSeason = null) {
  if (!currentSeason?.id) return getSeasonTemplateRows()[0];
  const match = String(currentSeason.id).match(/^(\d{4})-/);
  const nextStartYear = match ? Number(match[1]) + 1 : SEASON_TEMPLATE_START_YEAR;
  return {
    value: seasonIdFromStartYear(nextStartYear),
    label: seasonLabelFromStartYear(nextStartYear),
    startedAt: seasonStartedAtFromStartYear(nextStartYear),
    endedAt: seasonEndedAtFromStartYear(nextStartYear),
  };
}
