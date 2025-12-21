/**
 * CLI Environment Utilities
 *
 * Shared utilities for reading environment variables and configuration.
 */

/**
 * Get required user context from environment variables.
 * HOME_COUNTRY and TIMEZONE are required for proper location disambiguation.
 */
export function getRequiredContext(): { homeCountry: string; timezone: string } {
  const homeCountry = process.env.HOME_COUNTRY
  const timezone = process.env.TIMEZONE

  if (!homeCountry || !timezone) {
    const missing = []
    if (!homeCountry) missing.push('HOME_COUNTRY')
    if (!timezone) missing.push('TIMEZONE')
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'These are required for location disambiguation.\n' +
        'Example:\n' +
        '  export HOME_COUNTRY="New Zealand"\n' +
        '  export TIMEZONE="Pacific/Auckland"'
    )
  }

  return { homeCountry, timezone }
}
