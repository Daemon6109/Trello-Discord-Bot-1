import {SlashCommandBuilder} from 'discord.js';
const choices=['Backlog','Ready','In Progress','Blocked','Done','On Hold'].map(x=>({name:x,value:x}));
const page=s=>s.addIntegerOption(o=>o.setName('page').setDescription('Results page (20 tasks per page)').setMinValue(1));
const status=s=>s.addStringOption(o=>o.setName('status').setDescription('Filter by status').addChoices(...choices));
export const commands=[new SlashCommandBuilder().setName('gridlok').setDescription('Explore the GRIDLOK board (read-only)')
 .addSubcommand(s=>page(status(s.setName('list').setDescription('List tasks grouped by status'))))
 .addSubcommand(s=>page(status(s.setName('search').setDescription('Search task titles').addStringOption(o=>o.setName('query').setDescription('Text to find in the task title').setRequired(true).setMinLength(1).setMaxLength(100)))))
 .addSubcommand(s=>s.setName('detail').setDescription('Show task details by ID').addStringOption(o=>o.setName('id').setDescription('Full task ID from list or search').setRequired(true).setMinLength(32).setMaxLength(36)))
 .addSubcommand(s=>s.setName('progress').setDescription('Show public board completion by workstream').addIntegerOption(o=>o.setName('page').setDescription('Workstreams page (10 per page)').setMinValue(1)))];
