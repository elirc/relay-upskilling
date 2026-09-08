import {checkName, checkCount} from './checks.mjs';

const task = process.argv[2];
if (!['name', 'debug'].includes(task)) {
  console.error('Usage: node upskilling/practice/check.mjs name|debug');
  process.exitCode = 2;
} else {
  try {
    if (task === 'name') checkName((await import('./name.ts')).cleanName);
    else checkCount((await import('./count.ts')).countRejected);
    console.log('Supplied checks passed. Add your own test, explain your fix, then try a changed requirement. Mastery is not assessed by this command.');
  } catch (error) {
    console.error(`First failure: ${error.message}`);
    console.error('Compare expected and actual. Make one change, then rerun. Hints: upskilling/FIRST_SESSION.md or FOUNDATIONS.md.');
    process.exitCode = 1;
  }
}
