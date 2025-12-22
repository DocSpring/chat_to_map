/**
 * Analyze Command
 *
 * Full pipeline with caching: parse → candidates → scrape → classify → geocode → export
 */

import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { FilesystemCache } from '../../cache/filesystem'
import { PipelineCache } from '../../cache/pipeline'
import {
  classifyMessages,
  extractCandidatesByHeuristics,
  filterActivities,
  geocodeActivities,
  parseChatWithStats,
  VERSION
} from '../../index'
import { scrapeAndEnrichCandidates } from '../../scraper/enrich'
import type {
  CandidateMessage,
  ClassifiedActivity,
  ClassifierConfig,
  GeocodedActivity,
  GeocoderConfig,
  ParsedMessage
} from '../../types'
import type { CLIArgs } from '../args'
import { readInputFile } from '../io'
import type { Logger } from '../logger'
import { resolveContext, resolveModelConfig } from '../model'
import { runExport } from '../pipeline'

export async function cmdAnalyze(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap v${VERSION}`)
  logger.log(`\n📁 Reading: ${args.input}`)

  // Initialize caches
  const content = await readInputFile(args.input)
  const cacheDir = join(homedir(), '.cache', 'chat-to-map')
  const pipelineCache = new PipelineCache(cacheDir)
  const apiCache = new FilesystemCache(cacheDir)

  const run = pipelineCache.getOrCreateRun(args.input, content)
  logger.log(`\n📂 Pipeline cache: ${basename(run.runDir)}`)

  // Step 1: Parse messages
  let messages: ParsedMessage[]
  if (pipelineCache.hasStage('messages')) {
    messages = pipelineCache.getStage<ParsedMessage[]>('messages') ?? []
    logger.log('\n📝 Parsing messages... 📦 cached')
    logger.success(`${messages.length.toLocaleString()} messages`)
  } else {
    logger.log('\n📝 Parsing messages...')
    const result = parseChatWithStats(content)
    messages = args.maxMessages
      ? [...result.messages.slice(0, args.maxMessages)]
      : [...result.messages]
    pipelineCache.setStage('messages', messages)
    logger.success(
      `${result.messageCount.toLocaleString()} messages from ${result.senders.length} senders`
    )
  }

  if (args.dryRun) {
    logger.log('\n📊 Dry run complete. No API calls made.')
    return
  }

  // Step 2: Extract candidates
  let candidates: CandidateMessage[]
  if (pipelineCache.hasStage('candidates.heuristics')) {
    candidates = pipelineCache.getStage<CandidateMessage[]>('candidates.heuristics') ?? []
    logger.log('\n🔍 Extracting candidates... 📦 cached')
    logger.success(`${candidates.length} candidates`)
  } else {
    logger.log('\n🔍 Extracting candidates...')
    const result = extractCandidatesByHeuristics(messages, { minConfidence: args.minConfidence })
    candidates = [...result.candidates]
    pipelineCache.setStage('candidates.heuristics', candidates)
    logger.success(
      `Regex: ${result.regexMatches}, URL: ${result.urlMatches}, Total: ${result.totalUnique}`
    )
  }

  if (candidates.length === 0) {
    logger.log('\n⚠️  No candidates found. Nothing to process.')
    return
  }

  // Step 3: Scrape URLs
  let enrichedCandidates: CandidateMessage[]
  if (pipelineCache.hasStage('scraped_urls')) {
    enrichedCandidates = pipelineCache.getStage<CandidateMessage[]>('scraped_urls') ?? candidates
    logger.log('\n🔗 Scraping URLs... 📦 cached')
  } else {
    enrichedCandidates = await scrapeAndEnrichCandidates(candidates, {
      timeout: args.scrapeTimeout,
      concurrency: args.scrapeConcurrency,
      cache: apiCache,
      onScrapeStart: ({ urlCount }) => {
        logger.log(urlCount > 0 ? `\n🔗 Scraping ${urlCount} URLs...` : '\n🔗 No URLs to scrape')
      },
      onUrlScraped: ({ url, success, current, total }) => {
        if (args.verbose) {
          const status = success ? '✓' : '✗'
          const domain = new URL(url).hostname.replace('www.', '')
          logger.log(`   [${current}/${total}] ${status} ${domain}`)
        }
      }
    })
    pipelineCache.setStage('scraped_urls', enrichedCandidates)
  }

  // Step 4: Classify with AI
  let classifications: ClassifiedActivity[]
  if (pipelineCache.hasStage('classifications')) {
    classifications = pipelineCache.getStage<ClassifiedActivity[]>('classifications') ?? []
    logger.log('\n🤖 Classifying... 📦 cached')
    logger.success(`${classifications.length} activities`)
  } else {
    classifications = await runClassifyStep(enrichedCandidates, args, logger, apiCache)
    pipelineCache.setStage('classifications', classifications)
  }

  if (classifications.length === 0) {
    logger.log('\n⚠️  No activities found after classification.')
    return
  }

  // Step 5: Geocode
  let geocoded: GeocodedActivity[]
  if (pipelineCache.hasStage('geocodings')) {
    geocoded = pipelineCache.getStage<GeocodedActivity[]>('geocodings') ?? []
    logger.log('\n📍 Geocoding... 📦 cached')
    const mapped = geocoded.filter((g) => g.latitude !== undefined).length
    logger.success(`${mapped}/${geocoded.length} geocoded`)
  } else {
    geocoded = await runGeocodeStep(classifications, args, logger)
    pipelineCache.setStage('geocodings', geocoded)
  }

  // Step 6: Export
  await runExport(geocoded, args, logger, args.input)

  const mapPath = join(args.outputDir, 'map.html')
  logger.log(`\n✨ Done! Open ${mapPath} to view your activity map.`)
}

async function runClassifyStep(
  candidates: CandidateMessage[],
  args: CLIArgs,
  logger: Logger,
  cache: FilesystemCache
): Promise<ClassifiedActivity[]> {
  const { provider, apiModel: model, apiKey } = resolveModelConfig()
  const { homeCountry, timezone } = resolveContext(args.homeCountry, args.timezone)
  const batchSize = 10
  const totalBatches = Math.ceil(candidates.length / batchSize)

  logger.log(`\n🤖 Classifying ${candidates.length} candidates with ${model}...`)
  logger.log(`   Processing in ${totalBatches} batches of ${batchSize}`)

  const config: ClassifierConfig = {
    provider,
    apiKey,
    model,
    homeCountry,
    timezone,
    batchSize,
    onBatchStart: (info) => {
      const n = info.batchIndex + 1
      logger.log(`   [${n}/${info.totalBatches}] Sending ${info.candidateCount} candidates...`)
    },
    onBatchComplete: (info) => {
      const n = info.batchIndex + 1
      logger.log(
        `   [${n}/${info.totalBatches}] ✓ ${info.activityCount} activities (${info.durationMs}ms)`
      )
    },
    onCacheCheck: (info) => {
      if (args.verbose && info.hit) {
        logger.log(`   [${info.batchIndex + 1}] 📦 API cache hit`)
      }
    }
  }

  const result = await classifyMessages(candidates, config, cache)
  if (!result.ok) {
    throw new Error(`Classification failed: ${result.error.message}`)
  }

  const activities = filterActivities(result.value)
  const errands = result.value.filter((s) => !s.isActivity || s.activityScore < 0.5)

  logger.log('')
  logger.success(`Activities: ${activities.length}`)
  logger.success(`Errands (filtered): ${errands.length}`)

  return activities
}

async function runGeocodeStep(
  classifications: ClassifiedActivity[],
  args: CLIArgs,
  logger: Logger
): Promise<GeocodedActivity[]> {
  if (args.skipGeocoding) {
    logger.log('\n📍 Skipping geocoding (--skip-geocoding)')
    return classifications.map((s) => ({ ...s }))
  }

  logger.log('\n📍 Geocoding locations...')
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    logger.error('GOOGLE_MAPS_API_KEY not set, skipping geocoding')
    return classifications.map((s) => ({ ...s }))
  }

  const config: GeocoderConfig = {
    apiKey,
    defaultCountry: args.homeCountry
  }

  const geocoded = await geocodeActivities(classifications, config)
  const mapped = geocoded.filter((g) => g.latitude !== undefined).length
  logger.success(`Successfully geocoded: ${mapped}/${classifications.length}`)

  return geocoded
}
