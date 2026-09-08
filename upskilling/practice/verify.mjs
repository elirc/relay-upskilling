// Curriculum-maintainer verification. Never imports or edits the learner's attempt.
import assert from 'node:assert/strict';
import {checkName, checkCount} from './checks.mjs';
import {cleanName, countRejected} from './reference.ts';

checkName(cleanName);
checkCount(countRejected);
const nameMutants = [
  value => String(value).trim(),
  value => typeof value === 'string' ? value.trim().toLowerCase() || null : null,
  value => typeof value === 'string' ? value.trim().replaceAll('  ', ' ') || null : null,
  value => typeof value === 'string' ? value || null : null,
];
const countMutants = [
  outcomes => outcomes.filter(outcome => outcome !== 'imported').length,
  outcomes => new Set(outcomes.filter(outcome => outcome === 'rejected')).size,
  outcomes => outcomes.length,
];
for (const mutant of nameMutants) assert.throws(() => checkName(mutant));
for (const mutant of countMutants) assert.throws(() => checkCount(mutant));
console.log(JSON.stringify({result:'passed',referenceCases:13,incorrectImplementationsDetected:7,learnerAssessed:false}));
