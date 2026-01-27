/**
 * ChatToMap Core Library
 *
 * Transform chat exports into geocoded activities.
 *
 * Design principle: Pure functions only. No IO, no progress reporting, no orchestration.
 * The library is stateless and side-effect-free (except for API calls to external services).
 *
 * @license AGPL-3.0
 */

// Re-export everything from the worker-safe core module
export * from './core/index'

// Additional exports that require Node.js dependencies (not worker-safe)
// Export module - Node.js-only exports (Excel, PDF)
export { exportToExcel, exportToPDF } from './export/index'
