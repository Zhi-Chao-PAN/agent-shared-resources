import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Manager, CONFIG} from './manager.mjs';

/** Exercise the real publisher against disposable fixtures, never a client home. */
export function runTrial() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-trial-'));
  const sandbox = fs.realpathSync(temporary);
  const root = path.join(sandbox, 'repository');
  const home = path.join(sandbox, 'home');
  const checks = [];
  let stage = 'prepare';
  const verify = (id, condition) => {
    if (!condition) throw new Error(id);
    checks.push({id, ok: true});
  };
  try {
    for (const dir of [root, home, path.join(root, 'catalog'), path.join(root, 'skills/trial-skill'), path.join(home, '.qoder-cn')]) {
      fs.mkdirSync(dir, {recursive: true});
    }
    const skill = '---\nname: trial-skill\ndescription: Disposable trial fixture; no tools or credentials.\n---\nReview the sample only.\n';
    fs.writeFileSync(path.join(root, 'skills/trial-skill/SKILL.md'), skill);
    for (const name of ['skills', 'mcp']) fs.writeFileSync(path.join(root, 'catalog', name + '.json'), '{}');
    fs.writeFileSync(path.join(root, CONFIG), JSON.stringify({
      version: 1,
      clients: {'qoder-cn': {skills: ['trial-skill'], mcp: ['trial-server']}},
      skills: {'trial-skill': 'skills/trial-skill'},
      servers: {'trial-server': {command: 'not-executed', args: []}},
      runtime: {},
    }));
    const settings = path.join(home, '.qoder-cn/settings.json');
    const publishedSkill = path.join(home, '.qoder-cn/skills/trial-skill/SKILL.md');
    const original = JSON.stringify({theme: 'keep-me', mcpServers: {personal: {command: 'also-not-executed', args: []}}});
    fs.writeFileSync(settings, original);
    const manager = () => new Manager({root, home});
    const scope = {client: 'qoder-cn'};

    stage = 'preview';
    const plan = manager().plan(scope);
    verify('preview-is-read-only', plan.changes === 2 && fs.readFileSync(settings, 'utf8') === original && !fs.existsSync(publishedSkill));
    stage = 'publish';
    manager().apply(scope);
    verify('publish-and-doctor', manager().doctor(scope).ok && fs.readFileSync(publishedSkill, 'utf8') === skill);
    verify('repeat-apply-is-idempotent', manager().apply(scope).changes === 0);

    stage = 'conflict';
    fs.appendFileSync(publishedSkill, '\nA user edit that must survive.\n');
    const beforeConflict = fs.readFileSync(settings, 'utf8');
    let refused = false;
    try { manager().rollback(scope); } catch { refused = true; }
    verify('private-edit-blocks-rollback', refused && fs.readFileSync(settings, 'utf8') === beforeConflict && fs.readFileSync(publishedSkill, 'utf8').includes('must survive'));
    // Restore only our disposable fixture to demonstrate an unmodified rollback.
    fs.writeFileSync(publishedSkill, skill);
    const edited = JSON.parse(beforeConflict);
    edited.theme = 'user-changed-theme';
    fs.writeFileSync(settings, JSON.stringify(edited));
    stage = 'rollback';
    manager().rollback(scope);
    const afterRollback = JSON.parse(fs.readFileSync(settings, 'utf8'));
    verify('rollback-preserves-unmanaged-settings', !fs.existsSync(publishedSkill) && afterRollback.theme === 'user-changed-theme' && afterRollback.mcpServers.personal.command === 'also-not-executed' && !afterRollback.mcpServers['trial-server']);

    stage = 'interruption';
    const interrupted = manager();
    const perform = interrupted.perform.bind(interrupted);
    let operations = 0;
    interrupted.perform = (...args) => {
      if (++operations === 2) throw new Error('Disposable trial interruption');
      return perform(...args);
    };
    let stopped = false;
    try { interrupted.apply(scope); } catch { stopped = true; }
    verify('interrupted-work-is-recorded', stopped && manager().state().state.pending !== null);
    stage = 'recovery';
    manager().recover();
    verify('recover-finishes-the-recorded-transaction', manager().doctor(scope).ok && manager().recover().changes === 0);
    manager().rollback(scope);
    verify('final-rollback-removes-owned-resources', !fs.existsSync(publishedSkill) && !JSON.parse(fs.readFileSync(settings, 'utf8')).mcpServers['trial-server']);
  } catch {
    // A shareable report contains no paths, account data, manifest or raw errors.
    checks.push({id: stage, ok: false});
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
  return {
    ok: checks.length === 8 && checks.every(check => check.ok),
    mode: 'isolated-fixtures',
    platform: process.platform,
    nodeMajor: Number(process.versions.node.split('.')[0]),
    realClientFilesChanged: false,
    modelOrAccountCalls: false,
    sandboxRemoved: !fs.existsSync(temporary),
    checks,
    next: 'Read docs/trial.md before choosing a real client. This checks file publication, not client discovery or model invocation.',
  };
}
