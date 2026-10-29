import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin/ars.mjs');
const read = file => fs.existsSync(file) ? fs.readFileSync(file) : null;

test('trial exercises publishing, conflicts and recovery without modifying local manifest or real receipt', () => {
  const files = [path.join(root, 'agent-resources.local.json'), path.join(os.homedir(), '.agent-shared-resources/state.json')];
  const before = files.map(read);
  const result = spawnSync(process.execPath, [cli, 'trial'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 8);
  assert(report.checks.every(check => check.ok));
  assert.equal(report.sandboxRemoved, true);
  assert.equal(report.realClientFilesChanged, false);
  assert.equal(report.modelOrAccountCalls, false);
  assert(!result.stdout.includes(os.homedir()));
  assert(!result.stdout.includes(root));
  assert(!result.stdout.includes('user-changed-theme'));
  files.forEach((file, index) => assert.deepEqual(read(file), before[index]));
});

test('trial rejects a home override instead of touching that directory', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-untouched-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  fs.writeFileSync(path.join(directory, 'sentinel'), 'unchanged');
  const result = spawnSync(process.execPath, [cli, 'trial', '--home', directory], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /trial accepts no flags/);
  assert.deepEqual(fs.readdirSync(directory), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(directory, 'sentinel'), 'utf8'), 'unchanged');
});
