export function resolveHostContext(root = globalThis) {
  const providers = [
    root?.Luker,
    root?.SillyTavern,
  ];

  for (const provider of providers) {
    const context = provider?.getContext?.();
    if (context) return context;
  }

  return null;
}
