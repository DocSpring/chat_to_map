/**
 * Scan Command
 *
 * Free heuristic-only scan (no API calls).
 */

import { basename } from 'node:path'
import { VERSION } from '../../index.js'
import type { CLIArgs } from '../args.js'
import { formatDate, runQuickScanWithLogs, truncate } from '../helpers.js'
import type { Logger } from '../logger.js'

export async function cmdScan(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap Scan v${VERSION}`)
  logger.log(`\n📁 ${basename(args.input)}`)

  const { scanResult, hasNoCandidates } = await runQuickScanWithLogs(args.input, logger, {
    maxMessages: args.maxMessages
  })

  logger.log(`\n🔍 Heuristic scan found ${scanResult.stats.totalUnique} potential activities`)
  logger.log(`   Regex patterns: ${scanResult.stats.regexMatches} matches`)
  logger.log(`   URL-based: ${scanResult.stats.urlMatches} matches`)

  if (hasNoCandidates) {
    return
  }

  const candidates = scanResult.candidates.slice(0, args.maxResults)
  logger.log(`\n📋 Top ${candidates.length} candidates (by confidence):`)
  logger.log('')

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (!c) continue
    const msg = truncate(c.content, 70)
    logger.log(`${i + 1}. "${msg}"`)
    logger.log(
      `   ${c.sender} • ${formatDate(c.timestamp)} • confidence: ${c.confidence.toFixed(2)}`
    )
    logger.log('')
  }

  const remaining = scanResult.stats.totalUnique - candidates.length
  if (remaining > 0) {
    logger.log(`   ... and ${remaining} more candidates`)
    logger.log('')
  }

  logger.log(`💡 Run 'chat-to-map preview ${basename(args.input)}' for AI-powered classification`)
}
