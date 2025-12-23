/**
 * Classify Step
 *
 * AI-powered classification of candidate messages into activities.
 * Uses caching at both pipeline and API levels.
 */

import { classifyMessages, filterActivities, sortActivitiesByScore } from '../../index'
import type { ScrapedMetadata } from '../../scraper/types'
import type { CandidateMessage, ClassifiedActivity, ClassifierConfig } from '../../types'
import { resolveModelConfig, resolveUserContext } from '../model'
import type { PipelineContext } from './context'

/**
 * Stats saved to classify_stats.json
 */
interface ClassifyStats {
  readonly candidatesClassified: number
  readonly activitiesFound: number
  readonly model: string
  readonly provider: string
  readonly batchCount: number
  readonly cachedBatches: number
}

/**
 * Result of the classify step.
 */
interface ClassifyResult {
  /** Classified activities */
  readonly activities: readonly ClassifiedActivity[]
  /** Whether result was from cache */
  readonly fromCache: boolean
  /** Classification stats */
  readonly stats: ClassifyStats
}

/**
 * Classify step options.
 */
interface ClassifyOptions {
  /** Home country for location context */
  readonly homeCountry?: string | undefined
  /** Timezone for date context */
  readonly timezone?: string | undefined
  /** URL metadata from scrape step */
  readonly urlMetadata?: Map<string, ScrapedMetadata> | undefined
  /** Batch size for API calls (default 30) */
  readonly batchSize?: number | undefined
  /** Skip logging */
  readonly quiet?: boolean | undefined
}

/**
 * Run the classify step.
 *
 * Checks pipeline cache first, calls classifier API if needed.
 * Uses API cache for individual batch results.
 */
export async function stepClassify(
  ctx: PipelineContext,
  candidates: readonly CandidateMessage[],
  options?: ClassifyOptions
): Promise<ClassifyResult> {
  const { pipelineCache, apiCache, logger, noCache, cacheDir } = ctx

  // Check pipeline cache (skip if noCache)
  if (!noCache && pipelineCache.hasStage('classifications')) {
    const activities = pipelineCache.getStage<ClassifiedActivity[]>('classifications') ?? []
    const stats = pipelineCache.getStage<ClassifyStats>('classify_stats')
    if (!options?.quiet) {
      logger.log('\n🤖 Classifying candidates... 📦 cached')
    }
    return {
      activities,
      fromCache: true,
      stats: stats ?? {
        candidatesClassified: candidates.length,
        activitiesFound: activities.length,
        model: 'unknown',
        provider: 'unknown',
        batchCount: 0,
        cachedBatches: 0
      }
    }
  }

  if (candidates.length === 0) {
    if (!options?.quiet) {
      logger.log('\n🤖 Classifying candidates... (no candidates)')
    }
    const stats: ClassifyStats = {
      candidatesClassified: 0,
      activitiesFound: 0,
      model: 'none',
      provider: 'none',
      batchCount: 0,
      cachedBatches: 0
    }
    pipelineCache.setStage('classify_stats', stats)
    pipelineCache.setStage('classifications', [])
    return { activities: [], fromCache: false, stats }
  }

  // Resolve model and context
  const { provider, apiModel: model, apiKey } = resolveModelConfig()
  const { homeCountry, timezone } = await resolveUserContext({
    argsHomeCountry: options?.homeCountry,
    argsTimezone: options?.timezone,
    cacheDir,
    logger
  })

  const batchSize = options?.batchSize ?? 30
  const totalBatches = Math.ceil(candidates.length / batchSize)
  let cachedBatches = 0

  if (!options?.quiet) {
    logger.log(`\n🤖 Classifying ${candidates.length} candidates with ${model}...`)
  }

  const config: ClassifierConfig = {
    provider,
    apiKey,
    model,
    homeCountry,
    timezone,
    urlMetadata: options?.urlMetadata,
    batchSize,
    onBatchStart: (info) => {
      if (info.fromCache) {
        cachedBatches++
        if (!options?.quiet) {
          logger.log(
            `   [${info.batchIndex + 1}/${info.totalBatches}] ${info.candidateCount} candidates 📦 cached`
          )
        }
      } else if (!options?.quiet) {
        logger.log(
          `   [${info.batchIndex + 1}/${info.totalBatches}] Sending ${info.candidateCount} candidates...`
        )
      }
    },
    onBatchComplete: (info) => {
      if (!options?.quiet) {
        logger.log(
          `   [${info.batchIndex + 1}/${info.totalBatches}] ✓ Found ${info.activityCount} activities (${info.durationMs}ms)`
        )
      }
    }
  }

  const result = await classifyMessages(candidates, config, apiCache)

  if (!result.ok) {
    throw new Error(`Classification failed: ${result.error.message}`)
  }

  // Filter and sort activities by score (interesting prioritized over fun)
  const activities = sortActivitiesByScore(filterActivities(result.value))

  const stats: ClassifyStats = {
    candidatesClassified: candidates.length,
    activitiesFound: activities.length,
    model,
    provider,
    batchCount: totalBatches,
    cachedBatches
  }

  // Cache results
  pipelineCache.setStage('classifications', [...activities])
  pipelineCache.setStage('classify_stats', stats)

  if (!options?.quiet) {
    logger.log(`   ✓ ${activities.length} activities found`)
  }

  return { activities, fromCache: false, stats }
}
