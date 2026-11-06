import {test} from 'node:test'; import assert from 'node:assert/strict';
test('slash command schema exposes read-only list search and detail',async()=>{
 let commands; try {({commands}=await import('../src/commands.js'))} catch {} assert.ok(commands,'command definitions must exist');
 const json=commands[0].toJSON(); assert.equal(json.name,'gridlok'); assert.deepEqual(json.options.map(x=>x.name),['list','search','detail','progress']);
 for (const option of json.options) assert.ok(option.description);
});
