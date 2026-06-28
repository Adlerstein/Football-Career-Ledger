// Player status action.

import { cloneJson } from '../schema.js';
import { asArray, asString, pushOperation, validateAndReturn } from './core.js';

export function updatePlayerStatus(state, patch, options = {}) {
  const before = cloneJson(state.player);
  state.player = {
    ...state.player,
    ...patch,
    secondaryPositions: asArray(patch.secondaryPositions ?? state.player.secondaryPositions).map((item) => asString(item)).filter(Boolean),
  };
  pushOperation(state, {
    type: 'update_player',
    entityType: 'player',
    entityId: 'player',
    before,
    after: state.player,
  }, options.timestamp);
  return validateAndReturn(state);
}
