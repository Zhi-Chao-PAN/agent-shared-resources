import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Manager,CONFIG} from '../src/manager.mjs';
import {CLIENTS,clientPaths} from '../src/clients.mjs';
import {tree} from '../src/files.mjs';

function fixture(t,client='qoder-cn',platform=process.platform) {
  const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ars-test-'))),root=path.join(tmp,'repo'),home=path.join(tmp,'home');
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  for(const dir of [root,home,path.join(root,'catalog'),path.join(root,'skills/demo-skill')])fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(root,'skills/demo-skill/SKILL.md'),'---\nname: demo-skill\ndescription: Fixture only.\n---\n\nFixture skill body.\n');
  fs.writeFileSync(path.join(root,'catalog/skills.json'),JSON.stringify({'demo-skill':{source:'skills/demo-skill',sha256:tree(path.join(root,'skills/demo-skill'))}}));
  fs.writeFileSync(path.join(root,'catalog/mcp.json'),JSON.stringify({'shared-context7':{service:'context7'}}));
  const selected={skills:['demo-skill'],mcp:['shared-context7']};
  if(!CLIENTS[client].skills)selected.skillsDir=client+'/skills';
  if(platform==='win32'&&!CLIENTS[client].windows){selected.mcpFile=client+'/settings.json';selected.skillsDir=client+'/skills';}
  const cfg={version:1,clients:{[client]:selected},skills:{},servers:{},runtime:{}};
  const save=()=>fs.writeFileSync(path.join(root,CONFIG),JSON.stringify(cfg,null,2)+'\n');save();
  const m=()=>new Manager({root,home,platform});
  const layout=clientPaths(client,selected,home,platform),file=layout.mcpFile;
  const before=layout.kind==='toml'?'# private comment\nmodel="keep-private"\n[mcp_servers.private]\ncommand="private-command"\n'
    :layout.kind==='yaml'?'- id: skill-filesystem\n  config:\n    cwd: !!js process.cwd()\n- insert:\n  - id: private\n    config:\n      serverName: private\n      command: keep-private\n'
    :layout.nested?'{\n// private comment\n"private":"keep-private","mcp":{"servers":{"private":{"command":"private-command"}}},"permissions":{"ask":["Edit"],"sandbox":true}}\n'
    :'{\n// private comment\n"private":"keep-private","permissions":{"ask":["Edit"],"sandbox":true},"mcpServers":{"private":{"command":"private-command"}}}\n';
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,before);
  return {root,home,cfg,save,m,layout,file,before,target:path.join(layout.skillsDir,'demo-skill')};
}

for(const client of Object.keys(CLIENTS)) {
  test(client+': preview is read-only; publish is scoped and idempotent; rollback keeps later edits',t=>{
    const f=fixture(t,client),m=f.m();assert.equal(m.plan().changes,2);
    assert(!fs.existsSync(m.stateDir));assert.equal(fs.readFileSync(f.file,'utf8'),f.before);
    assert.equal(m.apply().changes,2);assert.equal(m.doctor().ok,true);
    const published=fs.readFileSync(f.file,'utf8');assert(published.includes('keep-private'));assert(published.includes('shared-context7'));
    assert.equal(m.apply().changes,0);assert.equal(fs.readFileSync(f.file,'utf8'),published);
    fs.writeFileSync(f.file,published.replace('keep-private','later-private-edit'));
    assert.equal(m.rollback({client}).ok,true);assert(!fs.existsSync(f.target));
    const after=fs.readFileSync(f.file,'utf8');assert(after.includes('later-private-edit'));assert(!after.includes('shared-context7'));
    if(f.layout.kind==='json'){assert(after.includes('sandbox'));assert(after.includes('private comment'));}
  });
}

