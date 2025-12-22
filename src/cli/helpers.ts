/**
 * CLI Helpers
 *
 * Shared utilities for CLI commands.
 */

import { parseChatWithStats, quickScan } from '../index'
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
// Quick Scan with Logging
// ============================================================================

export interface QuickScanOutput {
  scanResult: ReturnType<typeof quickScan>
  hasNoCandidates: boolean
}

export interface QuickScanWithLogsOptions {
  maxMessages?: number | undefined
}

export async function runQuickScanWithLogs(
  input: string,
  logger: Logger,
  options?: QuickScanWithLogsOptions
): Promise<QuickScanOutput> {
  const content = await readInputFile(input)
  const scanResult = quickScan(content, { maxMessages: options?.maxMessages })

  const startDate = formatDate(scanResult.dateRange.start)
  const endDate = formatDate(scanResult.dateRange.end)
  logger.log(
    `   ${scanResult.messageCount.toLocaleString()} messages from ${scanResult.senderCount} senders`
  )
  logger.log(`   Date range: ${startDate} to ${endDate}`)

  if (options?.maxMessages !== undefined) {
    logger.log(`   (limited to first ${options.maxMessages} messages for testing)`)
  }

  if (scanResult.candidates.length === 0) {
    logger.log('\n⚠️  No activity suggestions found in this chat.')
    return { scanResult, hasNoCandidates: true }
  }

  return { scanResult, hasNoCandidates: false }
}

// ============================================================================
// Parse with Logging
// ============================================================================

export interface ParseWithLogsOptions {
  maxMessages?: number | undefined
}

export interface ParseWithLogsOutput {
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
