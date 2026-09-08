// AFTER your attempt: compare reasoning, then close this file for the transfer task.
import type {Outcome} from './count.ts';

export function cleanName(value: unknown): string | null {
  // Narrow the type before using a string method.
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length === 0 ? null : cleaned;
}

export function countRejected(outcomes: readonly Outcome[]): number {
  let count = 0;
  // Duplicates and conflicts are different outcomes, even though neither was imported.
  for (const outcome of outcomes) if (outcome === 'rejected') count += 1;
  return count;
}
