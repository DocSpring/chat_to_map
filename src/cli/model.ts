/**
 * CLI Model & Context Resolution
 *
 * Resolves model ID to provider and API model, with fallback logic.
 * Also resolves user context (home country, timezone) from args or env vars.
 */

import {
  getRequiredApiKeyEnvVar,
  getValidModelIds,
  type ResolvedModel,
  resolveModel
} from '../index'
import type { ClassifierProvider } from '../types'

interface ResolvedModelConfig {
  provider: ClassifierProvider
  apiModel: string
  apiKey: string
}

// Re-export resolveUserContext from user-settings (replaces old sync resolveContext)
export { resolveUserContext } from './user-settings'

/**
 * Resolve model configuration from environment.
 * Default: gemini-2.5-flash, falls back to haiku-4.5 if no OpenRouter key.
 */
export function resolveModelConfig(): ResolvedModelConfig {
  const requestedModel = process.env.CLASSIFIER_MODEL ?? 'gemini-2.5-flash'
  let modelId = requestedModel
  let resolved: ResolvedModel | null = resolveModel(modelId)

  if (!resolved) {
    throw new Error(`Unknown model: ${modelId}. Valid: ${getValidModelIds().join(', ')}`)
  }

  // Check for required API key, fallback if needed
  const requiredEnvVar = getRequiredApiKeyEnvVar(modelId)
  let apiKey = requiredEnvVar ? process.env[requiredEnvVar] : undefined

  if (!apiKey && modelId === 'gemini-2.5-flash' && process.env.ANTHROPIC_API_KEY) {
    // Fallback to haiku-4.5 if no OpenRouter key but have Anthropic key
    modelId = 'haiku-4.5'
    const fallbackResolved = resolveModel(modelId)
    if (!fallbackResolved) {
      throw new Error('Internal error: haiku-4.5 model not found')
    }
    resolved = fallbackResolved
    apiKey = process.env.ANTHROPIC_API_KEY
  }

  if (!apiKey) {
    const envVar = getRequiredApiKeyEnvVar(modelId)
    throw new Error(`${envVar} required for model ${modelId}`)
  }

  return {
    provider: resolved.provider,
    apiModel: resolved.apiModel,
    apiKey
  }
}
