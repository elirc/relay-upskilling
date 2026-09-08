import assert from 'node:assert/strict';

export function checkName(cleanName) {
  for (const [input, expected] of [
    [' Ada ', 'Ada'], ['   ', null], [null, null], [42, null],
    ['Mary  Jane', 'Mary  Jane'], ['', null], ['0', '0'], ['Élodie', 'Élodie'],
  ]) assert.equal(cleanName(input), expected, `cleanName(${JSON.stringify(input)})`);
}

export function checkCount(countRejected) {
  for (const [input, expected] of [
    [[], 0], [['imported'], 0], [['duplicate', 'conflict'], 0],
    [['rejected'], 1], [['rejected', 'imported', 'rejected', 'duplicate'], 2],
  ]) {
    const before = [...input];
    assert.equal(countRejected(Object.freeze(input)), expected, `countRejected(${JSON.stringify(input)})`);
    assert.deepEqual(input, before, 'The input must remain unchanged');
  }
}
