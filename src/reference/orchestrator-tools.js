import { ORCHESTRATOR_TOOL_NAME } from './constants.js';

let registered = false;
let retryInstalled = false;

export function registerOrchestratorTools(context, api) {
  if (registered) return true;
  const registerNow = () => registerOrchestratorToolsNow(context, api);
  if (registerNow()) return true;

  if (!retryInstalled) {
    const appReadyEvent = context?.eventTypes?.APP_READY;
    if (appReadyEvent && typeof context?.eventSource?.on === 'function') {
      retryInstalled = true;
      context.eventSource.on(appReadyEvent, registerNow);
    }
  }

  return false;
}

function registerOrchestratorToolsNow(context, api) {
  const orchestrator = context?.getExtensionApi?.('orchestrator');
  if (!orchestrator || typeof orchestrator.registerOrchestrationTool !== 'function') {
    return false;
  }

  orchestrator.registerOrchestrationTool({
    name: ORCHESTRATOR_TOOL_NAME,
    displayName: 'Football reference capsule',
    mode: 'read',
    description: [
      'Build a compact read-only football reference capsule for the current turn.',
      'Use it before writing match-day scenes. It does not write Ledger, MVU, world info, or season state.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description: 'Latest user message. Omit to let the tool read the last user message from chat.',
        },
        stateTime: {
          type: 'string',
          description: 'Committed MVU /世界/当前时间 at the start of this turn, if known.',
        },
        ledgerSnapshot: {
          type: 'object',
          description: 'Optional Football-Career-Ledger snapshot or career status context.',
        },
      },
      additionalProperties: false,
    },
    exec: async (args = {}, toolCtx = {}) => {
      const userMessage = args.userMessage || getLastUserMessage(toolCtx);
      const ledgerSnapshot = args.ledgerSnapshot || await readLedgerSnapshot(toolCtx);
      const stateTime = args.stateTime || readStateTimeFromContext(toolCtx);
      return api.buildTurnCapsule({ userMessage, stateTime, ledgerSnapshot });
    },
  });

  registered = true;
  return true;
}

async function readLedgerSnapshot(ctx) {
  const ledger = ctx?.getExtensionApi?.('football-career-ledger');
  if (!ledger) return null;
  try {
    if (typeof ledger.getSnapshot === 'function') return await ledger.getSnapshot();
    if (typeof ledger.getCareerStatus === 'function') return { player: await ledger.getCareerStatus() };
  } catch (error) {
    console.warn('[football-reference-scout] failed to read Football-Career-Ledger API', error);
  }
  return null;
}

function getLastUserMessage(ctx) {
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    const message = chat[index];
    if (message?.is_user || message?.role === 'user') {
      return String(message.mes || message.content || '');
    }
  }
  return '';
}

function readStateTimeFromContext(ctx) {
  const candidates = [
    ctx?.variables?.global?.世界?.当前时间,
    ctx?.variables?.local?.世界?.当前时间,
    ctx?.chatMetadata?.variables?.世界?.当前时间,
    globalThis?.chat_metadata?.variables?.世界?.当前时间,
    globalThis?.stat_data?.世界?.当前时间,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
