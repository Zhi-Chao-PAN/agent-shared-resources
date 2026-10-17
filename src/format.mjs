import * as jsonc from 'jsonc-parser';
import * as toml from 'smol-toml';
import * as yaml from 'js-yaml';

export function equal(a,b) {return JSON.stringify(sorted(a))===JSON.stringify(sorted(b));}
function sorted(a) {
  if(Array.isArray(a))return a.map(sorted);
  if(a&&typeof a==='object')return Object.fromEntries(Object.keys(a).sort().map(k=>[k,sorted(a[k])]));
  return a;
}

export function parse(text,layout) {
  if(text===null||(text.trim()===''&&layout.allowEmpty))return layout.kind==='yaml'?[]:{};
  if(layout.kind==='toml')return toml.parse(text);
  if(layout.kind==='yaml') {
    const js=yaml.defineScalarTag('tag:yaml.org,2002:js',{resolve:v=>({opaqueJs:v}),identify:v=>!!v&&typeof v==='object'&&Object.hasOwn(v,'opaqueJs')});
    const doc=yaml.load(text,{schema:new yaml.Schema([...yaml.CORE_SCHEMA.tags,js])});
    if(!Array.isArray(doc))throw new Error('DSH patch must be an array');
    return doc;
  }
  const errors=[]; const tree=jsonc.parseTree(text,errors,{allowTrailingComma:true});
  if(errors.length||tree?.type!=='object')throw new Error('Invalid JSON/JSONC config');
  function unique(node) {
    if(node.type==='object') {
      const keys=new Set();
      for(const property of node.children??[]) {
        const k=property.children[0].value;
        if(keys.has(k))throw new Error('Duplicate JSON key: '+k);
        keys.add(k);unique(property.children[1]);
      }
    } else for(const child of node.children??[])unique(child);
  }
  unique(tree);return jsonc.getNodeValue(tree);
}

export function get(doc,layout,name,keys) {
  if(layout.kind==='yaml') {
    const found=doc.flatMap(e=>e?.insert??[]).filter(r=>r?.config?.serverName===name);
    if(found.length>1)throw new Error('Duplicate managed server: '+name);
    return found[0];
  }
  return keys.reduce((v,k)=>v&&Object.hasOwn(v,k)?v[k]:undefined,doc);
}

function without(doc,layout,name,keys) {
  const copy=structuredClone(doc);
  if(layout.kind==='yaml')return copy.flatMap(e=>{
    if(!Array.isArray(e.insert))return[e];
    e.insert=e.insert.filter(r=>r?.config?.serverName!==name);
    if(!e.insert.length)delete e.insert;
    return Object.keys(e).length?[e]:[];
  });
  let parent=copy;const chain=[];
  for(const key of keys.slice(0,-1)) {
    if(!Object.hasOwn(parent,key))return copy;
    if(!parent[key]||typeof parent[key]!=='object'||Array.isArray(parent[key]))throw new Error('Native config path is not an object');
    chain.push([parent,key]);parent=parent[key];
  }
  delete parent[keys.at(-1)];
  for(const [p,k] of chain.reverse())if(Object.keys(p[k]).length===0)delete p[k];
  return copy;
}

function marked(layout,name,value,eol) {
  const body=layout.kind==='toml'
    ? '[mcp_servers.'+name+']\ncommand = '+JSON.stringify(value.command)+'\nargs = '+JSON.stringify(value.args)+'\n'
    :yaml.dump([{insert:[value]}],{lineWidth:-1,noRefs:true});
  return ('\n# BEGIN agent-shared-resources '+name+'\n'+body+'# END agent-shared-resources '+name+'\n').replaceAll('\n',eol);
}

export function transform(text,layout,name,keys,value,{remove=false}={}) {
  const doc=parse(text,layout),existing=get(doc,layout,name,keys);
  if(existing!==undefined&&!equal(existing,value))throw new Error('Managed entry differs; preserving it: '+name);
  if(remove&&existing===undefined)return text;
  if(!remove&&existing!==undefined)return text;
  const eol=text?.includes('\r\n')?'\r\n':'\n';let next;
  if(layout.kind==='json')next=jsonc.applyEdits(text??'{}\n',jsonc.modify(text??'{}\n',keys,remove?undefined:value,{formattingOptions:{insertSpaces:true,tabSize:2,eol}}));
  else if(remove) {
    const block=marked(layout,name,value,eol);
    if(!text.includes(block))throw new Error('Managed block was reformatted; reconcile manually');
    next=text.replace(block,'');
  } else next=(text??'')+marked(layout,name,value,eol);
  const after=parse(next,layout);
  if(!equal(without(doc,layout,name,keys),without(after,layout,name,keys)))throw new Error('Unmanaged config would change');
  if(!remove&&!equal(get(after,layout,name,keys),value))throw new Error('Native entry readback failed');
  return next;
}
