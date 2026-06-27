// Small dependency-free helpers shared across modules. Kept here so the same
// implementation isn't duplicated between ledger-actions, storage and others.

export function createLedgerId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Replace the matching item in place when an id already exists, otherwise prepend
// the new item. Used by the reducers so a record's position is stable on update.
export function upsertById(items, item) {
  const index = items.findIndex((row) => row.id === item.id);
  if (index < 0) return [item, ...items];
  return items.map((row, rowIndex) => rowIndex === index ? item : row);
}
