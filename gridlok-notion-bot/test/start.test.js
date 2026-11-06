import {test} from 'node:test'; import assert from 'node:assert/strict'; import {spawnSync} from 'node:child_process';
test('startup fails clearly without configuration and never logs tokens',()=>{
 const result=spawnSync(process.execPath,['src/index.js'],{encoding:'utf8',env:{PATH:process.env.PATH,DOTENV_CONFIG_PATH:'./test/nonexistent-test-env'},timeout:5000});
 assert.notEqual(result.status,0); assert.match(result.stderr,/DISCORD_TOKEN/); assert.doesNotMatch(result.stderr,/ERR_MODULE_NOT_FOUND/);
});
