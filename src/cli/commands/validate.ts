/**
 * Validate Command
 *
 * Validate a chat export: check format, count messages, list participants.
 */

import { detectChatSource, parseChatWithStats, VERSION } from '../../index.js'
import type { CLIArgs } from '../args.js'
import { readInputFile } from '../io.js'
import type { Logger } from '../logger.js'

/**
 * Format participant list, showing top 5 + "and N others" if more.
 */
function formatParticipants(senders: readonly string[]): string {
  if (senders.length <= 5) {
    return senders.join(', ')
  }
  const top5 = senders.slice(0, 5).join(', ')
  const remaining = senders.length - 5
  return `${top5}, and ${remaining} others`
}

/**
 * Format chat source for display.
 */
function formatSource(source: 'whatsapp' | 'imessage'): string {
  if (source === 'whatsapp') {
    return 'WhatsApp'
  }
  return 'iMessage'
}

export async function cmdValidate(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap Validate v${VERSION}`)
  logger.log('\n🔍 Validating chat export...')

  // Read and parse
  const content = await readInputFile(args.input)
  const source = detectChatSource(content)
  const result = parseChatWithStats(content)

  // Validation checks
  if (result.messageCount === 0) {
    logger.error('✗ No messages found - invalid or empty export')
    process.exit(1)
  }

  // Success output
  logger.success(`✓ Valid ${formatSource(source)} export`)
  logger.log(`   ${result.messageCount.toLocaleString()} messages`)

  const startDate = result.dateRange.start.toISOString().split('T')[0]
  const endDate = result.dateRange.end.toISOString().split('T')[0]
  logger.log(`   Date range: ${startDate} to ${endDate}`)

  logger.log(
    `   ${result.senders.length} participant${result.senders.length !== 1 ? 's' : ''}: ` +
      formatParticipants(result.senders)
  )

  if (result.urlCount > 0) {
    logger.log(`   ${result.urlCount} messages contain URLs`)
  }

  // Format detection note
  if (args.verbose) {
    logger.log(`\n   Format auto-detected: ${source}`)
    if (source === 'imessage') {
      logger.log('   (exported via imessage-exporter)')
    }
  }
}
