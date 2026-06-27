import { addSuggestionDrafts } from './suggestions.js';

export function getMessageText(message) {
  return message?.mes || message?.message || message?.text || message?.content || '';
}

export function hasSuggestionBlock(text) {
  return typeof text === 'string' && text.includes('<football_ledger_suggestion');
}

export function resolveMessageId(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'number' || typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    return payload.messageId ?? payload.id ?? payload.message_id ?? payload.index ?? null;
  }
  return null;
}

function resolveSwipeId(message) {
  return Number.isInteger(message.swipe_id) ? message.swipe_id : Number(message.swipe_id ?? 0) || 0;
}

/**
 * Builds the suggestion-message ingestor. All runtime dependencies are injected so
 * the parsing flow can be exercised in tests without a live SillyTavern/Luker context.
 *
 * deps:
 *  - getSettings(): the live settings object (must expose `enabled`).
 *  - getChat(): the chat array/object keyed by message id.
 *  - getChatId(): current chat id string (optional).
 *  - applyDrafts(reducer): runs the reducer against persisted state (e.g. writeLedgerState).
 *  - onDraftsAdded(): optional async hook fired only when new drafts were created.
 *  - processedMessageKeys: optional Set reused for deduplication.
 */
export function createMessageIngestor(deps = {}) {
  const processedMessageKeys = deps.processedMessageKeys instanceof Set ? deps.processedMessageKeys : new Set();

  function isEnabled() {
    return Boolean(deps.getSettings?.()?.enabled);
  }

  function getMessageById(messageId) {
    const chat = deps.getChat?.();
    if (!chat) return null;
    return chat[messageId] ?? null;
  }

  async function processSuggestionMessage(messageId, eventType = 'message') {
    if (!isEnabled()) return 0;
    const message = getMessageById(messageId);
    // Parse any non-system message that explicitly carries a suggestion block,
    // including user messages produced by an external character-creation UI.
    if (!message || message.is_system) return 0;
    const text = getMessageText(message);
    if (!hasSuggestionBlock(text)) return 0;

    const chatId = deps.getChatId?.() || '';
    const swipeId = resolveSwipeId(message);
    // eventType is intentionally excluded from the key: a single message may fire
    // several events (sent/received/generation/scan) and must only be processed once.
    const key = `${chatId}:${messageId}:${swipeId}`;
    if (processedMessageKeys.has(key)) return 0;
    processedMessageKeys.add(key);

    console.info('[football-career-ledger] suggestion blocks detected', {
      eventType,
      messageId: String(messageId),
      isUser: Boolean(message.is_user),
    });

    try {
      let added = 0;
      await deps.applyDrafts?.((state) => {
        const result = addSuggestionDrafts(state, text, {
          chatId,
          messageId: String(messageId),
          swipeId,
        });
        added = result.added;
        return result.state;
      });
      if (added > 0) {
        console.info('[football-career-ledger] suggestion drafts added', {
          eventType,
          messageId: String(messageId),
          added,
        });
        await deps.onDraftsAdded?.();
      }
      return added;
    } catch (error) {
      console.warn('[football-career-ledger] suggestion parsing failed', error);
      return 0;
    }
  }

  async function scanRecentMessagesForSuggestions(limit = 5, eventType = 'scan') {
    if (!isEnabled()) return 0;
    const chat = deps.getChat?.();
    if (!chat) return 0;
    const entries = Array.isArray(chat)
      ? chat.map((message, index) => [index, message])
      : Object.entries(chat);
    let total = 0;
    for (const [messageId] of entries.slice(-limit)) {
      total += await processSuggestionMessage(messageId, eventType);
    }
    return total;
  }

  return { processSuggestionMessage, scanRecentMessagesForSuggestions, processedMessageKeys };
}
