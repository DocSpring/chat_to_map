/**
 * Facebook Messenger JSON Export Parser
 *
 * Parses individual chat JSON files from a Messenger `messages.zip` download.
 * Users extract `messages.zip` locally and upload one chat JSON at a time.
 *
 * Each file looks like:
 *   {
 *     "participants": ["Alice", "Bob"],
 *     "threadName": "Bob_15",
 *     "messages": [
 *       {
 *         "isUnsent": false,
 *         "media": [{ "uri": "..." }],
 *         "reactions": [{ "actor": "Alice", "reaction": "😆" }],
 *         "senderName": "Bob",
 *         "text": "Hello",
 *         "timestamp": 1711913758573,
 *         "type": "text" | "link" | "media" | "placeholder"
 *       }
 *     ]
 *   }
 */

import type { MediaType, ParsedMessage } from '../types'
import { chunkMessage, createChunkedMessages, extractUrls, normalizeApostrophes } from './index'
import {
  applyMediaPlaceholder,
  getString,
  isRecord,
  isStringArray,
  parseJsonOrThrow
} from './json-helpers'

interface MessengerExportData {
  readonly participants: readonly string[]
  readonly messages: readonly unknown[]
}

function isMessengerMessageLike(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  const type = getString(value, 'type')
  const sender = getString(value, 'senderName')
  return (
    typeof value.timestamp === 'number' &&
    typeof sender === 'string' &&
    (type === 'text' || type === 'link' || type === 'media' || type === 'placeholder')
  )
}

function isMessengerExportData(value: unknown): value is MessengerExportData {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    return false
  }
  if (!isStringArray(value.participants)) {
    return false
  }
  if (typeof value.threadName !== 'string') {
    return false
  }
  if (value.messages.length === 0) {
    return true
  }
  return value.messages.some(isMessengerMessageLike)
}

/**
 * Detect whether content looks like a Facebook Messenger chat JSON file.
 */
export function isMessengerExport(raw: string): boolean {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('{')) {
    return false
  }

  try {
    return isMessengerExportData(JSON.parse(trimmed) as unknown)
  } catch {
    return false
  }
}

function detectMessageMediaType(message: Record<string, unknown>): MediaType | undefined {
  const type = getString(message, 'type')
  if (type !== 'media') {
    return undefined
  }

  const media = message.media
  if (!Array.isArray(media) || media.length === 0) {
    return undefined
  }

  const first = media[0]
  if (!isRecord(first)) {
    return 'image'
  }

  const uri = getString(first, 'uri')?.toLowerCase() ?? ''
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(uri)) return 'video'
  if (/\.(mp3|m4a|wav|ogg|opus|aac)(\?|$)/.test(uri)) return 'audio'
  if (/\.(gif)(\?|$)/.test(uri)) return 'gif'
  return 'image'
}

function buildContent(text: string, mediaType: MediaType | undefined): string {
  return applyMediaPlaceholder(normalizeApostrophes(text).trim(), mediaType)
}

function readTimestamp(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return new Date(value)
}

function parseMessengerMessage(value: unknown, startId: number): ParsedMessage[] {
  if (!isRecord(value)) {
    return []
  }

  // Skip unsent / placeholder messages — they have no useful content.
  if (value.isUnsent === true || getString(value, 'type') === 'placeholder') {
    return []
  }

  const timestamp = readTimestamp(value.timestamp)
  if (!timestamp) {
    return []
  }

  const sender = getString(value, 'senderName')?.trim()
  if (!sender) {
    return []
  }

  const mediaType = detectMessageMediaType(value)
  const content = buildContent(getString(value, 'text') ?? '', mediaType)
  if (content.length === 0) {
    return []
  }

  const chunks = chunkMessage(content)
  return createChunkedMessages(chunks, {
    startId,
    timestamp,
    sender,
    rawLine: JSON.stringify(value),
    source: 'messenger',
    urls: extractUrls(content),
    hasMedia: mediaType !== undefined,
    mediaType
  })
}

/**
 * Parse a Facebook Messenger chat JSON file.
 */
export function parseMessengerExport(raw: string): ParsedMessage[] {
  const data = parseJsonOrThrow(raw, 'Invalid Messenger export JSON')
  if (!isMessengerExportData(data)) {
    throw new Error('Invalid Messenger export JSON: expected participants and messages')
  }

  const parsedMessages: ParsedMessage[] = []
  let messageId = 0

  for (const message of data.messages) {
    const parsed = parseMessengerMessage(message, messageId)
    parsedMessages.push(...parsed)
    messageId += parsed.length
  }

  return parsedMessages
}
