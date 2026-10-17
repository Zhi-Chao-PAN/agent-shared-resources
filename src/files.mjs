import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash=x=>x===null?null:crypto.createHash('sha256').update(x).digest('hex');
export function read(file) {
  try {if(!fs.lstatSync(file).isFile())throw new Error('Expected regular file: '+file);return fs.readFileSync(file,'utf8');}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export function noLinks(file) {
  for(let p=file;;p=path.dirname(p)) {
    try{if(fs.lstatSync(p).isSymbolicLink())throw new Error('Symlink/junction target needs a canonical override: '+p);}
    catch(e){if(e.code!=='ENOENT')throw e;}
    if(path.dirname(p)===p)break;
  }
}
export function within(parent,file) {
  const rel=path.relative(parent,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);
}
export function atomic(file,text,expected) {
  noLinks(file);
  if(read(file)!==expected)throw new Error('Concurrent file edit; nothing overwritten: '+file);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=file+'.ars-'+crypto.randomUUID();
  const fd=fs.openSync(temp,'wx',fs.existsSync(file)?fs.statSync(file).mode&0o777:0o600);
  try {
    fs.writeFileSync(fd,text);fs.fsyncSync(fd);fs.closeSync(fd);
    noLinks(file);
    if(read(file)!==expected)throw new Error('Concurrent file edit before rename: '+file);
    fs.renameSync(temp,file);
  } finally {
    try{fs.closeSync(fd);}catch{}
    if(fs.existsSync(temp))fs.unlinkSync(temp);
  }
}
export function tree(directory) {
  noLinks(directory);
  if(!fs.existsSync(directory))return null;
  if(!fs.lstatSync(directory).isDirectory())throw new Error('Skill target is not a directory');
  const rows=[],caseNames=new Set();let bytes=0;
  function walk(dir,relative='') {
    for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const rel=relative+item.name,file=path.join(dir,item.name),st=fs.lstatSync(file);
      if(st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory()))throw new Error('Skill contains a link or special file: '+rel);
      if(/[<>:"|?*\\]/.test(item.name)||/[. ]$/.test(item.name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(item.name))throw new Error('Non-portable skill filename: '+rel);
      if(caseNames.has(rel.toLowerCase()))throw new Error('Case-colliding skill paths: '+rel);
      caseNames.add(rel.toLowerCase());
      if(st.isDirectory()){rows.push([rel,'directory']);walk(file,rel+'/');}
      else {bytes+=st.size;if(bytes>20*1024*1024)throw new Error('Skill exceeds 20 MiB; keep dependencies outside the skill');rows.push([rel,hash(fs.readFileSync(file))]);}
    }
  }
  walk(directory);
  return hash(JSON.stringify(rows));
}
