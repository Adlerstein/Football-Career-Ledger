// Barrel for the ledger action modules. The implementation lives in
// ./actions/*.js, split by domain; this file preserves the original
// `./ledger-actions.js` import surface so existing callers and tests are
// unaffected. Import directly from ./actions/<domain>.js when you want a
// narrower dependency.

export { pushOperation } from './actions/core.js';
export { buildMatchRecord, addMatch, updateMatch, deleteMatch } from './actions/matches.js';
export {
  buildContractRecord,
  addContract,
  updateContract,
  deleteContract,
  setActiveContract,
} from './actions/contracts.js';
export {
  setOpeningBalance,
  deleteOpeningBalance,
  buildTransactionRecord,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from './actions/finance.js';
export {
  applyAbilityChange,
  setInitialAbilities,
  updateAbilityHistory,
  deleteAbilityHistory,
} from './actions/abilities.js';
export {
  buildMiscRecord,
  addMiscellaneous,
  updateMiscellaneous,
  deleteMiscellaneous,
} from './actions/miscellaneous.js';
export { updatePlayerStatus } from './actions/player.js';
export {
  buildSeasonRecord,
  addSeason,
  updateSeason,
  deleteSeason,
  closeSeason,
  recalculateSeasonClosure,
  createNextSeason,
} from './actions/seasons.js';
export { hasConfirmedCareerStart, applyCareerStart } from './actions/career-start.js';
export {
  createDraft,
  updateDraftPayload,
  updateDraft,
  rejectDraft,
  deleteDraft,
  confirmDraft,
} from './actions/drafts.js';
export { undoLastOperation } from './actions/history.js';
