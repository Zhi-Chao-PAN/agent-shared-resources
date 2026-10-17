#!/usr/bin/env node
// This is a stdio launcher, not a permission/authorization bypass or a gateway.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const service=process.argv[2],catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog/mcp.json'),'utf8'));
const entry=Object.values(catalog).find(x=>x.service===service);
try {
  if(!entry||process.argv.length!==3)throw new Error('Usage: run-mcp.mjs notion|linear|context7|exa|github|playwright|serena');
  const configFile=path.join(root,'agent-resources.local.json');
  const config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
  const runtime=config.runtime??{},state=path.join(os.homedir(),'.agent-shared-resources');
  const nodeModules=path.resolve(root,runtime.nodeModules??'runtimes/node_modules');
  const env={...process.env};let command=process.execPath,args=[];
  function npmBin(pkg,version,bin) {
    const dir=path.join(nodeModules,...pkg.split('/'));
    const metadata=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
    if(metadata.version!==version)throw new Error('Pinned runtime version differs; restore optional runtimes with npm ci');
    const relative=typeof metadata.bin==='string'?metadata.bin:metadata.bin?.[bin];
    if(typeof relative!=='string')throw new Error('Runtime CLI entry missing');
    const file=path.resolve(dir,relative),rel=path.relative(dir,file);
    if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.statSync(file).isFile())throw new Error('Invalid runtime entry');
    return file;
  }
  if(['notion','linear','exa'].includes(service)) {
    args=[npmBin('mcp-remote','0.14.3','mcp-remote'),entry.endpoint];
    env.MCP_REMOTE_CONFIG_DIR=path.join(state,'auth',service);
    fs.mkdirSync(env.MCP_REMOTE_CONFIG_DIR,{recursive:true,mode:0o700});
  } else if(service==='context7')args=[npmBin('@upstash/context7-mcp',entry.version,'context7-mcp')];
  else if(service==='playwright')args=[npmBin('@playwright/mcp',entry.version,'playwright-mcp'),'--headless','--isolated','--browser','chromium','--output-dir',path.resolve(runtime.playwrightOutput??path.join(state,'playwright-output'))];
  else if(service==='serena') {
    command=runtime.uvx??'uvx';
    args=['--from','serena-agent=='+entry.version,'serena','start-mcp-server','--context','ide'];
  } else {
    if(!runtime.githubBinary||!path.isAbsolute(runtime.githubBinary)||!/^([a-f0-9]{64})$/i.test(runtime.githubSha256??''))throw new Error('Set runtime.githubBinary and its verified official SHA-256 in the local manifest');
    const digest=crypto.createHash('sha256').update(fs.readFileSync(runtime.githubBinary)).digest('hex');
    if(digest!==runtime.githubSha256.toLowerCase())throw new Error('GitHub binary checksum differs');
    // Never print, persist, or pass the credential in a command argument.
    const token=execFileSync(runtime.gh??'gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(!token)throw new Error('No usable gh credential');
    env.GITHUB_PERSONAL_ACCESS_TOKEN=token;command=runtime.githubBinary;args=['stdio'];
  }
  const child=spawn(command,args,{stdio:'inherit',env,shell:false,windowsHide:true});
  child.once('error',()=>{console.error('MCP process could not start; check runtime paths and official setup docs');process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(!child.killed)child.kill(signal);});
  child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
} catch(error) {
  // Avoid echoing provider errors or gh output, which could contain credentials.
  const safe=error?.code==='ENOENT'?'Optional runtime missing; see docs/mcp.md':error?.status!==undefined?'Official CLI credential lookup failed; use gh auth login yourself':error.message;
  console.error('agent-shared-resources: '+safe);process.exitCode=1;
}
