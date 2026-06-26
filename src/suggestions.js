import { DRAFT_TYPES } from './constants.js';
import { createLedgerId, createDraft } from './ledger-actions.js';

const SUGGESTION_RE = /<football_ledger_suggestion\b[^>]*>([\s\S]*?)<\/football_ledger_suggestion>/gi;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashString(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSuggestionFingerprint(source, suggestionIndex, content) {
  const normalized = typeof content === 'string' ? content : stableStringify(content);
  return [
    source.chatId ?? '',
    source.messageId ?? '',
    source.swipeId ?? 0,
    suggestionIndex,
    hashString(normalized),
  ].join(':');
}

export function parseSuggestionBlocks(text, source = {}) {
  const blocks = [];
  const content = String(text || '');
  let match;
  let suggestionIndex = 0;
  SUGGESTION_RE.lastIndex = 0;
  while ((match = SUGGESTION_RE.exec(content))) {
    const rawJson = match[1].trim();
    const blockSource = {
      chatId: source.chatId ?? null,
      messageId: source.messageId ?? '',
      swipeId: Number.isInteger(source.swipeId) ? source.swipeId : 0,
      suggestionIndex,
      contentHash: '',
    };
    try {
      const parsed = JSON.parse(rawJson);
      const type = DRAFT_TYPES.includes(parsed.type) ? parsed.type : 'miscellaneous';
      const payload = parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload) ? parsed.payload : {};
      const fingerprint = createSuggestionFingerprint(blockSource, suggestionIndex, { type: parsed.type, payload });
      blockSource.contentHash = fingerprint;
      blocks.push({
        type,
        status: DRAFT_TYPES.includes(parsed.type) ? 'pending' : 'invalid',
        payload,
        source: blockSource,
        validationErrors: DRAFT_TYPES.includes(parsed.type) ? [] : [`未知建议类型：${parsed.type}`],
        rawText: rawJson,
      });
    } catch (error) {
      const fingerprint = createSuggestionFingerprint(blockSource, suggestionIndex, rawJson);
      blockSource.contentHash = fingerprint;
      blocks.push({
        type: 'miscellaneous',
        status: 'invalid',
        payload: {},
        source: blockSource,
        validationErrors: [`JSON 解析失败：${error.message}`],
        rawText: rawJson,
      });
    }
    suggestionIndex += 1;
  }
  return blocks;
}

export function addSuggestionDrafts(state, text, source = {}, options = {}) {
  const blocks = parseSuggestionBlocks(text, source);
  const known = new Set(state.drafts.map((draft) => draft.source?.contentHash).filter(Boolean));
  let added = 0;
  for (const block of blocks) {
    if (known.has(block.source.contentHash)) continue;
    createDraft(state, {
      ...block,
      id: createLedgerId('draft'),
    }, options);
    known.add(block.source.contentHash);
    added += 1;
  }
  return { state, added, found: blocks.length };
}

export function getSuggestionSchema(type) {
  const schemas = {
    match: {
      type: 'match',
      payload: {
        date: 'YYYY-MM-DD',
        seasonId: '',
        competition: '',
        club: '',
        opponent: '',
        homeAway: 'home',
        goalsFor: 0,
        goalsAgainst: 0,
        started: false,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        rating: null,
        notable: false,
        notes: '',
      },
    },
    contract: {
      type: 'contract',
      payload: {
        club: '',
        contractType: 'professional',
        startDate: 'YYYY-MM-DD',
        endDate: 'YYYY-MM-DD',
        wageAmountMinor: 1,
        wageCurrency: 'DEM',
        wagePeriod: 'weekly',
        bonuses: '',
        clauses: '',
        active: true,
        notes: '',
      },
    },
    transaction: {
      type: 'transaction',
      payload: {
        date: 'YYYY-MM-DD',
        direction: 'income',
        category: 'salary',
        amountMinor: 1,
        currency: 'DEM',
        description: '',
        relatedContractId: null,
        notes: '',
      },
    },
    ability_change: {
      type: 'ability_change',
      payload: {
        date: 'YYYY-MM-DD',
        ability: 'passing',
        delta: 1,
        evaluationPeriod: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' },
        reason: '',
        evidence: [],
        sourceRecordIds: [],
      },
    },
    miscellaneous: {
      type: 'miscellaneous',
      payload: {
        date: 'YYYY-MM-DD',
        key: '',
        value: '',
        tags: [],
        notes: '',
      },
    },
  };
  return type ? schemas[type] || null : schemas;
}

export function buildModelSuggestionInstructions() {
  return [
    '只有比赛正式结束、合同正式签订、款项实际发生、能力评估正式完成时，才输出 <football_ledger_suggestion>。',
    '不要为普通训练、口头讨论、未完成谈判或尚未发生的未来事件输出正式账本建议。',
    '建议块必须放在叙事正文之后。插件会要求用户确认，模型不得假设建议已经写入。',
    '不要在建议块中虚构未发生的数据，不要输出普通自然语言摘要作为账本事实。',
    '',
    '比赛建议示例：',
    '<football_ledger_suggestion>',
    JSON.stringify(getSuggestionSchema('match'), null, 2),
    '</football_ledger_suggestion>',
    '',
    '合同建议示例：',
    '<football_ledger_suggestion>',
    JSON.stringify(getSuggestionSchema('contract'), null, 2),
    '</football_ledger_suggestion>',
    '',
    '财务建议示例：',
    '<football_ledger_suggestion>',
    JSON.stringify(getSuggestionSchema('transaction'), null, 2),
    '</football_ledger_suggestion>',
    '',
    '能力建议示例：',
    '<football_ledger_suggestion>',
    JSON.stringify(getSuggestionSchema('ability_change'), null, 2),
    '</football_ledger_suggestion>',
  ].join('\n');
}
