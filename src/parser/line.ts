/**
 * LINE Text Export Parser
 *
 * Parses LINE chat history `.txt` exports into structured messages.
 */

import type { MediaType, ParsedMessage } from '../types'
import { chunkMessage, createChunkedMessages, extractUrls, normalizeApostrophes } from './index'

interface DateParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface MessageBuilder {
  timestamp: Date
  sender: string
  content: string
  rawLine: string
}

interface LineParserState {
  currentDate: DateParts | null
  currentBuilder: MessageBuilder | null
  messageId: number
}

const LINE_HEADER_PATTERN = /^\[LINE\]\s+Chat (?:history )?with\s+/i
const SAVED_ON_PATTERN = /^Saved on:/i
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i

function normalizeYear(year: string): number {
  return Number.parseInt(year.length === 2 ? `20${year}` : year, 10)
}

function resolveDateParts(first: string, second: string, year: string): DateParts {
  const firstValue = Number.parseInt(first, 10)
  const secondValue = Number.parseInt(second, 10)
  const dateOrder = secondValue > 12 && firstValue <= 12 ? 'month-first' : 'day-first'
  const month = dateOrder === 'month-first' ? firstValue : secondValue
  const day = dateOrder === 'month-first' ? secondValue : firstValue

  return { year: normalizeYear(year), month, day }
}

function parseYearFirstDate(trimmed: string): DateParts | null {
  const match = trimmed.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D.*)?$/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return {
    year: normalizeYear(year ?? '2025'),
    month: Number.parseInt(month ?? '1', 10),
    day: Number.parseInt(day ?? '1', 10)
  }
}

function parseSlashDate(trimmed: string): DateParts | null {
  const match = trimmed.match(/^(?:[^,]+,\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) {
    return null
  }

  const [, first, second, year] = match
  return resolveDateParts(first ?? '1', second ?? '1', year ?? '2025')
}

function parseDateLine(line: string): DateParts | null {
  return parseYearFirstDate(line) ?? parseSlashDate(line)
}

function parseTimeWithDate(dateParts: DateParts, timeStr: string): Date | null {
  const match = timeStr.trim().match(TIME_PATTERN)
  if (!match) {
    return null
  }

  const [, hourText, minuteText, secondText, ampm] = match
  let hour = Number.parseInt(hourText ?? '0', 10)
  const minute = Number.parseInt(minuteText ?? '0', 10)
  const second = Number.parseInt(secondText ?? '0', 10)

  if (ampm?.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0
  if (hour > 23 || minute > 59 || second > 59) return null

  return new Date(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, second)
}

function isIgnorableLine(trimmed: string): boolean {
  return trimmed.length === 0 || LINE_HEADER_PATTERN.test(trimmed) || SAVED_ON_PATTERN.test(trimmed)
}

function detectLineMediaType(content: string): MediaType | undefined {
  const normalized = content.trim().toLowerCase()

  if (/^\[(sticker)\]$/.test(normalized)) return 'sticker'
  if (/^\[(photo|image)\]$/.test(normalized)) return 'image'
  if (/^\[(video)\]$/.test(normalized)) return 'video'
  if (/^\[(audio|voice message)\]$/.test(normalized)) return 'audio'
  if (/^\[(file|document)\]$/.test(normalized)) return 'document'
  if (/^\[(contact)\]$/.test(normalized)) return 'contact'

  return undefined
}

function parseMessageLine(line: string, dateParts: DateParts | null): MessageBuilder | null {
  if (!dateParts) {
    return null
  }

  const fields = line.split('\t')
  if (fields.length < 3) {
    return null
  }

  const timestamp = parseTimeWithDate(dateParts, fields[0] ?? '')
  if (!timestamp) {
    return null
  }

  return {
    timestamp,
    sender: fields[1]?.trim() || 'Unknown',
    content: fields.slice(2).join('\t'),
    rawLine: line
  }
}

function finalizeBuilder(builder: MessageBuilder, startId: number): ParsedMessage[] {
  const content = normalizeApostrophes(builder.content).trim()
  if (content.length === 0) {
    return []
  }

  const mediaType = detectLineMediaType(content)
  const chunks = chunkMessage(content)

  return createChunkedMessages(chunks, {
    startId,
    timestamp: builder.timestamp,
    sender: builder.sender,
    rawLine: builder.rawLine,
    source: 'line',
    urls: extractUrls(content),
    hasMedia: mediaType !== undefined,
    mediaType
  })
}

function finalizeCurrent(state: LineParserState): ParsedMessage[] {
  if (!state.currentBuilder) {
    return []
  }

  const messages = finalizeBuilder(state.currentBuilder, state.messageId)
  state.messageId += messages.length
  state.currentBuilder = null
  return messages
}

function appendContinuation(state: LineParserState, line: string): void {
  if (!state.currentBuilder || line.trim().length === 0) {
    return
  }

  state.currentBuilder.content += `\n${line}`
  state.currentBuilder.rawLine += `\n${line}`
}

function createInitialState(): LineParserState {
  return {
    currentDate: null,
    currentBuilder: null,
    messageId: 0
  }
}

function processLine(line: string, state: LineParserState): ParsedMessage[] {
  const trimmed = line.trim()
  const dateParts = parseDateLine(trimmed)
  if (dateParts) {
    const messages = finalizeCurrent(state)
    state.currentDate = dateParts
    return messages
  }

  if (isIgnorableLine(trimmed)) {
    return []
  }

  const builder = parseMessageLine(line, state.currentDate)
  if (!builder) {
    appendContinuation(state, line)
    return []
  }

  const messages = finalizeCurrent(state)
  state.currentBuilder = builder
  return messages
}

/**
 * Detect whether content looks like a LINE text export.
 */
export function isLineExport(raw: string): boolean {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').slice(0, 50)
  if (lines.some((line) => LINE_HEADER_PATTERN.test(line.trim()))) {
    return true
  }

  const hasDate = lines.some((line) => parseDateLine(line.trim()) !== null)
  const hasMessage = lines.some((line) => parseMessageLine(line, { year: 2025, month: 1, day: 1 }))
  return hasDate && hasMessage
}

/**
 * Parse a LINE text export.
 */
export function parseLineChat(raw: string): ParsedMessage[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const state = createInitialState()
  const messages: ParsedMessage[] = []

  for (const line of normalized.split('\n')) {
    messages.push(...processLine(line, state))
  }

  messages.push(...finalizeCurrent(state))
  return messages
}

/**
 * Parse a LINE text export as a stream.
 */
export async function* parseLineChatStream(
  lines: AsyncIterable<string>
): AsyncIterable<ParsedMessage> {
  const state = createInitialState()

  for await (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    for (const message of processLine(line, state)) {
      yield message
    }
  }

  for (const message of finalizeCurrent(state)) {
    yield message
  }
}
