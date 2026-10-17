import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tree} from '../src/files.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const topFiles=new Set(['README.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','SECURITY.md','package.json','package-lock.json','.gitignore','.gitattributes']);
const dirs=new Set(['src','bin','scripts','tests','docs','catalog','examples','skills','runtimes','.github']);
const forbidden=/(^|\/)(node_modules|\.state|\.auth|logs|projects|work|inputs|outputs|backups)(\/|$)|\.local\.json$|(^|\/)\.env(?:$|\.)|\.mac-storage\.json$/;
const patterns=[
  ['private-home',/\/Users\/(?!example(?:\/|$)|<)[^/\s]+/],
  ['private-volume',/\/Volumes\/[A-Za-z0-9_-]+\//],
  ['windows-home',/[A-Z]:\\Users\\(?!example\b|<)[A-Za-z0-9_. -]+\\/i],
  ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['aws-key',/\bAKIA[0-9A-Z]{16}\b/],
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{30}/],
  ['literal-bearer',/Bearer [A-Za-z0-9_-]{45,}/],
];
const findings=[];
function scan(label,text) {
  if(text.includes(os.homedir())||text.includes(os.hostname()))findings.push({file:label,kind:'current-machine-identity'});
  for(const [kind,regex] of patterns)if(regex.test(text))findings.push({file:label,kind});
}
function git(args) {return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}
function enumerate(dir,prefix='') {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const rel=prefix+e.name;
    if(!prefix&&!topFiles.has(e.name)&&!dirs.has(e.name))return[];
    if(e.name==='node_modules')return[];
    if(e.isSymbolicLink())throw new Error('Published tree contains a symlink: '+rel);
    return e.isDirectory()?enumerate(path.join(dir,e.name),rel+'/'):[rel];
  });
}
let inGit=false;
try{inGit=fs.realpathSync(git(['rev-parse','--show-toplevel']).trim())===fs.realpathSync(root);}catch{}
const files=inGit?git(['ls-files','-z']).split('\0').filter(Boolean):enumerate(root);
if(!files.length)throw new Error('No reviewed files to check; stage the intended publication first');
for(const file of files) {
  const top=file.split('/')[0];
  if(forbidden.test(file)||(!file.includes('/')&&!topFiles.has(file))||(file.includes('/')&&!dirs.has(top)))findings.push({file,kind:'unexpected-publication-file'});
  const absolute=path.join(root,file),stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink()||!stat.isFile())throw new Error('Not a regular publication file: '+file);
  if(stat.size>1024*1024)findings.push({file,kind:'oversized-file-review-required'});
  scan(file,fs.readFileSync(absolute,'utf8'));
}
let historyBlobs=0;
if(inGit) {
  let objects='';try{objects=git(['rev-list','--objects','--all']);}catch{}
  for(const line of objects.trim().split('\n').filter(Boolean)) {
    const object=line.slice(0,40);if(!/^[a-f0-9]{40}$/.test(object))throw new Error('Unexpected Git object id');
    if(git(['cat-file','-t',object]).trim()!=='blob')continue;
    historyBlobs++;scan('history:'+object,git(['cat-file','blob',object]));
  }
  try{scan('commit-metadata',git(['log','--all','--format=%an <%ae> %cn <%ce> %s']));}catch{}
}
const skills=JSON.parse(fs.readFileSync(path.join(root,'catalog/skills.json'),'utf8'));
for(const [name,spec] of Object.entries(skills)) {
  if(tree(path.join(root,spec.source))!==spec.sha256)findings.push({file:spec.source,kind:'skill-content-drift'});
  if(!fs.readdirSync(path.join(root,spec.source)).some(n=>n.startsWith('LICENSE')))findings.push({file:spec.source,kind:'missing-original-license'});
  if(!spec.origin.startsWith('https://github.com/')||!['MIT','Apache-2.0'].includes(spec.license))findings.push({file:name,kind:'unreviewed-skill-provenance'});
}
for(const file of ['package-lock.json','runtimes/package-lock.json']) {
  const lock=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  for(const [name,pkg] of Object.entries(lock.packages??{}))if(pkg.resolved&&!pkg.resolved.startsWith('https://registry.npmjs.org/'))findings.push({file,kind:'non-registry-lock-source',package:name});
}
console.log(JSON.stringify({ok:!findings.length,files:files.length,historyBlobs,bundledSkills:Object.keys(skills).length,findings,scope:'Common secret/path patterns and publication allowlist; not a complete security audit'},null,2));
if(findings.length)process.exitCode=1;
