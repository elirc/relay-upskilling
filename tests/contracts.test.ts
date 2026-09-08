import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mappingSchema,csvCell} from '../src/lib/contracts.ts';
test('mapping refuses duplicate source columns and missing required fields',()=>{
 assert.equal(mappingSchema.safeParse({name:'Name',email:'Name'}).success,false);
 assert.equal(mappingSchema.safeParse({name:'Name'}).success,false);
 assert.equal(mappingSchema.safeParse({name:'Name',email:'Email',company:''}).success,true);
});
test('CSV exports escape quotes, multiline values and spreadsheet formulas',()=>{
 assert.equal(csvCell('Example, Inc.'),'"Example, Inc."');
 assert.equal(csvCell('A "quote"'),'"A ""quote"""');
 assert.equal(csvCell('=HYPERLINK("evil")'),'"\'=HYPERLINK(""evil"")"');
 assert.equal(csvCell(null),'""');
});
