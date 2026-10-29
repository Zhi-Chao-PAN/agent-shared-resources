#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Manager,CONFIG,nameOK} from '../src/manager.mjs';
import {CLIENTS} from '../src/clients.mjs';
import {atomic} from '../src/files.mjs';
import {runTrial} from '../src/trial.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const [command='help',...args]=process.argv.slice(2),flags={};
try {
  for(let i=0;i<args.length;i+=2) {
    if(!['--client','--resource','--skills','--mcp','--home'].includes(args[i])||args[i+1]===undefined)throw new Error('Invalid flag/value');
    if(Object.hasOwn(flags,args[i]))throw new Error('Duplicate flag');flags[args[i]]=args[i+1];
  }
  if(flags['--client']&&!CLIENTS[flags['--client']])throw new Error('Unknown client');
  const file=path.join(root,CONFIG),client=flags['--client'];
  if(command==='help'||command==='--help') {
    console.log(`agent-shared-resources ${pkg.version}

node bin/ars.mjs trial
node bin/ars.mjs init
node bin/ars.mjs resources
node bin/ars.mjs select --client <id> [--skills a,b|-] [--mcp c,d|-]
node bin/ars.mjs plan|apply|doctor --client <id> [--resource <name>]
node bin/ars.mjs rollback --client <id> [--resource <name>]
node bin/ars.mjs rollback --resource <name>
node bin/ars.mjs recover
node bin/ars.mjs clients

init/select edit only the ignored local manifest. apply/rollback change native files.
No automatic account login, approval changes, global rules, or MCP execution.`);
  } else if(command==='trial') {
    if(Object.keys(flags).length)throw new Error('trial accepts no flags; it always uses disposable fixtures');
    const result={version:pkg.version,...runTrial()};
    console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  } else if(command==='--version'||command==='version')console.log(pkg.version);
  else if(command==='clients')console.log(JSON.stringify(CLIENTS,null,2));
  else if(command==='resources') {
    const skills=JSON.parse(fs.readFileSync(path.join(root,'catalog/skills.json'),'utf8'));
    const servers=JSON.parse(fs.readFileSync(path.join(root,'catalog/mcp.json'),'utf8'));
    const rows=Object.entries(skills).map(([name,spec])=>{
      const text=fs.readFileSync(path.join(root,spec.source,'SKILL.md'),'utf8');
      const description=(text.match(/^description:\s*(.+)$/m)?.[1]??'').trim().replace(/^["']|["']$/g,'');
      return {name,description,license:spec.license,origin:spec.origin};
    });
    console.log(JSON.stringify({ok:true,skills:rows,mcp:Object.entries(servers).map(([name,spec])=>({name,...spec}))},null,2));
  } else if(command==='init') {
    const config={version:1,clients:{},skills:{},servers:{},runtime:{}};
    atomic(file,JSON.stringify(config,null,2)+'\n',null);console.log(JSON.stringify({ok:true,path:file,enabledClients:0}));
  } else if(command==='select') {
    if(!client)throw new Error('select requires --client');
    const before=fs.readFileSync(file,'utf8'),config=JSON.parse(before),existing=config.clients[client]??{skills:[],mcp:[]};
    for(const [flag,key] of [['--skills','skills'],['--mcp','mcp']])if(flags[flag]!==undefined) {
      const value=flags[flag]==='-'?[]:flags[flag].split(',');
      if(value.some(x=>!nameOK(x))||new Set(value).size!==value.length)throw new Error('Invalid resource names');
      existing[key]=value;
    }
    config.clients[client]=existing;
    // Validate selections without publishing or invoking any runtime.
    const previous=before;atomic(file,JSON.stringify(config,null,2)+'\n',before);
    try{new Manager({root,home:flags['--home']??os.homedir()}).plan({client});}
    catch(error){atomic(file,previous,fs.readFileSync(file,'utf8'));throw error;}
    console.log(JSON.stringify({ok:true,client,selection:existing,nativeFilesChanged:false}));
  } else {
    if(!['plan','apply','doctor','rollback','recover'].includes(command))throw new Error('Unknown command');
    if(command==='rollback'&&!client&&!flags['--resource'])throw new Error('rollback requires --client or --resource to avoid blanket removal');
    if(['--skills','--mcp'].some(k=>flags[k]!==undefined))throw new Error('Use select to change resource lists');
    if(flags['--resource']&&!nameOK(flags['--resource']))throw new Error('Invalid resource filter');
    const manager=new Manager({root,home:flags['--home']??os.homedir()});
    const result=manager[command]({client,resource:flags['--resource']});
    console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  }
} catch(error) {console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
