/**
 * Classify Command
 *
 * AI-powered classification of candidates into activities.
 * Runs: parse → scan → embed → filter → scrape → classify
 */

import { writeFile } from 'node:fs/promises'
import { formatLocation } from '../../types'
import type { CLIArgs } from '../args'
import { formatActivityHeader, initCommandContext } from '../helpers'
import type { Logger } from '../logger'
import { stepClassify } from '../steps/classify'
import { StepRunner } from '../steps/runner'

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
  const { ctx } = await initCommandContext('Classify', args, logger)

  // Use StepRunner to handle dependencies: filter → scrape → classify
  const runner = new StepRunner(ctx, args, logger)

  // Run filter step (which runs parse → scan → embed → filter)
  const { candidates } = await runner.run('filter')

  logger.log(`   Found ${candidates.length} candidates`)

  if (candidates.length === 0) {
    logger.log('\n⚠️  No candidates found. Nothing to classify.')
    return
  }

  // Run scrape step
  const { metadataMap } = await runner.run('scrape')

  // Dry run: show stats and exit
  if (args.dryRun) {
    logger.log('\n📊 Classification Estimate (dry run)')
    logger.log(`   Candidates to classify: ${candidates.length}`)
    logger.log(`   Estimated batches: ${Math.ceil(candidates.length / 30)}`)
    return
  }

  // Run classify step
  const classifyResult = await stepClassify(ctx, candidates, {
    homeCountry: args.homeCountry,
    timezone: args.timezone,
    urlMetadata: metadataMap,
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

    const { line1, line2 } = formatActivityHeader(i, a)
    logger.log(line1)
    logger.log(line2)

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
