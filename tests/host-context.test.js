import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHostContext } from '../src/host-context.js';

test('prefers Luker context when both Luker and SillyTavern are available', () => {
  const sillyTavernContext = { host: 'sillytavern' };
  const lukerContext = { host: 'luker' };
  const root = {
    SillyTavern: { getContext: () => sillyTavernContext },
    Luker: { getContext: () => lukerContext },
  };

  assert.equal(resolveHostContext(root), lukerContext);
});

test('falls back to SillyTavern context when Luker context is unavailable', () => {
  const sillyTavernContext = { host: 'sillytavern' };
  const root = {
    SillyTavern: { getContext: () => sillyTavernContext },
    Luker: {},
  };

  assert.equal(resolveHostContext(root), sillyTavernContext);
});

test('returns null when no supported host context is available', () => {
  assert.equal(resolveHostContext({}), null);
});
