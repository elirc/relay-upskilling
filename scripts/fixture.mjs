import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';
export async function generateFixture(path, count = 100000, namespace = '') {
  const output = createWriteStream(path);
  output.write('Full Name,Email Address,Company,Signup Date\r\n');
  for (let n = 1; n <= count; n++) {
    const email = n % 100 === 0 ? '' : `contact${n % 50 === 0 ? n-1 : n}${namespace}@example.com`;
    const date = n % 125 === 0 ? '03/04/2025' : n % 3 === 0 ? '2025/01/15' : '2025-01-15';
    const name = n % 200 === 0 ? '' : `Contact ${n}`;
    if (!output.write(`"${name}"," ${email.toUpperCase()} ","Example, Inc.",${date}\r\n`)) await once(output, 'drain');
  }
  output.end(); await once(output,'finish');
}
if (process.argv[1]?.endsWith('fixture.mjs')) {
  await mkdir('.data/fixtures',{recursive:true});
  await generateFixture('.data/fixtures/contacts-100k.csv');
  console.log('Wrote .data/fixtures/contacts-100k.csv');
}
