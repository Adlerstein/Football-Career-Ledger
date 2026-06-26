import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, migrateState } from '../src/schema.js';
import { validateState } from '../src/validation.js';
import { exampleState } from './helpers.js';

test('creates valid initial state', () => {
  const state = createInitialState('2026-06-26T00:00:00.000Z');
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.player.defaultCurrency, 'DEM');
  assert.equal(state.player.currentTeam, '');
  assert.equal(state.player.careerStage, 'youth');
  assert.equal(state.player.squadRole, 'rotation');
  assert.doesNotThrow(() => validateState(state));
});

test('migrates example state', () => {
  const state = migrateState(exampleState());
  assert.equal(state.abilities.current.passing, 67);
  assert.doesNotThrow(() => validateState(state));
});

test('rejects duplicate ids', () => {
  const state = exampleState();
  state.matches.push({ ...state.matches[0] });
  assert.throws(() => validateState(state), /id 重复/);
});

test('rejects invalid money and ability values', () => {
  const state = exampleState();
  state.finance.transactions[0].amountMinor = -1;
  assert.throws(() => validateState(state), /amountMinor/);

  const state2 = exampleState();
  state2.abilities.current.pace = 120;
  assert.throws(() => validateState(state2), /能力 pace/);
});
