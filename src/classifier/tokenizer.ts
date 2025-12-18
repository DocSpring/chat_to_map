/**
 * Token counting for dynamic batching.
 * Uses tiktoken for accurate token counts.
 */

import { getEncoding } from 'js-tiktoken'

// Use cl100k_base encoding (used by gpt-4, gpt-3.5-turbo, text-embedding-ada-002)
// Claude uses a different tokenizer but this gives reasonable estimates
const encoder = getEncoding('cl100k_base')

/**
 * Count tokens in a string.
 */
export function countTokens(text: string): number {
  return encoder.encode(text).length
}

/**
 * Estimate tokens for the system prompt (without messages).
 * This is the fixed overhead for each API call.
 */
export const SYSTEM_PROMPT_TOKENS = 350

/**
 * Maximum tokens per batch. Leave room for response.
 * Modern models have huge context windows (128k+), but smaller batches
 * are more reliable and easier to validate.
 */
export const MAX_BATCH_TOKENS = 8000
