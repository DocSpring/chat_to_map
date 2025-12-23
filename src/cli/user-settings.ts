/**
 * User Settings
 *
 * Manages user settings like home country with automatic geoip lookup.
 * Settings are cached in the cache directory as user-settings.json.
 */

import { existsSync, readlinkSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { httpFetch } from '../http'
import type { Logger } from './logger'
import { getCacheDir } from './steps/context'

interface UserSettings {
  /** User's home country (e.g., "New Zealand") */
  homeCountry?: string | undefined
  /** User's timezone (e.g., "Pacific/Auckland") */
  timezone?: string | undefined
  /** When settings were last updated */
  updatedAt?: string | undefined
}

interface GeoIpResponse {
  country_name?: string
}

interface ResolveOptions {
  /** CLI arg for home country */
  argsHomeCountry?: string | undefined
  /** CLI arg for timezone */
  argsTimezone?: string | undefined
  /** Custom cache directory */
  cacheDir?: string | undefined
  /** Logger for output */
  logger?: Logger | undefined
}

interface ResolvedUserContext {
  homeCountry: string
  timezone?: string | undefined
}

const GEOIP_APIS = [
  {
    url: 'https://ipapi.co/json/',
    parseCountry: (data: unknown) => (data as GeoIpResponse).country_name
  },
  { url: 'https://ipinfo.io/country', parseCountry: (data: unknown) => (data as string).trim() }
]
const LOCALTIME_PATH = '/etc/localtime'

/**
 * Get system timezone from /etc/localtime symlink.
 * Works on macOS and Linux.
 */
function getSystemTimezone(): string | undefined {
  try {
    if (!existsSync(LOCALTIME_PATH)) {
      return undefined
    }
    const target = readlinkSync(LOCALTIME_PATH)
    // Extract timezone from path like /var/db/timezone/zoneinfo/Pacific/Auckland
    // or /usr/share/zoneinfo/Pacific/Auckland
    const match = target.match(/zoneinfo\/(.+)$/)
    return match?.[1]
  } catch {
    return undefined
  }
}

/**
 * Get path to user settings file.
 */
function getUserSettingsPath(cacheDir?: string): string {
  return join(getCacheDir(cacheDir), 'user-settings.json')
}

/**
 * Load user settings from cache.
 */
async function loadUserSettings(cacheDir?: string, logger?: Logger): Promise<UserSettings | null> {
  const path = getUserSettingsPath(cacheDir)
  if (!existsSync(path)) {
    return null
  }
  try {
    const content = await readFile(path, 'utf-8')
    const settings = JSON.parse(content) as UserSettings
    logger?.log(`\n📍 Loaded settings from ${path}`)
    return settings
  } catch {
    return null
  }
}

/**
 * Save user settings to cache.
 */
async function saveUserSettings(
  settings: UserSettings,
  cacheDir?: string,
  logger?: Logger
): Promise<void> {
  const path = getUserSettingsPath(cacheDir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2))
  logger?.log(`\n📍 Saved settings to ${path}`)
}

/**
 * Fetch country from geoip APIs (tries multiple with fallback).
 */
async function fetchGeoIp(logger?: Logger): Promise<string | null> {
  logger?.log('\n🌐 Detecting location from IP...')

  for (const api of GEOIP_APIS) {
    try {
      const response = await httpFetch(api.url)
      if (!response.ok) continue

      const isJson = api.url.includes('/json')
      const data = isJson ? await response.json() : await response.text()
      const country = api.parseCountry(data)

      if (country) {
        logger?.log(`   Detected country: ${country}`)
        return country
      }
    } catch {
      // Try next API
    }
  }

  logger?.log('   Failed to detect location')
  return null
}

/**
 * Resolve user context (home country, timezone) with automatic detection and caching.
 *
 * Priority for both home country and timezone:
 * 1. CLI arg (--home-country, --timezone)
 * 2. Environment variable (HOME_COUNTRY, TIMEZONE)
 * 3. Cached value from user-settings.json
 * 4. Auto-detect (geoip for country, /etc/localtime for timezone)
 *
 * Throws if home country cannot be determined from any source.
 */
export async function resolveUserContext(
  options: ResolveOptions = {}
): Promise<ResolvedUserContext> {
  const { argsHomeCountry, argsTimezone, cacheDir, logger } = options

  // Resolve home country
  let homeCountry: string | undefined
  let countrySource: string | undefined

  if (argsHomeCountry) {
    homeCountry = argsHomeCountry
    countrySource = '--home-country'
  } else if (process.env.HOME_COUNTRY) {
    homeCountry = process.env.HOME_COUNTRY
    countrySource = 'HOME_COUNTRY env'
  }

  // Resolve timezone
  let timezone: string | undefined
  let timezoneSource: string | undefined

  if (argsTimezone) {
    timezone = argsTimezone
    timezoneSource = '--timezone'
  } else if (process.env.TIMEZONE) {
    timezone = process.env.TIMEZONE
    timezoneSource = 'TIMEZONE env'
  }

  // Check cached settings for any missing values
  const cached = await loadUserSettings(cacheDir, logger)
  if (cached) {
    if (!homeCountry && cached.homeCountry) {
      homeCountry = cached.homeCountry
      countrySource = 'cached'
    }
    if (!timezone && cached.timezone) {
      timezone = cached.timezone
      timezoneSource = 'cached'
    }
  }

  // Auto-detect missing values
  let needsSave = false

  if (!homeCountry) {
    const detected = await fetchGeoIp(logger)
    if (detected) {
      homeCountry = detected
      countrySource = 'detected from IP'
      needsSave = true
    }
  }

  if (!timezone) {
    const systemTz = getSystemTimezone()
    if (systemTz) {
      timezone = systemTz
      timezoneSource = 'system'
      needsSave = true
    }
  }

  // Save if we detected new values
  if (needsSave && homeCountry) {
    await saveUserSettings(
      {
        homeCountry,
        timezone,
        updatedAt: new Date().toISOString()
      },
      cacheDir,
      logger
    )
  }

  if (!homeCountry) {
    throw new Error(
      'Could not determine home country. Use --home-country or set HOME_COUNTRY env var.'
    )
  }

  // Log final resolved values
  logger?.log(`\n📍 Home country: ${homeCountry}${countrySource ? ` (${countrySource})` : ''}`)
  if (timezone) {
    logger?.log(`   Timezone: ${timezone}${timezoneSource ? ` (${timezoneSource})` : ''}`)
  }

  return { homeCountry, timezone }
}
