/**
 * Parse Command
 *
 * Parse chat export and show stats.
 */

import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseChatWithStats, VERSION } from '../../index.js'
import type { CLIArgs } from '../args.js'
import { ensureDir, readInputFile } from '../io.js'
import type { Logger } from '../logger.js'

export async function cmdParse(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap Parse v${VERSION}`)
  logger.log('\n📝 Parsing messages...')

  const content = await readInputFile(args.input)
  const result = parseChatWithStats(content)

  const messages = args.maxMessages
    ? [...result.messages.slice(0, args.maxMessages)]
    : [...result.messages]

  logger.success(
    `${result.messageCount.toLocaleString()} messages from ${result.senders.length} senders`
  )
  logger.success(
    `Date range: ${result.dateRange.start.toISOString().split('T')[0]} to ${result.dateRange.end.toISOString().split('T')[0]}`
  )
  logger.success(`${result.urlCount} messages contain URLs`)

  if (args.maxMessages !== undefined) {
    logger.log(`   (limited to first ${args.maxMessages} messages for testing)`)
  }

  if (args.outputDir !== './output') {
    await ensureDir(dirname(args.outputDir))
    const json = JSON.stringify(messages, null, 2)
    await writeFile(args.outputDir, json)
    logger.success(`Saved to ${args.outputDir}`)
  }
}
