import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportSummary, exportStateJson, parseImportJson } from '../src/import-export.js';
import { buildPromptSummary } from '../src/prompt.js';
import { exampleState } from './helpers.js';

test('exports and imports valid json', () => {
  const json = exportStateJson(exampleState());
  const parsed = parseImportJson(json);
  assert.equal(parsed.matches.length, 1);
  assert.equal(buildImportSummary(parsed).matches, 1);
});

test('rejects invalid import json without producing state', () => {
  assert.throws(() => parseImportJson('{bad'), /JSON 解析失败/);

  const bad = exampleState();
  bad.matches[0].seasonId = 'missing';
  assert.throws(() => parseImportJson(JSON.stringify(bad)), /不存在的赛季/);
});

test('prompt summary respects max length', () => {
  const summary = buildPromptSummary(exampleState(), { maxChars: 80 });
  assert.ok(summary.length <= 80);
});
