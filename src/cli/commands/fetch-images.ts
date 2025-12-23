/**
 * Fetch Images Command
 *
 * Fetch images for geocoded activities from various sources:
 * - Google Places Photos (venues with placeId)
 * - Wikipedia (landmarks, cities, countries)
 * - Pixabay (generic activities)
 */

import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { FilesystemCache } from '../../cache/filesystem'
import type { ImageFetchConfig, ImageResult } from '../../images/types'
import { fetchImagesForActivities, VERSION } from '../../index'
import type { GeocodedActivity } from '../../types'
import type { CLIArgs } from '../args'
import type { Logger } from '../logger'
import { getCacheDir } from '../steps/context'

interface ActivityWithImage extends GeocodedActivity {
  readonly image?: ImageResult | null | undefined
}

export async function cmdFetchImages(args: CLIArgs, logger: Logger): Promise<void> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap Fetch Images v${VERSION}`)
  logger.log(`\n📁 ${basename(args.input)}`)

  // Load geocoded activities from input file
  const content = await readFile(args.input, 'utf-8')
  const activities = JSON.parse(content) as GeocodedActivity[]
  logger.log(`   Loaded ${activities.length} activities`)

  // Initialize cache for API responses
  const cacheDir = getCacheDir(args.cacheDir)
  const cache = new FilesystemCache(cacheDir)

  // Build config from CLI args and environment
  const config: ImageFetchConfig = {
    skipPixabay: args.skipPixabay,
    skipWikipedia: args.skipWikipedia,
    skipGooglePlaces: args.skipGooglePlaces,
    pixabayApiKey: process.env.PIXABAY_API_KEY,
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY
  }

  // Log which sources are enabled
  const sources: string[] = []
  if (!config.skipGooglePlaces && config.googlePlacesApiKey) sources.push('Google Places')
  if (!config.skipWikipedia) sources.push('Wikipedia')
  if (!config.skipPixabay && config.pixabayApiKey) sources.push('Pixabay')

  logger.log(`\n🖼️  Fetching images from: ${sources.join(' → ') || '(no sources configured)'}`)

  // Fetch images with progress
  const imageMap = await fetchImagesForActivities(activities, config, cache, {
    onProgress: (current, total) => {
      if (args.verbose || current === total || current % 10 === 0) {
        logger.log(`   [${current}/${total}] ${Math.round((current / total) * 100)}%`)
      }
    }
  })

  // Merge images into activities
  const activitiesWithImages: ActivityWithImage[] = activities.map((activity) => ({
    ...activity,
    image: imageMap.get(activity.messageId)
  }))

  // Count by source
  const sourceCounts = new Map<string, number>()
  let nullCount = 0
  for (const result of imageMap.values()) {
    if (result === null) {
      nullCount++
    } else {
      sourceCounts.set(result.source, (sourceCounts.get(result.source) ?? 0) + 1)
    }
  }

  logger.log('\n📊 Image sources:')
  for (const [source, count] of sourceCounts) {
    logger.log(`   ${source}: ${count}`)
  }
  if (nullCount > 0) {
    logger.log(`   (no image): ${nullCount}`)
  }

  // Write output
  const output = args.jsonOutput ?? args.input.replace('.json', '.with-images.json')
  await writeFile(output, JSON.stringify(activitiesWithImages, null, 2))
  logger.success(`\n✨ Wrote ${activitiesWithImages.length} activities to ${output}`)
}
