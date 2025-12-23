/**
 * Preview Command
 *
 * AI-powered preview of top activity candidates.
 */

import { basename } from 'node:path'
import { buildClassificationPrompt } from '../../classifier/prompt'
import { classifyMessages, VERSION } from '../../index'
import { extractUrlsFromCandidates, fetchMetadataForUrls } from '../../scraper/metadata'
import type { ClassifiedActivity } from '../../types'
import { formatLocation } from '../../types'
import type { CLIArgs } from '../args'
import { formatDate, getCategoryEmoji, truncate } from '../helpers'
import type { Logger } from '../logger'
import { resolveModelConfig, resolveUserContext } from '../model'
import { initContext, type PipelineContext } from '../steps/context'
import { stepParse } from '../steps/parse'
import { stepScan } from '../steps/scan'

interface PreviewStats {
  candidatesClassified: number
  activitiesFound: number
  model: string
  fromCache: boolean
}

/**
 * Run classification step, using cache if available.
 */
async function stepClassify(
  ctx: PipelineContext,
  candidates: Parameters<typeof classifyMessages>[0],
  config: {
    provider: 'anthropic' | 'openai' | 'openrouter'
    apiKey: string
    model: string
    homeCountry: string
    timezone: string
  },
  logger: Logger
): Promise<{ activities: ClassifiedActivity[]; stats: PreviewStats; fromCache: boolean }> {
  const { pipelineCache, apiCache } = ctx

  // Check cache
  if (pipelineCache.hasStage('preview_activities')) {
    const cached = pipelineCache.getStage<ClassifiedActivity[]>('preview_activities') ?? []
    const stats = pipelineCache.getStage<PreviewStats>('preview_stats')
    logger.log(`\n🤖 Classifying candidates... 📦 cached`)
    return {
      activities: cached,
      stats: stats ?? {
        candidatesClassified: candidates.length,
        activitiesFound: cached.length,
        model: config.model,
        fromCache: true
      },
      fromCache: true
    }
  }

  const classifyResult = await classifyMessages(
    candidates,
    {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      homeCountry: config.homeCountry,
      timezone: config.timezone,
      batchSize: 30,
      onBatchStart: (info) => {
        if (info.fromCache) {
          logger.log(`\n🤖 Classifying ${info.candidateCount} candidates... 📦 cached\n`)
        } else if (info.totalBatches === 1) {
          logger.log(`\n🤖 Sending ${info.candidateCount} candidates to ${info.model}...\n`)
        } else {
          logger.log(
            `\n🤖 Batch ${info.batchIndex + 1}/${info.totalBatches}: ` +
              `sending ${info.candidateCount} candidates to ${info.model}...\n`
          )
        }
      }
    },
    apiCache
  )

  if (!classifyResult.ok) {
    throw new Error(`Classification failed: ${classifyResult.error.message}`)
  }

  // Sort by preview score: prioritize interesting over fun
  const sorted = [...classifyResult.value].sort((a, b) => {
    const scoreA = a.interestingScore * 2 + a.funScore
    const scoreB = b.interestingScore * 2 + b.funScore
    return scoreB - scoreA
  })

  const stats: PreviewStats = {
    candidatesClassified: candidates.length,
    activitiesFound: sorted.length,
    model: config.model,
    fromCache: false
  }

  // Cache results
  pipelineCache.setStage('preview_activities', sorted)
  pipelineCache.setStage('preview_stats', stats)

  return { activities: sorted, stats, fromCache: false }
}

export async function cmdPreview(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap Preview v${VERSION}`)
  logger.log(`\n📁 ${basename(args.input)}`)

  // Initialize pipeline context
  const ctx = await initContext(args.input, logger, {
    cacheDir: args.cacheDir,
    noCache: args.noCache
  })

  // Parse messages (uses cache) - required for scan step
  stepParse(ctx, { maxMessages: args.maxMessages })

  // Run scan (uses cache)
  const scanResult = stepScan(ctx, {
    maxMessages: args.maxMessages,
    quiet: true
  })

  if (scanResult.candidates.length === 0) {
    logger.log('\n🔍 Quick scan found 0 potential activities')
    return
  }

  logger.log(`\n🔍 Quick scan found ${scanResult.stats.totalUnique} potential activities`)

  const { provider, apiModel: model, apiKey } = resolveModelConfig()
  const { homeCountry, timezone } = await resolveUserContext({
    argsHomeCountry: args.homeCountry,
    argsTimezone: args.timezone,
    cacheDir: ctx.cacheDir,
    logger
  })

  const PREVIEW_CLASSIFY_COUNT = args.maxResults * 3
  const topCandidates = scanResult.candidates.slice(0, PREVIEW_CLASSIFY_COUNT)

  // Fetch URL metadata (stored in cache, used by classifier when building prompts)
  const urls = extractUrlsFromCandidates(topCandidates)
  if (urls.length > 0) {
    await fetchMetadataForUrls(urls, {
      timeout: 4000,
      concurrency: 5,
      cache: ctx.apiCache,
      onScrapeStart: ({ urlCount, cachedCount }) => {
        if (cachedCount > 0) {
          logger.log(`\n🔗 Scraping metadata for ${urlCount} URLs (${cachedCount} cached)...`)
        } else if (urlCount > 0) {
          logger.log(`\n🔗 Scraping metadata for ${urlCount} URLs...`)
        }
      },
      onDebug: args.debug ? (msg) => logger.log(`   [DEBUG] ${msg}`) : undefined,
      onUrlScraped: ({ url, success, error, current, total }) => {
        const domain = new URL(url).hostname.replace('www.', '')
        if (success) {
          logger.log(`   [${current}/${total}] ✓ ${domain}`)
        } else {
          logger.log(`   [${current}/${total}] ✗ ${domain}: ${error ?? 'Failed'}`)
        }
      }
    })
  }

  if (args.debug) {
    const prompt = buildClassificationPrompt(topCandidates, { homeCountry, timezone })
    logger.log('\n--- DEBUG: Classifier Prompt ---')
    logger.log(prompt)
    logger.log('--- END DEBUG ---\n')
    logger.log(`Prompt length: ${prompt.length} chars`)
  }

  if (args.dryRun) {
    logger.log(`\n📊 Dry run: would send ${topCandidates.length} messages to ${model}`)
    return
  }

  const { activities, fromCache } = await stepClassify(
    ctx,
    topCandidates,
    { provider, apiKey, model, homeCountry, timezone },
    logger
  )

  const displayActivities = activities.slice(0, args.maxResults)

  if (displayActivities.length === 0) {
    logger.log('   No activities found after AI classification.')
    logger.log('')
    logger.log('💡 Try running full analysis: chat-to-map analyze <input>')
    return
  }

  const cachedSuffix = fromCache ? ' 📦 cached' : ''
  logger.log(`\n✨ Found ${activities.length} activities${cachedSuffix}\n`)

  for (let i = 0; i < displayActivities.length; i++) {
    const s = displayActivities[i]
    if (!s) continue
    const emoji = getCategoryEmoji(s.category)
    const activity = truncate(s.activity, 200)
    const category = s.category.charAt(0).toUpperCase() + s.category.slice(1)

    logger.log(`${i + 1}. ${emoji}  "${activity}"`)
    logger.log(`   → ${category} • ${s.sender} • ${formatDate(s.timestamp)}`)
    const location = formatLocation(s)
    if (location) {
      logger.log(`   📍 ${location}`)
    }
    logger.log('')
  }

  logger.log(`💡 Run 'chat-to-map analyze ${basename(args.input)}' for full analysis`)
}
