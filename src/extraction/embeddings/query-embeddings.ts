/**
 * Pre-computed Query Embeddings Loader
 *
 * Loads pre-computed embeddings for query strings from compressed JSON.
 * These are generated once via scripts/generate-query-embeddings.ts
 * and shipped with the library to avoid runtime API calls.
 */

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

interface QueryEmbeddingsData {
  model: string
  generatedAt: string
  queryCount: number
  dimensions: number
  queries: Array<{
    text: string
    embedding: number[]
  }>
}

let cachedData: QueryEmbeddingsData | null = null

/**
 * Load pre-computed query embeddings from compressed file.
 * Results are cached after first load.
 */
export function loadQueryEmbeddings(): QueryEmbeddingsData {
  if (cachedData) {
    return cachedData
  }

  const embeddingsPath = new URL('./queries/query-embeddings.json.gz', import.meta.url)
  const compressed = readFileSync(embeddingsPath)
  const jsonData = gunzipSync(new Uint8Array(compressed)).toString()
  cachedData = JSON.parse(jsonData) as QueryEmbeddingsData

  return cachedData
}

/**
 * Get pre-computed embedding for a specific query text.
 * Returns null if query not found.
 */
export function getQueryEmbedding(queryText: string): Float32Array | null {
  const data = loadQueryEmbeddings()
  const query = data.queries.find((q) => q.text === queryText)
  if (!query) {
    return null
  }
  return new Float32Array(query.embedding)
}

/**
 * Get all pre-computed query embeddings as a map.
 */
export function getAllQueryEmbeddings(): Map<string, Float32Array> {
  const data = loadQueryEmbeddings()
  const map = new Map<string, Float32Array>()

  for (const query of data.queries) {
    map.set(query.text, new Float32Array(query.embedding))
  }

  return map
}

/**
 * Get pre-computed embeddings for the default activity queries.
 * Returns embeddings in the same order as DEFAULT_ACTIVITY_QUERIES.
 */
export function getDefaultQueryEmbeddings(): Float32Array[] {
  const data = loadQueryEmbeddings()
  return data.queries.map((q) => new Float32Array(q.embedding))
}

/**
 * Get the embedding model used to generate the pre-computed embeddings.
 */
export function getQueryEmbeddingsModel(): string {
  return loadQueryEmbeddings().model
}

/**
 * Get the number of dimensions in the embeddings.
 */
export function getQueryEmbeddingsDimensions(): number {
  return loadQueryEmbeddings().dimensions
}
