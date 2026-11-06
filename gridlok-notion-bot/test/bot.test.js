import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const page = (i, status='Ready', title=`Task ${i}`) => ({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,url:`https://notion.so/task${i}`,properties:{Task:{title:[{plain_text:title}]},Status:{status:{name:status}},Priority:{select:{name:'High'}},Progress:{number:0.5},Owner:{people:[{name:'Pat'}]}}});
const interaction = (sub, opts={}) => ({commandName:'gridlok',isChatInputCommand:()=>true, options:{getSubcommand:()=>sub,getString:k=>opts[k]??null,getInteger:k=>opts[k]??null},async deferReply(v){this.defer=v}, async editReply(v){this.result=v}});

test('real HTTP Notion pagination reaches the mocked Discord list interaction safely', async t=>{
 let mod; try {mod=await import('../src/bot.js')} catch {} assert.ok(mod,'bot interaction handler must exist');
 const requests=[]; const server=http.createServer((req,res)=>{let body=''; req.on('data',c=>body+=c); req.on('end',()=>{requests.push({path:req.url,headers:req.headers,body:JSON.parse(body)}); res.setHeader('content-type','application/json'); res.end(JSON.stringify(requests.length===1?{results:[page(1,'Ready','@everyone build'),page(2,'Done')],has_more:true,next_cursor:'cursor'}:{results:[page(3,'Ready')],has_more:false}));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); t.after(()=>server.close());
 const i=interaction('list'); await mod.handleInteraction(i,{token:'test',dataSourceId:'source',baseUrl:`http://127.0.0.1:${server.address().port}/v1`});
 assert.equal(requests.length,2); assert.equal(requests[1].body.start_cursor,'cursor'); assert.equal(requests[0].headers['notion-version'],'2025-09-03');
 assert.equal(i.defer.flags,64); assert.deepEqual(i.result.allowedMentions,{parse:[]}); const text=JSON.stringify(i.result); assert.match(text,/Ready/); assert.match(text,/Done/); assert.match(text,/build/);
});

test('search, pagination, task detail and safe errors',async()=>{
 const {handleInteraction}=await import('../src/bot.js'); const items=Array.from({length:23},(_,i)=>page(i+1,'Ready',`Build ${i+1}`));
 const ok=async()=>({ok:true,json:async()=>({results:items,has_more:false})}); const config={token:'x',dataSourceId:'x',fetcher:ok};
 const s=interaction('search',{query:'build',page:2}); await handleInteraction(s,config); assert.match(JSON.stringify(s.result),/Page 2/); assert.match(JSON.stringify(s.result),/Build 21/);
 const d=interaction('detail',{id:items[0].id}); await handleInteraction(d,config); const text=JSON.stringify(d.result); assert.match(text,/Build 1/); assert.match(text,/50%/); assert.match(text,/Pat/);
 const e=interaction('list'); await handleInteraction(e,{...config,fetcher:async()=>({ok:false,status:403,json:async()=>({code:'restricted_resource',message:'secret details'})})}); assert.match(JSON.stringify(e.result),/403/); assert.doesNotMatch(JSON.stringify(e.result),/secret details/);
});

test('large untrusted data and out of range pages respect Discord limits',async()=>{
 const {handleInteraction}=await import('../src/bot.js'); const items=Array.from({length:30},(_,i)=>page(i+1,'Ready','@everyone '+ 'x'.repeat(5000)));
 const i=interaction('list',{page:999}); await handleInteraction(i,{token:'x',dataSourceId:'x',fetcher:async()=>({ok:true,json:async()=>({results:items,has_more:false})})});
 assert.match(JSON.stringify(i.result),/Page 2/); assert.ok(i.result.embeds[0].description.length<=4096); assert.deepEqual(i.result.allowedMentions,{parse:[]});
});


test('progress publicly aggregates Done overall and by workstream',async()=>{
 const {handleInteraction}=await import('../src/bot.js');
 const items=[page(1,'Done'),page(2,'Ready'),page(3,'Done')];
 items[0].properties.Workstream={select:{name:'Alpha'}}; items[1].properties.Workstream={select:{name:'Alpha'}};
 const i=interaction('progress'); await handleInteraction(i,{fetcher:async()=>({ok:true,json:async()=>({results:items,has_more:false})})});
 assert.notEqual(i.defer.flags,64); assert.deepEqual(i.result.allowedMentions,{parse:[]});
 const text=JSON.stringify(i.result); assert.match(text,/67%/); assert.match(text,/2\s*\/\s*3/); assert.match(text,/Alpha/); assert.match(text,/50%/); assert.match(text,/Unassigned/); assert.match(text,/100%/);
});


test('progress empty board and public failure communicate visibility correctly',async()=>{
 const {handleInteraction}=await import('../src/bot.js');
 const i=interaction('progress'); await handleInteraction(i,{fetcher:async()=>({ok:true,json:async()=>({results:[],has_more:false})})});
 assert.match(i.result.embeds[0].description,/0%.*0 \/ 0/); assert.match(i.result.embeds[0].description,/No tasks/);
 const e=interaction('progress'); await handleInteraction(e,{fetcher:async()=>{throw Error('sensitive')}});
 assert.doesNotMatch(JSON.stringify(e.result),/visible only to you|sensitive/);
});

test('progress paginates many hostile workstreams within Discord limits',async()=>{
 const {handleInteraction}=await import('../src/bot.js');
 const items=Array.from({length:31},(_,n)=>{const p=page(n,n%2?'Done':'Ready'); p.properties.Workstream={select:{name:`${String(n).padStart(2,'0')} @everyone `+'*'.repeat(2000)}}; return p});
 const config={fetcher:async()=>({ok:true,json:async()=>({results:items,has_more:false})})};
 const i=interaction('progress',{page:999}); await handleInteraction(i,config);
 assert.match(i.result.embeds[0].description,/Page 4 of 4/); assert.match(i.result.embeds[0].description,/15 \/ 31/);
 const first=interaction('progress'); await handleInteraction(first,config); const e=first.result.embeds[0];
 assert.ok(e.title.length<=256); assert.ok(e.description.length<=4096); assert.ok(e.title.length+e.description.length+e.footer.text.length<=6000);
 assert.deepEqual(first.result.allowedMentions,{parse:[]}); assert.doesNotMatch(e.description,/@everyone/);
});
