import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const arg of ['unknown','../notion','notion;echo injected'])test('launcher rejects unknown service before account/runtime access: '+arg,()=>{
  const result=spawnSync(process.execPath,[path.join(root,'bin/run-mcp.mjs'),arg],{encoding:'utf8',env:{...process.env,GITHUB_PERSONAL_ACCESS_TOKEN:'fixture-not-a-secret'}});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/Usage:/);assert(!result.stderr.includes('fixture-not-a-secret'));
});
test('CLI help exposes safe explicit publication commands',()=>{
  const result=spawnSync(process.execPath,[path.join(root,'bin/ars.mjs'),'help'],{encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stdout,/rollback/);assert.match(result.stdout,/recover/);
});
test('CLI does not perform a blanket rollback',()=>{
  const result=spawnSync(process.execPath,[path.join(root,'bin/ars.mjs'),'rollback'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/requires --client/);
});
