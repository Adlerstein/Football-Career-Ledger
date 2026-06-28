import { createReferenceIndex, validateReferenceDataset } from './dataset.js';

const DB_NAME = 'football-reference-scout';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

const memoryDatasets = new Map();

export function createDatasetStore({ indexedDBFactory = globalThis.indexedDB } = {}) {
  const hasIndexedDb = Boolean(indexedDBFactory?.open);

  async function importDatasetFromJson(dataset) {
    const validation = validateReferenceDataset(dataset);
    if (!validation.ok) {
      throw Object.assign(new Error(`Invalid football reference dataset: ${validation.errors.join('; ')}`), {
        code: 'FOOTBALL_REF_INVALID_DATASET',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    const id = String(dataset.meta?.datasetId || '').trim();
    if (!id) {
      throw Object.assign(new Error('Dataset meta.datasetId is required.'), {
        code: 'FOOTBALL_REF_MISSING_DATASET_ID',
      });
    }

    const index = createReferenceIndex(dataset);
    const status = {
      ...index.getStatus(),
      importedAt: new Date().toISOString(),
      warnings: validation.warnings,
    };
    await putRecord({ id, dataset: structuredCloneSafe(dataset), status });
    return status;
  }

  async function listDatasets() {
    return (await getAllRecords())
      .map((record) => ({ ...record.status }))
      .sort((left, right) => String(left.datasetId).localeCompare(String(right.datasetId)));
  }

  async function exportDataset(datasetId) {
    const record = await getRecord(datasetId);
    return record ? structuredCloneSafe(record.dataset) : null;
  }

  async function deleteDataset(datasetId) {
    if (!datasetId) return false;
    if (!hasIndexedDb) {
      return memoryDatasets.delete(datasetId);
    }
    const db = await openDb();
    await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(datasetId));
    db.close();
    return true;
  }

  async function loadDataset(datasetId) {
    const record = await getRecord(datasetId);
    return record ? structuredCloneSafe(record.dataset) : null;
  }

  async function getDatasetStatus(datasetId) {
    const record = await getRecord(datasetId);
    return record ? { ...record.status } : null;
  }

  async function putRecord(record) {
    if (!hasIndexedDb) {
      memoryDatasets.set(record.id, structuredCloneSafe(record));
      return;
    }
    const db = await openDb();
    await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record));
    db.close();
  }

  async function getRecord(datasetId) {
    if (!datasetId) return null;
    if (!hasIndexedDb) {
      return memoryDatasets.get(datasetId) || null;
    }
    const db = await openDb();
    const record = await requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(datasetId));
    db.close();
    return record || null;
  }

  async function getAllRecords() {
    if (!hasIndexedDb) {
      return Array.from(memoryDatasets.values()).map((record) => structuredCloneSafe(record));
    }
    const db = await openDb();
    const records = await requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
    db.close();
    return records;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDBFactory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return Object.freeze({
    importDatasetFromJson,
    listDatasets,
    exportDataset,
    deleteDataset,
    loadDataset,
    getDatasetStatus,
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
