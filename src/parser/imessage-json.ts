/**
 * iMessage JSON Bundle Parser
 *
 * Parses the multi-chat JSON format produced by the ChatToMap desktop app
 * (one `manifest.json` plus N `chat_NNN.json` files inside a zip).
 *
 * Each `chat_NNN.json` contains:
 *   {
 *     meta: { name, identifier, service, message_count },
 *     messages: [{ timestamp: ISO8601, sender, is_from_me, text }]
 *   }
 *
 * Unlike the iMessage **text** parser (`./imessage.ts`), this format is JSON
 * and bundles multiple chats. Following the Telegram pattern, JSON parsing is
 * non-streaming and exposed via dedicated entry points rather than the
 * generic `parseChat(string)` API.
 */

import type { ChatMetadata, ParsedMessage, ParseResult } from '../types'
import { chunkMessage, createChunkedMessages, extractUrls, normalizeApostrophes } from './index'
import { isRecord } from './json-helpers'

// ---------------------------------------------------------------------------
// Public types describing the on-disk format
// ---------------------------------------------------------------------------

export interface IMessageJsonManifest {
  readonly version: string
  readonly source: 'imessage'
  readonly export_date?: string
  readonly chat_count: number
  readonly total_messages: number
}

export interface IMessageJsonChatMeta {
  readonly name: string
  readonly identifier: string
  readonly service: string
  readonly message_count: number
  /** Number of OTHER participants (excludes device owner). 1 = 1:1 chat. */
  readonly participant_count?: number
}

export interface IMessageJsonMessage {
  readonly timestamp: string
  readonly sender: string
  readonly is_from_me: boolean
  readonly text: string
}

export interface IMessageJsonChat {
  readonly meta: IMessageJsonChatMeta
  readonly messages: readonly IMessageJsonMessage[]
}

/** A chat entry as found in the zip, paired with its filename for traceability. */
export interface IMessageJsonChatEntry {
  /** Filename without extension, e.g. `chat_001`. Used as `chatId`. */
  readonly id: string
  readonly chat: IMessageJsonChat
}

// ---------------------------------------------------------------------------
// Type guards (lenient — they only check shape, not value semantics)
// ---------------------------------------------------------------------------

export function isIMessageJsonManifest(value: unknown): value is IMessageJsonManifest {
  if (!isRecord(value)) return false
  return (
    value.source === 'imessage' &&
    typeof value.version === 'string' &&
    typeof value.chat_count === 'number' &&
    typeof value.total_messages === 'number'
  )
}

function isIMessageJsonChatMeta(value: unknown): value is IMessageJsonChatMeta {
  if (!isRecord(value)) return false
  return (
    typeof value.name === 'string' &&
    typeof value.identifier === 'string' &&
    typeof value.service === 'string' &&
    typeof value.message_count === 'number'
  )
}

function isIMessageJsonMessage(value: unknown): value is IMessageJsonMessage {
  if (!isRecord(value)) return false
  return (
    typeof value.timestamp === 'string' &&
    typeof value.sender === 'string' &&
    typeof value.is_from_me === 'boolean' &&
    typeof value.text === 'string'
  )
}

export function isIMessageJsonChat(value: unknown): value is IMessageJsonChat {
  if (!isRecord(value)) return false
  if (!isIMessageJsonChatMeta(value.meta)) return false
  if (!Array.isArray(value.messages)) return false
  return value.messages.every(isIMessageJsonMessage)
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

/** Resolve the sender label for a message, matching the text parser convention. */
function resolveSender(message: IMessageJsonMessage): string {
  if (message.is_from_me) return 'Me'
  const trimmed = message.sender.trim()
  return trimmed.length > 0 ? trimmed : 'Unknown'
}

/** Parse an ISO 8601 timestamp; returns null on failure (caller skips message). */
function parseTimestamp(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

interface ConvertContext {
  readonly chatId: string
  readonly startId: number
}

/** Convert one JSON message into 0+ ParsedMessages (chunked if long). */
function convertMessage(message: IMessageJsonMessage, context: ConvertContext): ParsedMessage[] {
  const timestamp = parseTimestamp(message.timestamp)
  if (!timestamp) return []

  const content = normalizeApostrophes(message.text).trim()
  if (content.length === 0) return []

  const urls = extractUrls(content)
  const chunks = chunkMessage(content)
  const base = createChunkedMessages(chunks, {
    startId: context.startId,
    timestamp,
    sender: resolveSender(message),
    rawLine: JSON.stringify(message),
    source: 'imessage',
    urls,
    hasMedia: false
  })

  // Attach chatId provenance to every produced chunk.
  return base.map((m) => ({ ...m, chatId: context.chatId }))
}

// ---------------------------------------------------------------------------
// Bundle parsing
// ---------------------------------------------------------------------------

interface BundleAggregate {
  readonly messages: ParsedMessage[]
  readonly chats: ChatMetadata[]
  nextId: number
}

function appendChat(aggregate: BundleAggregate, entry: IMessageJsonChatEntry): void {
  const context: ConvertContext = { chatId: entry.id, startId: aggregate.nextId }
  let cursor = aggregate.nextId
  for (const message of entry.chat.messages) {
    const converted = convertMessage(message, { ...context, startId: cursor })
    aggregate.messages.push(...converted)
    cursor += converted.length
  }
  aggregate.nextId = cursor
  aggregate.chats.push({
    id: entry.id,
    name: entry.chat.meta.name,
    identifier: entry.chat.meta.identifier,
    messageCount: entry.chat.meta.message_count
  })
}

function buildDateRange(messages: readonly ParsedMessage[]): { start: Date; end: Date } {
  if (messages.length === 0) {
    const now = new Date()
    return { start: now, end: now }
  }
  const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  // Non-null assertions are safe: length > 0 guard above.
  if (!first || !last) {
    const now = new Date()
    return { start: now, end: now }
  }
  return { start: first.timestamp, end: last.timestamp }
}

/**
 * Parse a list of iMessage JSON chats into a flat ParseResult, preserving the
 * source chat on each message via `chatId`.
 *
 * The `manifest` is accepted for validation (chat_count check) but its
 * authoritative data is the chats themselves.
 */
export function parseIMessageJsonBundle(
  manifest: IMessageJsonManifest,
  entries: readonly IMessageJsonChatEntry[]
): ParseResult {
  if (entries.length !== manifest.chat_count) {
    throw new Error(
      `iMessage manifest declared chat_count=${manifest.chat_count}` +
        ` but ${entries.length} chat files were provided`
    )
  }

  const aggregate: BundleAggregate = { messages: [], chats: [], nextId: 0 }
  for (const entry of entries) {
    appendChat(aggregate, entry)
  }

  const senders = [...new Set(aggregate.messages.map((m) => m.sender))]
  const urlCount = aggregate.messages.reduce((sum, m) => sum + (m.urls?.length ?? 0), 0)

  return {
    messages: aggregate.messages,
    senders,
    dateRange: buildDateRange(aggregate.messages),
    messageCount: aggregate.messages.length,
    urlCount,
    chats: aggregate.chats
  }
}
