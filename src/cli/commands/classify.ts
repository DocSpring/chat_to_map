/**
 * Classify Command
 *
 * AI-powered classification of candidates into activities.
 * Caches results to pipeline cache for subsequent steps.
 */

import { writeFile } from 'node:fs/promises'
import { formatLocation } from '../../types'
import type { CLIArgs } from '../args'
import { formatDate, getCategoryEmoji, initCommand, truncate } from '../helpers'
import type { Logger } from '../logger'
import { stepClassify } from '../steps/classify'
import { stepScan } from '../steps/scan'
import { stepScrape } from '../steps/scrape'

interface ClassifyOutput {
  candidatesClassified: number
  activitiesFound: number
  model: string
  provider: string
  activities: Array<{
    activity: string
    category: string
    sender: string
    timestamp: string
    city: string | null
    country: string | null
    interestingScore: number
    funScore: number
  }>
}

export async function cmdClassify(args: CLIArgs, logger: Logger): Promise<void> {
  const { ctx } = await initCommand('Classify', args, logger)

  // Get candidates from scan step
  const scanResult = stepScan(ctx, {
    minConfidence: args.minConfidence,
    maxMessages: args.maxMessages,
    quiet: true
  })

  logger.log(`   Found ${scanResult.candidates.length} candidates`)

  if (scanResult.candidates.length === 0) {
    logger.log('\n⚠️  No candidates found. Nothing to classify.')
    return
  }

  // Scrape URLs for metadata (used to enrich classifier prompts)
  const scrapeResult = await stepScrape(ctx, scanResult.candidates, {
    timeout: args.scrapeTimeout,
    quiet: true
  })

  // Dry run: show stats and exit
  if (args.dryRun) {
    logger.log('\n📊 Classification Estimate (dry run)')
    logger.log(`   Candidates to classify: ${scanResult.candidates.length}`)
    logger.log(`   URLs scraped: ${scrapeResult.urls.length}`)
    logger.log(`   Estimated batches: ${Math.ceil(scanResult.candidates.length / 30)}`)
    return
  }

  // Run classify step
  const classifyResult = await stepClassify(ctx, scanResult.candidates, {
    homeCountry: args.homeCountry,
    timezone: args.timezone,
    urlMetadata: scrapeResult.metadataMap,
    batchSize: 30
  })

  // Summary
  logger.log('\n📊 Classification Results')
  logger.log(`   Candidates: ${classifyResult.stats.candidatesClassified}`)
  logger.log(`   Activities: ${classifyResult.stats.activitiesFound}`)
  logger.log(`   Model: ${classifyResult.stats.model} (${classifyResult.stats.provider})`)
  if (classifyResult.stats.cachedBatches > 0) {
    logger.log(
      `   Cached batches: ${classifyResult.stats.cachedBatches}/${classifyResult.stats.batchCount}`
    )
  }

  const output: ClassifyOutput = {
    candidatesClassified: classifyResult.stats.candidatesClassified,
    activitiesFound: classifyResult.stats.activitiesFound,
    model: classifyResult.stats.model,
    provider: classifyResult.stats.provider,
    activities: classifyResult.activities.map((a) => ({
      activity: a.activity,
      category: a.category,
      sender: a.sender,
      timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : String(a.timestamp),
      city: a.city,
      country: a.country,
      interestingScore: a.interestingScore,
      funScore: a.funScore
    }))
  }

  if (args.jsonOutput) {
    const json = JSON.stringify(output, null, 2)
    if (args.jsonOutput === 'stdout') {
      console.log(json)
    } else {
      await writeFile(args.jsonOutput, json)
      logger.success(`\n✓ Saved classification results to ${args.jsonOutput}`)
    }
  } else {
    displayActivities(classifyResult.activities, logger, args.showAll, args.maxResults)
  }
}

function displayActivities(
  activities: readonly import('../../types').ClassifiedActivity[],
  logger: Logger,
  showAll: boolean,
  maxResults: number
): void {
  if (activities.length === 0) {
    logger.log('\n📋 Activities: none found')
    return
  }

  logger.log('\n📋 Activities:')
  logger.log('')

  const displayCount = showAll ? activities.length : Math.min(maxResults, activities.length)

  for (let i = 0; i < displayCount; i++) {
    const a = activities[i]
    if (!a) continue

    const emoji = getCategoryEmoji(a.category)
    const activity = truncate(a.activity, 60)
    const category = a.category.charAt(0).toUpperCase() + a.category.slice(1)

    logger.log(`${i + 1}. ${emoji}  "${activity}"`)
    logger.log(`   → ${category} • ${a.sender} • ${formatDate(a.timestamp)}`)

    const location = formatLocation(a)
    if (location) {
      logger.log(`   📍 ${location}`)
    }

    logger.log(`   ★ interesting: ${a.interestingScore.toFixed(1)}, fun: ${a.funScore.toFixed(1)}`)
    logger.log('')
  }

  if (!showAll && activities.length > maxResults) {
    logger.log(`   ... and ${activities.length - maxResults} more (use --all to show all)`)
  }
}
