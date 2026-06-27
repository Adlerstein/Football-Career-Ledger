import { DRAFT_TYPES } from './constants.js';
import { createDraft } from './ledger-actions.js';
import { createLedgerId } from './utils.js';

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
    career_start: {
      type: 'career_start',
      payload: {
        date: 'YYYY-MM-DD',
        openingText: '',
        player: {
          name: '',
          currentClub: '',
          currentTeam: '',
          primaryPosition: '',
          secondaryPositions: [],
          careerStage: 'youth',
          squadRole: 'prospect',
          defaultCurrency: 'DEM',
        },
        season: {
          id: '1998-99',
          label: '1998/99',
          club: '',
          startedAt: 'YYYY-MM-DD',
          endedAt: null,
          status: 'active',
          notes: '开局赛季',
        },
        abilities: {
          pace: 0,
          shooting: 0,
          passing: 0,
          control: 0,
          defending: 0,
          physical: 0,
          awareness: 0,
        },
        notes: '开局建档',
      },
    },
  };
  return type ? schemas[type] || null : schemas;
}

export function buildModelSuggestionInstructions() {
  return [
    '只有当比赛真的踢完、合同真的签了、钱真的进出、能力评估真的做完，才输出 <football_ledger_suggestion>。',
    '普通训练、随口一提、还没谈成的合同、还没发生的事，都不要输出建议。',
    '建议块放在正文后面。要等用户确认才算数，别当成已经写进账本了。',
    '不要编没发生的数据，也不要把一段普通叙述直接当成账本事实。',
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
    '',
    'career_start 只在开局时用一次，一次性写入球员资料、开局赛季、七项初始能力和可选的开场白。',
    '只有用户明确完成开局建档、确认创建角色，或外部建档 UI 给出正式结果时，才输出 career_start。',
    '普通剧情、训练、比赛、转会传闻都不要输出 career_start。已经有能力历史时再确认会失败，不会覆盖原有能力。',
    '开局建档建议示例：',
    '<football_ledger_suggestion>',
    JSON.stringify(getSuggestionSchema('career_start'), null, 2),
    '</football_ledger_suggestion>',
  ].join('\n');
}
