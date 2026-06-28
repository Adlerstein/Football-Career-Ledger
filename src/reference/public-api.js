import { API_VERSION } from './constants.js';
import { buildTurnCapsule } from './capsule.js';
import { createReferenceIndex, validateReferenceDataset } from './dataset.js';
import { resolveTurnContext } from './turn-context.js';

export function createPublicApi({
  loadDataset,
  dataset,
  datasetStore = null,
  getSettings = () => ({}),
  saveSettings = () => {},
  onDatasetChanged = () => {},
} = {}) {
  let indexPromise = null;
  let indexSourceKey = '';

  async function getIndex() {
    const settings = getSettings() || {};
    const sourceKey = datasetStore && settings.activeDatasetId
      ? `store:${settings.activeDatasetId}`
      : 'bundled';
    if (!indexPromise || sourceKey !== indexSourceKey) {
      indexSourceKey = sourceKey;
      indexPromise = Promise.resolve(resolveDataset(settings))
        .then((loaded) => {
          const validation = validateReferenceDataset(loaded);
          if (!validation.ok) {
            throw Object.assign(new Error(`Invalid football reference dataset: ${validation.errors.join('; ')}`), {
              code: 'FOOTBALL_REF_INVALID_DATASET',
              errors: validation.errors,
            });
          }
          return createReferenceIndex(loaded);
        });
    }
    return indexPromise;
  }

  async function resolveDataset(settings) {
    if (datasetStore && settings.activeDatasetId) {
      const stored = await datasetStore.loadDataset(settings.activeDatasetId);
      if (stored) return stored;
    }
    return typeof loadDataset === 'function' ? loadDataset() : dataset;
  }

  function invalidateIndex() {
    indexPromise = null;
    indexSourceKey = '';
  }

  const api = {
    apiVersion: API_VERSION,
    getReferenceStatus: async () => {
      const index = await getIndex();
      return index.getStatus();
    },
    listDatasets: async () => {
      const statuses = datasetStore ? await datasetStore.listDatasets() : [];
      if (statuses.length > 0) return statuses;
      const status = await thisCallSafeStatus(getIndex);
      return status.datasetId ? [{ ...status, bundled: true }] : [];
    },
    resolveTurnContext: (args = {}) => resolveTurnContext(args),
    queryMatches: async (args = {}) => {
      const index = await getIndex();
      return index.queryMatches(args);
    },
    getMatchDetail: async (args = {}) => {
      const index = await getIndex();
      return index.getMatchDetail(args);
    },
    buildTurnCapsule: async (args = {}) => {
      const index = await getIndex();
      const settings = getSettings() || {};
      const profile = args.profile || {
        seasonId: settings.currentSeasonId,
        team: settings.currentTeam,
        currentDate: settings.currentDate,
      };
      const stateTime = args.stateTime || profile.currentDate || '';
      const turnContext = resolveTurnContext({ ...args, stateTime, profile });
      return buildTurnCapsule({ index, turnContext, options: args.options || {} });
    },
    previewNextCapsule: async (args = {}) => api.buildTurnCapsule(args),
    importDatasetFromJson: async (nextDataset) => {
      if (!datasetStore) {
        throw new Error('Dataset storage is unavailable in this host.');
      }
      const status = await datasetStore.importDatasetFromJson(nextDataset);
      const settings = getSettings() || {};
      settings.activeDatasetId = status.datasetId;
      saveSettings(settings);
      invalidateIndex();
      onDatasetChanged();
      return status;
    },
    exportDataset: async (datasetId) => {
      if (!datasetStore) return null;
      return datasetStore.exportDataset(datasetId);
    },
    deleteDataset: async (datasetId) => {
      if (!datasetStore) return false;
      const deleted = await datasetStore.deleteDataset(datasetId);
      const settings = getSettings() || {};
      if (settings.activeDatasetId === datasetId) {
        settings.activeDatasetId = '';
        saveSettings(settings);
      }
      invalidateIndex();
      onDatasetChanged();
      return deleted;
    },
    getActiveProfile: () => {
      const settings = getSettings() || {};
      return {
        activeDatasetId: settings.activeDatasetId || '',
        seasonId: settings.currentSeasonId || '',
        team: settings.currentTeam || '',
        currentDate: settings.currentDate || '',
      };
    },
    updateActiveProfile: (profile = {}) => {
      const settings = getSettings() || {};
      if ('activeDatasetId' in profile) settings.activeDatasetId = String(profile.activeDatasetId || '');
      if ('seasonId' in profile) settings.currentSeasonId = String(profile.seasonId || '');
      if ('team' in profile) settings.currentTeam = String(profile.team || '');
      if ('currentDate' in profile) settings.currentDate = String(profile.currentDate || '');
      saveSettings(settings);
      invalidateIndex();
      onDatasetChanged();
      return api.getActiveProfile();
    },
  };

  return Object.freeze(api);
}

async function thisCallSafeStatus(getIndex) {
  try {
    const index = await getIndex();
    return index.getStatus();
  } catch (error) {
    return {
      ok: false,
      datasetId: null,
      title: '',
      error: error?.message || String(error),
    };
  }
}

