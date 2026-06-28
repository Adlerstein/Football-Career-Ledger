import test from 'node:test';
import assert from 'node:assert/strict';

import { logger } from '../src/logger.js';

test('logger buffers entries, normalises details, and clears', () => {
  logger.clear();
  logger.info('hello', { a: 1 });
  logger.warn('careful');
  logger.error('boom', new Error('bad'));

  const list = logger.list();
  assert.equal(list.length, 3);
  assert.equal(list[0].level, 'info');
  assert.equal(list[0].message, 'hello');
  assert.equal(list[0].details, '{"a":1}');
  assert.equal(list[1].details, '');
  assert.equal(list[2].level, 'error');
  assert.equal(list[2].details, 'bad');

  logger.clear();
  assert.equal(logger.list().length, 0);
});
