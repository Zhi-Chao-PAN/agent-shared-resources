import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {CLIENTS,clientPaths,nativeKeys,serverValue} from './clients.mjs';
import {parse,get,equal,transform} from './format.mjs';
import {read,hash,tree,noLinks,within,atomic} from './files.mjs';

export const CONFIG='agent-resources.local.json';
export function nameOK(value) {
  return typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(value)&&!['constructor','prototype'].includes(value);
}
function names(value) {
  if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(x=>!nameOK(x)))throw new Error('Expected unique resource names');
  return value;
}
function allowed(obj,keys,description) {
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))throw new Error('Unsupported '+description+' fields');
}
const formatShape=layout=>Object.fromEntries(['kind','nested','minimax','allowEmpty'].filter(k=>Object.hasOwn(layout,k)).map(k=>[k,layout[k]]));

export class Manager {
  constructor({root,home=os.homedir(),platform=process.platform}={}) {
    this.root=fs.realpathSync(root);this.home=fs.realpathSync(home);this.platform=platform;
    this.stateDir=path.join(this.home,'.agent-shared-resources');this.stateFile=path.join(this.stateDir,'state.json');
    this.config=JSON.parse(fs.readFileSync(path.join(this.root,CONFIG),'utf8'));
    allowed(this.config,['version','clients','skills','servers','runtime'],'config');
    if(this.config.version!==1)throw new Error('Unsupported config version');
    allowed(this.config.runtime??{},['nodeModules','githubBinary','githubSha256','gh','uvx','playwrightOutput'],'runtime');
    for(const value of Object.values(this.config.runtime??{}))if(typeof value!=='string')throw new Error('Runtime paths must be strings');
    for(const [id,c] of Object.entries(this.config.clients??{})) {
      if(!CLIENTS[id])throw new Error('Unknown client: '+id);
      allowed(c,['skills','mcp','skillsDir','mcpFile','hiddenSkills'],'client');
      names(c.skills);names(c.mcp);names(c.hiddenSkills??[]);
      if(c.hiddenSkills?.length&&id!=='qoder-cn'&&id!=='qoder')throw new Error('hiddenSkills currently requires a Qoder adapter');
    }
    this.catalog=JSON.parse(fs.readFileSync(path.join(this.root,'catalog/mcp.json'),'utf8'));
    this.bundled=JSON.parse(fs.readFileSync(path.join(this.root,'catalog/skills.json'),'utf8'));
    for(const name of [...Object.keys(this.config.skills??{}),...Object.keys(this.config.servers??{})])if(!nameOK(name))throw new Error('Invalid resource name');
    noLinks(this.stateDir);
  }
  expand(value) {
    if(typeof value!=='string')throw new Error('Expected a string');
    const vars={root:this.root,home:this.home,node:process.execPath};
    return value.replace(/\$\{([^}]+)\}/g,(_,key)=>{if(!Object.hasOwn(vars,key))throw new Error('Unknown placeholder: '+key);return vars[key];});
  }
  source(name) {
    const custom=this.config.skills?.[name],bundled=this.bundled[name];
    if(!custom&&!bundled)throw new Error('Unknown skill: '+name);
    const source=fs.realpathSync(path.resolve(this.root,this.expand(custom??bundled.source)));
    const content=fs.readFileSync(path.join(source,'SKILL.md'),'utf8');
    if(!new RegExp('^name:\\s*["\']?'+name+'["\']?\\s*$','m').test(content))throw new Error('Skill name/frontmatter differs: '+name);
    const digest=tree(source);
    if(!custom&&digest!==bundled.sha256)throw new Error('Bundled skill changed; review and update catalog hash: '+name);
    return {source,digest};
  }
  server(name) {
    const custom=this.config.servers?.[name];
    if(custom) {
      allowed(custom,['command','args'],'server (keep credentials in the client environment/keychain)');
      if(!Array.isArray(custom.args)||custom.args.some(a=>typeof a!=='string'))throw new Error('Invalid MCP arguments');
      return {command:this.expand(custom.command),args:custom.args.map(a=>this.expand(a))};
    }
    const entry=this.catalog[name];if(!entry)throw new Error('Unknown MCP: '+name);
    return {command:process.execPath,args:[path.join(this.root,'bin/run-mcp.mjs'),entry.service]};
  }
  target(file) {
    if(!within(this.home,file)||file===this.stateDir||within(this.stateDir,file))throw new Error('Native targets must be inside the user home and outside manager state');
    noLinks(file);return file;
  }
  state() {
    const text=read(this.stateFile);const state=text===null?{version:1,records:{},pending:null}:JSON.parse(text);
    if(state.version!==1||!state.records||typeof state.records!=='object'||Array.isArray(state.records))throw new Error('Invalid publication receipt');
    this.validateRecords(state.records);
    return {state,text};
  }
  validateRecords(records) {
    if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('Invalid receipt records');
    for(const [key,record] of Object.entries(records)) {
      if(key!==this.key(record)||!CLIENTS[record.client]||!nameOK(record.name)||!['config','skill'].includes(record.kind))throw new Error('Receipt identity mismatch');
      this.target(record.path);
      const c=this.config.clients?.[record.client]??{skills:[],mcp:[]};
      const layout=clientPaths(record.client,{...c,skills:record.kind==='skill'?[record.name]:[],mcp:record.kind==='config'?[record.name]:[]},this.home,this.platform);
      const expected=record.kind==='skill'?path.join(layout.skillsDir,record.name):layout.mcpFile;
      if(record.path!==expected)throw new Error('Receipt path differs from client config; restore the old override before rollback');
      if(record.kind==='skill') {
        if(record.resource!==record.name||!/^([a-f0-9]{64})$/.test(record.digest)||typeof record.source!=='string')throw new Error('Invalid skill receipt');
      } else if(record.resource==='hide-'+record.name) {
        if(!['qoder-cn','qoder'].includes(record.client)||!equal(record.keys,['skillOverrides',record.name])||record.value!=='off'||!equal(record.layout,{kind:'json'}))throw new Error('Invalid visibility receipt');
      } else {
        if(record.resource!==record.name||!equal(record.keys,nativeKeys(layout,record.name))||!equal(record.layout,formatShape(layout)))throw new Error('Invalid MCP receipt layout');
        const server=layout.kind==='yaml'?record.value?.config:record.value;
        if(typeof server?.command!=='string'||!Array.isArray(server?.args)||server.args.some(x=>typeof x!=='string')||!equal(record.value,serverValue(layout,record.name,{command:server.command,args:server.args})))throw new Error('Invalid MCP receipt value');
      }
    }
  }
  key(row) {return hash(JSON.stringify([row.client,row.kind,row.resource,row.path]));}
  selected(id,resource,scope) {return (!scope.client||scope.client===id)&&(!scope.resource||scope.resource===resource);}
  prepare(scope={},rollback=false) {
    const {state}=this.state();if(state.pending)throw new Error('Interrupted publication exists; run recover first');
    const records=structuredClone(state.records),files=new Map(),operations=[],entries=[];
    const fileEntry=(row,layout,keys,value,remove)=>{
      this.target(row.path);
      const doc=files.get(row.path)??{path:row.path,kind:'config',client:row.client,before:read(row.path),after:read(row.path)};
      if(doc.client!==row.client)throw new Error('Two client adapters target the same native file');
      const current=get(parse(doc.after,layout),layout,row.name,keys);
      const key=this.key(row),owned=state.records[key];
      if(remove) {
        if(!equal(current,value))throw new Error('Owned entry changed; rollback refused: '+row.resource);
        doc.after=transform(doc.after,layout,row.name,keys,value,{remove:true});delete records[key];
      } else {
        if(owned&&!equal(owned.value,value))throw new Error('Resource changed: rollback this resource before republishing');
        doc.after=transform(doc.after,layout,row.name,keys,value);
        if(current===undefined)records[key]={...row,layout:formatShape(layout),keys,value};
      }
      files.set(row.path,doc);entries.push({client:row.client,resource:row.resource,path:row.path,action:remove?'remove':current===undefined?'add':owned?'managed':'existing-identical-unowned'});
    };
    const skillEntry=(row,digest,source,remove)=>{
      this.target(row.path);const before=tree(row.path),key=this.key(row),owned=state.records[key];
      if(remove) {
        if(before!==digest)throw new Error('Owned skill changed; rollback refused: '+row.name);
        operations.push({kind:'skill',path:row.path,before,after:null});delete records[key];
      } else {
        if(before!==null&&before!==digest)throw new Error('Skill differs; private edits preserved. Rollback an owned old version before republishing: '+row.name);
        if(before===null){operations.push({kind:'skill',path:row.path,before:null,after:digest,source});records[key]={...row,digest,source};}
      }
      entries.push({client:row.client,resource:row.resource,path:row.path,action:remove?'remove':before===null?'copy':owned?'managed':'existing-identical-unowned'});
    };
    if(rollback) {
      for(const row of Object.values(state.records))if(this.selected(row.client,row.resource,scope)) {
        if(row.kind==='config')fileEntry(row,row.layout,row.keys,row.value,true);
        else skillEntry(row,row.digest,row.source,true);
      }
    } else for(const [id,c] of Object.entries(this.config.clients??{})) {
      if(scope.client&&scope.client!==id)continue;
      const layout=clientPaths(id,c,this.home,this.platform);
      for(const name of c.mcp)if(this.selected(id,name,scope))fileEntry({client:id,kind:'config',resource:name,name,path:layout.mcpFile},layout,nativeKeys(layout,name),serverValue(layout,name,this.server(name)),false);
      for(const name of c.hiddenSkills??[])if(this.selected(id,'hide-'+name,scope))fileEntry({client:id,kind:'config',resource:'hide-'+name,name,path:layout.mcpFile},{kind:'json'},['skillOverrides',name],'off',false);
      for(const name of c.skills)if(this.selected(id,name,scope)) {
        const {source,digest}=this.source(name);skillEntry({client:id,kind:'skill',resource:name,name,path:path.join(layout.skillsDir,name)},digest,source,false);
      }
    }
    for(const file of files.values())if(file.before!==file.after)operations.push(file);
    const paths=operations.map(x=>x.path);
    for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)if(paths[i]===paths[j]||within(paths[i],paths[j])||within(paths[j],paths[i]))throw new Error('Overlapping publication targets');
    return {operations,records,entries,rollback};
  }
  plan(scope={}) {const p=this.prepare(scope);return {ok:true,changes:p.operations.length,entries:p.entries,scope:'Files only; no server, account or model calls'};}
  withLock(fn) {
    noLinks(this.stateDir);fs.mkdirSync(this.stateDir,{recursive:true,mode:0o700});
    const lock=path.join(this.stateDir,'publish.lock');
    try{fs.mkdirSync(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw new Error('Another publisher holds the lock; verify it stopped before removing a stale lock');throw e;}
    try{return fn();}finally{fs.rmdirSync(lock);}
  }
  save(state) {atomic(this.stateFile,JSON.stringify(state,null,2)+'\n',read(this.stateFile));}
  current(op) {return op.kind==='config'?read(op.path):tree(op.path);}
  perform(op,id,index) {
    this.target(op.path);const now=this.current(op);
    if(now===op.after)return;
    if(now!==op.before)throw new Error('Concurrent target edit; recovery stopped: '+op.path);
    const backup=path.join(this.stateDir,'backups',id+'-'+index);
    noLinks(backup);
    fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});
    if(op.kind==='config') {
      if(op.before!==null&&!fs.existsSync(backup))atomic(backup,op.before,null);
      atomic(op.path,op.after,op.before);
    } else if(op.after===null) {
      if(fs.existsSync(backup))throw new Error('Unexpected skill backup collision');
      fs.renameSync(op.path,backup); // same-volume backup; edits/originals are retained
      if(tree(backup)!==op.before){fs.renameSync(backup,op.path);throw new Error('Skill changed during rollback; restored it');}
    } else {
      if(tree(op.source)!==op.after)throw new Error('Source changed after planning');
      fs.mkdirSync(path.dirname(op.path),{recursive:true,mode:0o700});
      const stage=path.join(path.dirname(op.path),'.'+path.basename(op.path)+'.ars-stage-'+id);
      noLinks(stage);
      if(!fs.existsSync(stage))fs.cpSync(op.source,stage,{recursive:true,errorOnExist:true,force:false});
      if(tree(stage)!==op.after)throw new Error('Incomplete/edited staging directory retained: '+stage);
      if(tree(op.path)!==null)throw new Error('Skill target appeared concurrently');
      fs.renameSync(stage,op.path);
    }
    if(this.current(op)!==op.after)throw new Error('Post-write verification failed');
  }
  finish(state) {
    const pending=state.pending;if(!pending)return {ok:true,changes:0};
    if(!/^[a-f0-9-]{36}$/.test(pending.id)||!Array.isArray(pending.operations))throw new Error('Invalid pending transaction');
    this.validateRecords(pending.records);
    const old=Object.values(state.records),next=Object.values(pending.records),targets=new Set();
    for(const op of pending.operations) {
      this.target(op.path);
      if(targets.has(op.path))throw new Error('Duplicate pending target');targets.add(op.path);
      const previous=old.filter(r=>r.path===op.path),following=next.filter(r=>r.path===op.path);
      if(op.kind==='config') {
        let expected=op.before;
        for(const row of previous)if(!pending.records[this.key(row)])expected=transform(expected,row.layout,row.name,row.keys,row.value,{remove:true});
        for(const row of following)if(!state.records[this.key(row)])expected=transform(expected,row.layout,row.name,row.keys,row.value);
        if(expected!==op.after||(!previous.length&&!following.length))throw new Error('Pending config differs from owned entry operations');
      } else if(op.kind==='skill') {
        if(op.after===null) {
          if(previous.length!==1||previous[0].kind!=='skill'||previous[0].digest!==op.before||following.length)throw new Error('Invalid pending skill removal');
        } else {
          if(op.before!==null||following.length!==1||following[0].kind!=='skill'||following[0].source!==op.source||following[0].digest!==op.after)throw new Error('Invalid pending skill copy');
          const current=this.source(following[0].name);if(current.source!==op.source||current.digest!==op.after)throw new Error('Pending skill source no longer matches the local manifest');
        }
      } else throw new Error('Invalid pending operation kind');
    }
    pending.operations.forEach((op,i)=>this.perform(op,pending.id,i));
    state.records=pending.records;state.pending=null;this.save(state);
    return {ok:true,changes:pending.operations.length,transaction:pending.id,backups:path.join(this.stateDir,'backups')};
  }
  apply(scope={},rollback=false) {
    return this.withLock(()=>{
      const plan=this.prepare(scope,rollback);if(!plan.operations.length)return {ok:true,changes:0};
      const {state}=this.state();state.pending={id:crypto.randomUUID(),operations:plan.operations,records:plan.records};this.save(state);
      return this.finish(state);
    });
  }
  recover() {return this.withLock(()=>this.finish(this.state().state));}
  rollback(scope={}) {return this.apply(scope,true);}
  doctor(scope={}) {
    const plan=this.plan(scope);return {...plan,ok:plan.changes===0,scope:'File contents and native declarations only; verify actual model calls separately'};
  }
}
