export type Outcome = 'imported' | 'rejected' | 'duplicate' | 'conflict';

// This implementation has an intentional logic bug. Write a failing test first.
export function countRejected(outcomes: readonly Outcome[]): number {
  let count = 0;
  for (const outcome of outcomes) {
    if (outcome !== 'imported') count += 1;
  }
  return count;
}