test('one conflict prevents all planned native mutations',t=>{
  const f=fixture(t);f.cfg.servers['shared-context7']={command:'configured',args:[]};f.save();
  fs.writeFileSync(f.file,JSON.stringify({mcpServers:{'shared-context7':{command:'private',args:[]}},permissions:{ask:['Edit']}}));
  const before=fs.readFileSync(f.file);assert.throws(()=>f.m().apply(),/preserving/);assert(!fs.existsSync(f.target));assert.deepEqual(fs.readFileSync(f.file),before);
});
test('later user edits to a managed skill refuse rollback without touching other resources',t=>{
  const f=fixture(t),m=f.m();m.apply();fs.appendFileSync(path.join(f.target,'SKILL.md'),'\nUser edits\n');
  const before=fs.readFileSync(f.file);assert.throws(()=>m.rollback({client:'qoder-cn'}),/changed/);assert.deepEqual(fs.readFileSync(f.file),before);assert(fs.readFileSync(path.join(f.target,'SKILL.md'),'utf8').includes('User edits'));
});
test('identical pre-existing skills are not claimed or removed',t=>{
  const f=fixture(t);fs.mkdirSync(path.dirname(f.target),{recursive:true});fs.cpSync(path.join(f.root,'skills/demo-skill'),f.target,{recursive:true});
  const m=f.m();m.apply();m.rollback({client:'qoder-cn'});assert(fs.existsSync(f.target));
});
test('partial transactions are explicit, recoverable, and idempotent',t=>{
  const f=fixture(t),m=f.m(),perform=m.perform.bind(m);let count=0;
  m.perform=(...args)=>{if(++count===2)throw new Error('simulated interruption');return perform(...args);};
  assert.throws(()=>m.apply(),/simulated/);assert(fs.existsSync(f.target));assert.equal(fs.readFileSync(f.file,'utf8'),f.before);
  assert.throws(()=>f.m().plan(),/recover/);assert.equal(f.m().recover().ok,true);assert.equal(f.m().doctor().ok,true);assert.equal(f.m().recover().changes,0);
});
test('recovery refuses a concurrent native edit; it never restores a whole private config blindly',t=>{
  const f=fixture(t),m=f.m();m.perform=()=>{throw new Error('pause');};assert.throws(()=>m.apply());
  fs.writeFileSync(f.file,f.before+'\n// concurrent user edit\n');assert.throws(()=>f.m().recover(),/Concurrent/);assert(fs.readFileSync(f.file,'utf8').includes('concurrent user edit'));
});
test('Windows unknown layouts require explicit native paths',t=>{
  const f=fixture(t,'workbuddy','win32');delete f.cfg.clients.workbuddy.mcpFile;f.save();assert.throws(()=>f.m().plan(),/Windows path/);
});
test('documented Windows home defaults are exercised without requiring symlink privileges',t=>{
  const f=fixture(t,'qoder-cn','win32');assert.equal(f.m().apply().ok,true);assert.equal(fs.lstatSync(f.target).isSymbolicLink(),false);assert.equal(f.m().doctor().ok,true);
});
test('Claude Code uses user scope and preserves unrelated state in ~/.claude.json',t=>{
  const f=fixture(t,'claude');assert.equal(f.file,path.join(f.home,'.claude.json'));assert.equal(f.target,path.join(f.home,'.claude/skills/demo-skill'));
  assert.equal(f.m().apply().ok,true);assert.equal(f.m().doctor().ok,true);
  const published=fs.readFileSync(f.file,'utf8');assert(published.includes('keep-private'));assert(published.includes('sandbox'));assert(published.includes('shared-context7'));assert(published.includes('private comment'));
});
test('a resource filter rolls a resource back across clients without touching other resources',t=>{
  const f=fixture(t);f.cfg.clients.codex={skills:['demo-skill'],mcp:[]};f.save();
  const codexFile=path.join(f.home,'.codex/config.toml');fs.mkdirSync(path.dirname(codexFile),{recursive:true});fs.writeFileSync(codexFile,'model="keep-private"\n');
  const m=f.m();assert.equal(m.apply().ok,true);
  assert.equal(m.rollback({resource:'demo-skill'}).ok,true);
  assert(!fs.existsSync(f.target));assert(!fs.existsSync(path.join(f.home,'.codex/skills/demo-skill')));
  assert(fs.readFileSync(codexFile,'utf8').includes('keep-private'));
  assert(fs.readFileSync(f.file,'utf8').includes('shared-context7'));
});
test('Qoder per-name visibility changes preserve its account, MCP and permission settings',t=>{
  const f=fixture(t);f.cfg.clients['qoder-cn'].hiddenSkills=['retired-skill'];f.save();const m=f.m();m.apply();
  assert(fs.readFileSync(f.file,'utf8').includes('"off"'));m.rollback({client:'qoder-cn',resource:'hide-retired-skill'});
  const after=fs.readFileSync(f.file,'utf8');assert(after.includes('shared-context7'));assert(after.includes('sandbox'));assert(!after.includes('retired-skill'));
});
test('malformed and duplicate native keys refuse before copying skills',t=>{
  const f=fixture(t);for(const broken of ['{broken','{"mcpServers":{},"mcpServers":{}}']){fs.writeFileSync(f.file,broken);assert.throws(()=>f.m().apply());assert(!fs.existsSync(f.target));}
});
test('native symlinks and Windows junctions are not followed',t=>{
  const f=fixture(t),parent=path.dirname(f.file),other=path.join(f.home,'redirect');fs.renameSync(parent,other);
  fs.symlinkSync(other,parent,process.platform==='win32'?'junction':'dir');assert.throws(()=>f.m().apply(),/Symlink\/junction/);assert.equal(fs.readFileSync(path.join(other,'settings.json'),'utf8'),f.before);
});
test('nested source links cannot escape a skill',t=>{
  const f=fixture(t),source=path.join(f.root,'skills/demo-skill'),outside=path.join(f.home,'outside');fs.mkdirSync(outside);
  fs.symlinkSync(outside,path.join(source,'linked'),process.platform==='win32'?'junction':'dir');assert.throws(()=>f.m().apply(),/link|Symlink/);assert(!fs.existsSync(f.target));
});
test('a forged receipt cannot redirect rollback to another file',t=>{
  const f=fixture(t),m=f.m();m.apply();const state=JSON.parse(fs.readFileSync(m.stateFile,'utf8')),key=Object.keys(state.records)[0],row=state.records[key];delete state.records[key];row.path=path.join(f.home,'private.txt');state.records[m.key(row)]=row;fs.writeFileSync(m.stateFile,JSON.stringify(state));
  fs.writeFileSync(row.path,'private');assert.throws(()=>f.m().rollback({client:'qoder-cn'}),/Receipt path/);assert.equal(fs.readFileSync(row.path,'utf8'),'private');
});
test('two client ids cannot alias the same config file',t=>{
  const f=fixture(t);f.cfg.clients.qoder={skills:[],mcp:['shared-context7'],mcpFile:f.file};f.save();assert.throws(()=>f.m().apply(),/same native file/);assert.equal(fs.readFileSync(f.file,'utf8'),f.before);
});
test('no implicit credentials or approval fields are accepted in shared server definitions',t=>{
  const f=fixture(t);f.cfg.servers['shared-context7']={command:'node',args:[],env:{SECRET:'not-a-real-secret'}};f.save();assert.throws(()=>f.m().apply(),/Unsupported/);
});
test('recovery validates intended entry edits before touching a native file',t=>{
  const f=fixture(t),m=f.m();m.perform=()=>{throw new Error('pause');};assert.throws(()=>m.apply());
  const state=JSON.parse(fs.readFileSync(m.stateFile,'utf8')),op=state.pending.operations.find(x=>x.kind==='config');
  const original=op.after;op.after=op.after.replace(/"sandbox"\s*:\s*true/,'"sandbox":false');assert.notEqual(op.after,original);
  fs.writeFileSync(m.stateFile,JSON.stringify(state));assert.throws(()=>f.m().recover(),/Pending config differs/);assert.equal(fs.readFileSync(f.file,'utf8'),f.before);
});
