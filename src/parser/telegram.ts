/**
 * Telegram Desktop JSON Export Parser
 *
 * Parses Telegram Desktop `result.json` exports into structured messages.
 */

import type { MediaType, ParsedMessage } from '../types'
import { chunkMessage, createChunkedMessages, extractUrls, normalizeApostrophes } from './index'

interface TextParts {
  readonly content: string
  readonly hrefs: readonly string[]
}

interface TelegramExportData {
  readonly messages: readonly unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function hasValue(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  return value !== undefined && value !== null && value !== ''
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function isTelegramMessageLike(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  const type = getString(value, 'type')
  return (type === 'message' || type === 'service') && hasValue(value, 'date')
}

function isTelegramExportData(value: unknown): value is TelegramExportData {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    return false
  }

  if (getString(value, 'type') || getString(value, 'name')) {
    return true
  }

  return value.messages.some(isTelegramMessageLike)
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error('Invalid Telegram export JSON')
  }
}

/**
 * Detect whether content looks like a Telegram Desktop `result.json` export.
 */
export function isTelegramExport(raw: string): boolean {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('{')) {
    return false
  }

  try {
    return isTelegramExportData(JSON.parse(trimmed) as unknown)
  } catch {
    return false
  }
}

function readTextRun(value: unknown): TextParts {
  if (typeof value === 'string') {
    return { content: value, hrefs: [] }
  }

  if (!isRecord(value)) {
    return { content: '', hrefs: [] }
  }

  const text = getString(value, 'text') ?? ''
  const href = getString(value, 'href')
  return { content: text, hrefs: isHttpUrl(href) ? [href] : [] }
}

function readTelegramText(value: unknown): TextParts {
  if (typeof value === 'string') {
    return { content: value, hrefs: [] }
  }

  if (!Array.isArray(value)) {
    return { content: '', hrefs: [] }
  }

  const parts = value.map(readTextRun)
  return {
    content: parts.map((part) => part.content).join(''),
    hrefs: parts.flatMap((part) => part.hrefs)
  }
}

function readEntityHrefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((entity) => getString(entity, 'href'))
    .filter(isHttpUrl)
}

function dedupeUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const url of urls) {
    if (!seen.has(url)) {
      unique.push(url)
      seen.add(url)
    }
  }

  return unique
}

function readUnixSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readTimestamp(message: Record<string, unknown>): Date | null {
  const unixSeconds = readUnixSeconds(message.date_unixtime)
  if (unixSeconds !== undefined) {
    return new Date(unixSeconds * 1000)
  }

  const date = getString(message, 'date')
  if (!date) {
    return null
  }

  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function readSender(message: Record<string, unknown>): string {
  return (
    getString(message, 'from') ??
    getString(message, 'actor') ??
    getString(message, 'from_id') ??
    getString(message, 'actor_id') ??
    'Unknown'
  )
}

function detectTelegramMediaType(message: Record<string, unknown>): MediaType | undefined {
  const mediaType = getString(message, 'media_type')?.toLowerCase()
  const mimeType = getString(message, 'mime_type')?.toLowerCase()

  if (hasValue(message, 'sticker_emoji') || mediaType?.includes('sticker')) return 'sticker'
  if (hasValue(message, 'photo') || mediaType?.includes('photo')) return 'image'
  if (mimeType?.startsWith('image/')) return 'image'
  if (mediaType?.includes('video') || mimeType?.startsWith('video/')) return 'video'
  if (mediaType?.includes('voice') || mediaType?.includes('audio')) return 'audio'
  if (mimeType?.startsWith('audio/')) return 'audio'
  if (hasValue(message, 'file') || mediaType || mimeType) return 'document'

  return undefined
}

function buildContent(text: TextParts, mediaType: MediaType | undefined): string {
  const content = normalizeApostrophes(text.content).trim()
  if (content.length > 0) {
    return content
  }

  return mediaType ? `[${mediaType}]` : ''
}

function collectUrls(message: Record<string, unknown>, content: string, text: TextParts): string[] {
  const entityHrefs = readEntityHrefs(message.text_entities)
  return dedupeUrls([...extractUrls(content), ...text.hrefs, ...entityHrefs])
}

function parseTelegramMessage(value: unknown, startId: number): ParsedMessage[] {
  if (!isRecord(value) || getString(value, 'type') !== 'message') {
    return []
  }

  const timestamp = readTimestamp(value)
  const mediaType = detectTelegramMediaType(value)
  const text = readTelegramText(value.text)
  const content = buildContent(text, mediaType)

  if (!timestamp || content.length === 0) {
    return []
  }

  const chunks = chunkMessage(content)
  return createChunkedMessages(chunks, {
    startId,
    timestamp,
    sender: readSender(value),
    rawLine: JSON.stringify(value) ?? '',
    source: 'telegram',
    urls: collectUrls(value, content, text),
    hasMedia: mediaType !== undefined,
    mediaType
  })
}

/**
 * Parse a Telegram Desktop `result.json` export.
 */
export function parseTelegramExport(raw: string): ParsedMessage[] {
  const data = parseJson(raw)
  if (!isTelegramExportData(data)) {
    throw new Error('Invalid Telegram export JSON: expected messages array')
  }

  const parsedMessages: ParsedMessage[] = []
  let messageId = 0

  for (const message of data.messages) {
    const parsed = parseTelegramMessage(message, messageId)
    parsedMessages.push(...parsed)
    messageId += parsed.length
  }

  return parsedMessages
}
