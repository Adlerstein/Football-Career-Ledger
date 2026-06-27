const context = globalThis.Luker?.getContext?.() ?? globalThis.SillyTavern?.getContext?.();

const ledgerApi = context.getExtensionApi?.('football-career-ledger');

const snapshot = await ledgerApi?.getSnapshot();

const projection = await ledgerApi?.getMemoryProjection({
  notableMatchLimit: 10,
});

console.log({ snapshot, projection });
