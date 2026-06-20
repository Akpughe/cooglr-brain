// Relevance scoring helpers for retrieved excerpts.
//
// UltraMem returns a per-chunk similarity score (higher = closer). We use the
// best score across the retrieved set to decide whether a result is strong
// enough to answer from, or "weak" — in which case the agent should discover
// available sources and reformulate before giving up.

/**
 * Minimum top score for a retrieval to count as "strong". Tunable: if the agent
 * reformulates too eagerly, lower it; if it answers from junk, raise it.
 */
export const WEAK_SCORE_FLOOR = 0.35;

/** Highest score in the set, or 0 when empty. */
export function topScore(scores: number[]): number {
  return scores.length ? Math.max(...scores) : 0;
}

/** A result is weak when it's empty or its best score is below the floor. */
export function isWeakResult(scores: number[]): boolean {
  return topScore(scores) < WEAK_SCORE_FLOOR;
}
