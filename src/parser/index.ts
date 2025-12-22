/**
 * Parser Module
 *
 * Parse WhatsApp and iMessage exports into structured messages.
 */

import type { ChatSource, ParsedMessage, ParseResult, ParserOptions } from '../types.js'
import { parseIMessageChat, parseIMessageChatStream } from './imessage.js'
import { parseWhatsAppChat, parseWhatsAppChatStream } from './whatsapp.js'

export { parseIMessageChat, parseIMessageChatStream } from './imessage.js'
export { detectFormat, parseWhatsAppChat, parseWhatsAppChatStream } from './whatsapp.js'

/**
 * Normalize apostrophe variants to straight apostrophe (U+0027).
 *
 * WhatsApp and iMessage exports often use curly apostrophes which don't match
 * regex patterns that use straight apostrophes (e.g., "Let's" vs "Let's").
 *
 * Handles:
 * - ' (U+2019) Right Single Quotation Mark (most common in iOS)
 * - ' (U+2018) Left Single Quotation Mark
 * - ʼ (U+02BC) Modifier Letter Apostrophe
 * - ` (U+0060) Grave Accent (backtick, sometimes used as apostrophe)
 */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[\u2019\u2018\u02BC`]/g, "'")
}

/**
 * Detect the chat source from content.
 */
export function detectChatSource(content: string): ChatSource {
  // Check for WhatsApp patterns (timestamp in brackets)
  if (/^\[\d{1,2}\/\d{1,2}\/\d{2,4},/.test(content)) {
    return 'whatsapp'
  }

  // Check for Android WhatsApp pattern
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*-/.test(content)) {
    return 'whatsapp'
  }

  // Check for iMessage pattern (month name at start)
  if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}\s+\d{1,2}:\d{2}:\d{2} [AP]M/.test(content)) {
    return 'imessage'
  }

  // Default to whatsapp
  return 'whatsapp'
}

/**
 * Parse a chat export (auto-detect format).
 */
export function parseChat(raw: string, options?: ParserOptions): ParsedMessage[] {
  const source = detectChatSource(raw)

  if (source === 'imessage') {
    return parseIMessageChat(raw)
  }

  return parseWhatsAppChat(raw, options)
}

/**
 * Parse a chat export and return detailed results.
 */
export function parseChatWithStats(raw: string, options?: ParserOptions): ParseResult {
  const messages = parseChat(raw, options)

  const senders = [...new Set(messages.map((m) => m.sender))]
  const timestamps = messages.map((m) => m.timestamp)
  const urlCount = messages.reduce((count, m) => count + (m.urls?.length ?? 0), 0)

  const sortedTimestamps = timestamps.sort((a, b) => a.getTime() - b.getTime())
  const start = sortedTimestamps[0] ?? new Date()
  const end = sortedTimestamps[sortedTimestamps.length - 1] ?? new Date()

  return {
    messages,
    senders,
    dateRange: { start, end },
    messageCount: messages.length,
    urlCount
  }
}

/**
 * Parse a chat export (streaming, auto-detect format).
 * Note: For streaming, caller must provide the source type since we can't peek ahead.
 */
export async function* parseChatStream(
  lines: AsyncIterable<string>,
  source: ChatSource,
  options?: ParserOptions
): AsyncIterable<ParsedMessage> {
  if (source === 'imessage') {
    yield* parseIMessageChatStream(lines)
  } else {
    yield* parseWhatsAppChatStream(lines, options)
  }
}
