/**
 * CLI Helpers
 *
 * Shared utilities for CLI commands.
 */

import { parseChatWithStats } from '../index'
import { type ActivityCategory, CATEGORY_EMOJI, type ParsedMessage } from '../types'
import { readInputFile } from './io'
import type { Logger } from './logger'

// ============================================================================
// Category Display
// ============================================================================

export function getCategoryEmoji(category: ActivityCategory): string {
  return CATEGORY_EMOJI[category] || '📍'
}

// ============================================================================
// Formatting
// ============================================================================

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

// ============================================================================
// Parse with Logging
// ============================================================================

interface ParseWithLogsOptions {
  maxMessages?: number | undefined
}

interface ParseWithLogsOutput {
  messages: ParsedMessage[]
  messageCount: number
  senderCount: number
}

export async function runParseWithLogs(
  input: string,
  logger: Logger,
  options?: ParseWithLogsOptions
): Promise<ParseWithLogsOutput> {
  logger.log('\n📝 Parsing messages...')
  const content = await readInputFile(input)
  const parseResult = parseChatWithStats(content)
  const messages = options?.maxMessages
    ? [...parseResult.messages.slice(0, options.maxMessages)]
    : [...parseResult.messages]
  logger.success(
    `${parseResult.messageCount.toLocaleString()} messages from ${parseResult.senders.length} senders`
  )
  return {
    messages,
    messageCount: parseResult.messageCount,
    senderCount: parseResult.senders.length
  }
}
