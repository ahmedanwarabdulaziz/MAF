/**
 * perf.ts — Lightweight request timing helper.
 * PERF-00: Baseline measurement tool.
 *
 * - Logs are emitted ONLY in development (NODE_ENV !== 'production').
 * - All functions are no-ops in production — zero overhead.
 * - Usage: wrap any async server-side work with perfMark / perfEnd.
 */

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Start a named timer. Returns a token to pass to perfEnd().
 * Usage:
 *   const t = perfMark('layout:getSystemUser')
 *   const user = await getSystemUser()
 *   perfEnd(t)
 */
export function perfMark(label: string): { label: string; start: number } {
  return { label, start: isDev ? Date.now() : 0 }
}

/**
 * End a timer and log the elapsed time.
 */
export function perfEnd(token: { label: string; start: number }): void {
  if (!isDev) return
  const elapsed = Date.now() - token.start
  const icon = elapsed > 500 ? '🔴' : elapsed > 200 ? '🟡' : '🟢'
  console.log(`[PERF] ${icon} ${token.label}: ${elapsed}ms`)
}

/**
 * Wrap an async function and automatically log its duration.
 * Usage:
 *   const user = await perfWrap('layout:getSystemUser', () => getSystemUser())
 */
export async function perfWrap<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isDev) return fn()
  const t = perfMark(label)
  const result = await fn()
  perfEnd(t)
  return result
}
