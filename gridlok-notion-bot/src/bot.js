import {queryTasks} from './notion.js';
const STATUS=['Backlog','Ready','In Progress','Blocked','Done','On Hold'];
const clean=(value,max=150)=>String(value ?? '—').replace(/[\r\n]+/g,' ').replace(/@/g,'@\u200b').replace(/([\\`*_~|\[\]<>])/g,'\\$1').slice(0,max) || '—';
const prop=(p,key)=>p.properties?.[key] ?? {};
const title=p=>(prop(p,'Task').title ?? []).map(x=>x.plain_text ?? x.text?.content ?? '').join('') || 'Untitled';
const status=p=>prop(p,'Status').status?.name || 'Unspecified';
const select=(p,key)=>prop(p,key).select?.name || '—';
const relation=(p,key)=>(prop(p,key).relation ?? []).map(x=>x.id).join(', ') || '—';
const date=(p,key)=>prop(p,key).date?.start || '—';
const embed=(title,description)=>({title,description,color:0x5865f2,footer:{text:'GRIDLOK • Read-only • Results visible only to you'}});
const reply=embeds=>({embeds,allowedMentions:{parse:[]}});
export async function handleInteraction(i,config) {
 if (!i.isChatInputCommand() || i.commandName!=='gridlok') return;
 let isPublic=false;
 try {
  const sub=i.options.getSubcommand();
  isPublic=sub==='progress';
  await i.deferReply(isPublic ? {} : {flags:64});
  const tasks=(await queryTasks(config)).filter(p=>p.object!=='data_source' && p.properties);
  if (sub==='progress') {
   const groups=new Map(); let done=0;
   for (const task of tasks) {
    const key=prop(task,'Workstream').select?.name || null;
    const group=groups.get(key) || {total:0,done:0};
    group.total++; if (status(task)==='Done') {group.done++; done++} groups.set(key,group);
   }
   const bar=(completed,total)=>{const percent=total ? Math.round(completed*100/total) : 0; const filled=Math.round(percent/10); return `\`${'█'.repeat(filled)}${'░'.repeat(10-filled)}\` **${percent}%** • ${completed} / ${total} done`};
   const entries=[...groups].sort((a,b)=>a[0]===null?1:b[0]===null?-1:a[0].localeCompare(b[0]));
   const pages=Math.max(1,Math.ceil(entries.length/10)); const page=Math.min(pages,Math.max(1,i.options.getInteger('page') || 1));
   const lines=entries.slice((page-1)*10,page*10).map(([name,g])=>`**${name===null?'Unassigned':clean(name,120)}**\n${bar(g.done,g.total)}`);
   const description=`**Overall progress**\n${bar(done,tasks.length)}\n\n**Workstreams**\n${lines.join('\n\n') || 'No tasks yet.'}\n\nPage ${page} of ${pages} • Percentages rounded to nearest whole percent.`;
   return await i.editReply(reply([{title:'📊 GRIDLOK Progress',description,color:0x5865f2,footer:{text:'GRIDLOK • Read-only • Public board summary'}}]));
  }
  if (sub==='detail') {
   const id=(i.options.getString('id') || '').replace(/-/g,'').toLowerCase();
   const task=tasks.find(p=>p.id.replace(/-/g,'').toLowerCase()===id);
   if (!task) return await i.editReply(reply([embed('Task not found','Use the full task ID shown in `/gridlok list` or `/gridlok search`.')]));
   const progress=prop(task,'Progress').number;
   const owners=(prop(task,'Owner').people ?? []).map(x=>x.name || x.id).join(', ') || '—';
   const lines=[`**Status:** ${clean(status(task))}`,`**Priority:** ${clean(select(task,'Priority'))}`,`**Task type:** ${clean(select(task,'Task Type'))}`,`**Workstream:** ${clean(select(task,'Workstream'))}`,`**Progress:** ${typeof progress==='number' ? `${Math.round(progress*100)}%` : '—'}`,`**Owner:** ${clean(owners,300)}`,`**Start:** ${clean(date(task,'Start Date'))}`,`**End:** ${clean(date(task,'End Date'))}`,`**Depends on IDs:** ${clean(relation(task,'Depends On'),500)}`,`**Parent task IDs:** ${clean(relation(task,'Parent Task'),500)}`,`**ID:** \`${task.id}\``,`[Open in Notion](https://www.notion.so/${task.id.replace(/-/g,'')})`];
   return await i.editReply(reply([embed(clean(title(task),240),lines.join('\n').slice(0,4096))]));
  }
  const query=(i.options.getString('query') || '').trim().toLowerCase();
  const filter=i.options.getString('status');
  let matches=tasks.filter(p=>(!filter || status(p)===filter) && (sub!=='search' || title(p).toLowerCase().includes(query)));
  matches.sort((a,b)=>{let ai=STATUS.indexOf(status(a)),bi=STATUS.indexOf(status(b)); return (ai<0?99:ai)-(bi<0?99:bi) || title(a).localeCompare(title(b), undefined, {numeric:true}) || a.id.localeCompare(b.id)});
  const total=Math.max(1,Math.ceil(matches.length/20)); const page=Math.min(total,Math.max(1,i.options.getInteger('page') || 1));
  const slice=matches.slice((page-1)*20,page*20); let last; const lines=[];
  for (const task of slice) {const s=status(task); if(s!==last){lines.push(`\n**${clean(s,60)}**`);last=s} lines.push(`• ${clean(title(task),95)} — \`${task.id}\``)}
  const description=(lines.join('\n') || 'No matching tasks.')+`\n\nPage ${page} of ${total} • ${matches.length} matching tasks\nUse a task ID with \`/gridlok detail\`.`;
  return await i.editReply(reply([embed(sub==='search'?'Search results':'GRIDLOK tasks',description.slice(0,4096))]));
 } catch (error) {
  const message=error?.message?.match(/^Notion request failed \(HTTP \d+; [\w-]+\)$/)?.[0] || 'Could not load tasks. Check configuration, connectivity and Notion access.';
  const failure=embed('Unable to load GRIDLOK',message);
  if (isPublic) failure.footer.text='GRIDLOK • Read-only • Public response';
  const payload=reply([failure]);
  try { if (i.deferred || i.defer || i.replied) await i.editReply(payload); else await i.reply({...payload,flags:64}); } catch { /* interaction expired or unavailable */ }
 }
}
