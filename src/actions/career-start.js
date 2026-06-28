// Career-start action: a one-shot build that seeds player, opening season,
// initial abilities and the opening narrative in a single confirm. A
// `career_start` misc marker enforces "at most one successful build per ledger".

import { seasonIdFromStartYear, seasonLabelFromStartYear } from '../season-utils.js';
import { asDate, asObject, asString, normalizeAbilityValues, validateAndReturn } from './core.js';
import { updatePlayerStatus } from './player.js';
import { addSeason } from './seasons.js';
import { setInitialAbilities } from './abilities.js';
import { addMiscellaneous } from './miscellaneous.js';

function deriveSeasonFromDate(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-/);
  if (!match) return { id: '', label: '' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const startYear = month >= 7 ? year : year - 1;
  return {
    id: seasonIdFromStartYear(startYear),
    label: seasonLabelFromStartYear(startYear),
  };
}

export function hasConfirmedCareerStart(state) {
  return state.miscellaneous.some((item) => item.key === 'career_start');
}

export function applyCareerStart(state, payload, options = {}) {
  const data = asObject(payload);
  // 一次性边界：同一账本只允许成功确认一次 career_start。该判断只依赖
  // career_start 系统标记，避免拦截没有该标记的旧账本迁移数据。
  if (hasConfirmedCareerStart(state)) {
    throw new Error('这个聊天已完成开局建档，不能再建一次');
  }
  const date = asDate(data.date);
  if (!date) throw new Error('开局建档要填日期');

  const playerInput = asObject(data.player);
  const seasonInput = asObject(data.season);
  const currentClub = asString(playerInput.currentClub);
  const seasonClub = asString(seasonInput.club);
  const currentTeam = asString(playerInput.currentTeam) || currentClub || seasonClub;
  const secondaryPositions = Array.isArray(playerInput.secondaryPositions)
    ? playerInput.secondaryPositions.map((item) => asString(item)).filter(Boolean)
    : asString(playerInput.secondaryPositions).split(',').map((item) => item.trim()).filter(Boolean);

  updatePlayerStatus(state, {
    name: asString(playerInput.name),
    currentClub,
    currentTeam,
    primaryPosition: asString(playerInput.primaryPosition),
    secondaryPositions,
    careerStage: asString(playerInput.careerStage || 'youth'),
    squadRole: asString(playerInput.squadRole || 'prospect'),
    defaultCurrency: asString(playerInput.defaultCurrency || 'DEM').trim() || 'DEM',
  }, options);

  const derived = deriveSeasonFromDate(date);
  addSeason(state, {
    id: asString(seasonInput.id) || derived.id,
    label: asString(seasonInput.label) || derived.label,
    club: seasonClub || currentTeam || currentClub,
    startedAt: asDate(seasonInput.startedAt) || date,
    endedAt: seasonInput.endedAt ?? null,
    status: asString(seasonInput.status || 'active'),
    notes: asString(seasonInput.notes || '开局赛季'),
  }, options);

  setInitialAbilities(state, {
    date,
    reason: asString(data.notes) || '开局建档',
    values: normalizeAbilityValues(asObject(data.abilities)),
  }, options);

  const openingText = asString(data.openingText).trim();
  const notes = asString(data.notes).trim();
  if (openingText) {
    addMiscellaneous(state, {
      date,
      key: 'career_opening',
      value: openingText,
      tags: ['开局', '开场白'],
      notes,
    }, options);
  }

  // 系统标记：标识本账本已完成开局建档，作为一次性确认边界的唯一依据。
  // 与 career_opening 独立保存，因为 openingText 可能为空。
  addMiscellaneous(state, {
    date,
    key: 'career_start',
    value: date,
    tags: ['system', '开局'],
    notes: notes || '开局建档已确认',
  }, options);

  return validateAndReturn(state);
}
