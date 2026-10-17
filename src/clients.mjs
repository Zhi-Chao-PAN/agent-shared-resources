import path from 'node:path';

// Defaults from the reference Mac installation. Windows defaults are provided
// only for documented home-relative formats; other paths require an override.
export const CLIENTS = {
  claude: {kind:'json', mcp:'.claude.json', skills:'.claude/skills', windows:true},
  codex: {kind:'toml', mcp:'.codex/config.toml', skills:'.codex/skills', windows:true},
  'qoder-cn': {kind:'json', mcp:'.qoder-cn/settings.json', skills:'.qoder-cn/skills', windows:true},
  qoder: {kind:'json', mcp:'.qoder/settings.json', skills:'.qoder/skills', windows:true},
  gemini: {kind:'json', mcp:'.gemini/settings.json', skills:'.gemini/skills', windows:true},
  workbuddy: {kind:'json', mcp:'.workbuddy/mcp.json', skills:'.workbuddy/skills'},
  minimax: {kind:'json', mcp:'.minimax/mcp.json', skills:null, minimax:true},
  'trae-cn': {kind:'json', mcp:'Library/Application Support/Trae CN/User/mcp.json', skills:'.trae-cn/skills'},
  antigravity: {kind:'json', mcp:'.gemini/config/mcp_config.json', skills:'.gemini/config/skills', allowEmpty:true},
  dsh: {kind:'yaml', mcp:'.dsh/profiles/desktop/cordis.patch.yml', skills:null},
  zcode: {kind:'json', mcp:'.zcode/cli/config.json', skills:null, nested:true},
};

export function clientPaths(id, options, home, platform=process.platform) {
  const c=CLIENTS[id];
  if(!c) throw new Error('Unknown client: '+id);
  const windows=platform==='win32';
  const resolve=(override, fallback, selected)=>{
    if(!selected) return null;
    if(windows&&!c.windows&&!override) throw new Error(id+': Windows path needs an explicit local override');
    const value=override??fallback;
    if(!value) throw new Error(id+': native path is not established; provide a local override');
    if(typeof value!=='string'||!value||value.includes('\0')) throw new Error('Invalid client path');
    return path.resolve(home,value);
  };
  return {...c,
    mcpFile:resolve(options.mcpFile,c.mcp,options.mcp.length>0||(options.hiddenSkills?.length??0)>0),
    skillsDir:resolve(options.skillsDir,c.skills,options.skills.length>0),
  };
}

export function serverValue(layout, name, server) {
  if(layout.kind==='yaml') return {id:name,name:'@deepseek-ai/dsh-mcp-client',config:{serverName:name,transport:'stdio',...server}};
  if(layout.minimax) return {type:'stdio',enabled:true,configured:true,builtin:false,description:name,...server};
  return server;
}

export function serverKeys(layout,name) {
  return [layout.kind==='toml'?'mcp_servers':'mcpServers',name];
}

export function nativeKeys(layout,name) {
  return layout.nested?['mcp','servers',name]:serverKeys(layout,name);
}
