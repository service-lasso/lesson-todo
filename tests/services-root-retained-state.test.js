import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readlink, lstat, symlink, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { prepareStarterServicesRoot } from '../src/services-root.js';

const linkType = process.platform === 'win32' ? 'junction' : 'dir';
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'lesson-acquired-state-'));
  const sourceServicesRoot = path.join(root, 'source');
  const servicesRoot = path.join(root, 'owned');
  const outside = path.join(root, 'outside');
  try {
    await mkdir(path.join(sourceServicesRoot, 'todo'), { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(sourceServicesRoot, 'todo', 'service.json'), 'seed manifest');
    await run({ root, outside, sourceServicesRoot, servicesRoot });
  } finally { await rm(root, { recursive: true, force: true }); }
}

// LESSON-2/3/6, #5: Core-managed producer links are retained custody, not seed writes.
test('setup reruns preserve acquired links, artifact bytes, changed manifest, credential and data', () => fixture(async config => {
  await prepareStarterServicesRoot(config);
  const service = path.join(config.servicesRoot, 'todo');
  const extracted = path.join(service, '.state', 'extracted', 'current');
  await mkdir(extracted, { recursive: true });
  const link = path.join(extracted, 'producer-link');
  await symlink(config.outside, link, linkType);
  const originalLink = await readlink(link);
  const retained = new Map([
    [path.join(service, 'service.json'), Buffer.from('retained configured manifest')],
    [path.join(service, 'private-credential'), Buffer.from('private fixture')],
    [path.join(service, 'database'), Buffer.from([0, 255, 1, 13])],
    [path.join(extracted, 'artifact'), Buffer.from([0, 234, 19])],
    [path.join(config.outside, 'untouched'), Buffer.from('outside fixture')],
  ]);
  for (const [file, bytes] of retained) await writeFile(file, bytes);
  await writeFile(path.join(config.sourceServicesRoot, 'todo', 'new-seed-file'), 'added seed');
  for (let rerun = 0; rerun < 2; rerun++) await prepareStarterServicesRoot(config);
  assert.equal(await readFile(path.join(service, 'new-seed-file'), 'utf8'), 'added seed');
  assert.ok((await lstat(link)).isSymbolicLink());
  assert.equal(await readlink(link), originalLink);
  for (const [file, bytes] of retained) assert.deepEqual(await readFile(file), bytes);
}));

test('seed link rejects preparation before any destination writes', () => fixture(async config => {
  await symlink(config.outside, path.join(config.sourceServicesRoot, 'todo', 'escape'), linkType);
  await assert.rejects(prepareStarterServicesRoot(config), /links/);
  await assert.rejects(lstat(config.servicesRoot), { code: 'ENOENT' });
  assert.deepEqual(await readdir(config.outside), []);
}));

test('a POSIX host alias above the shared preparation anchor is accepted', { skip: process.platform === 'win32' }, () => fixture(async config => {
  const alias = path.join(config.root, 'host-alias');
  await mkdir(path.join(config.outside, 'owned-anchor', 'source', 'todo'), { recursive: true });
  await writeFile(path.join(config.outside, 'owned-anchor', 'source', 'todo', 'service.json'), 'seed');
  await symlink(config.outside, alias, linkType);
  const anchor = path.join(alias, 'owned-anchor');
  await prepareStarterServicesRoot({ sourceServicesRoot: path.join(anchor, 'source'), servicesRoot: path.join(anchor, 'destination') });
  assert.equal(await readFile(path.join(anchor, 'destination', 'todo', 'service.json'), 'utf8'), 'seed');
}));

test('a linked seed ancestor inside the preparation anchor is rejected', () => fixture(async config => {
  await mkdir(path.join(config.outside, 'seed'));
  await writeFile(path.join(config.outside, 'seed', 'service.json'), 'retained');
  const linkedParent = path.join(config.root, 'linked-parent');
  await symlink(config.outside, linkedParent, linkType);
  await assert.rejects(prepareStarterServicesRoot({ ...config, sourceServicesRoot: path.join(linkedParent, 'seed') }), /links/);
  await assert.rejects(lstat(config.servicesRoot), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(config.outside, 'seed', 'service.json'), 'utf8'), 'retained');
}));

test('retains a dangling producer file symlink below acquired state on POSIX', { skip: process.platform === 'win32' }, () => fixture(async config => {
  await prepareStarterServicesRoot(config);
  const bin = path.join(config.servicesRoot, 'todo', '.state', 'extracted', 'current', 'bin');
  await mkdir(bin, { recursive: true });
  const link = path.join(bin, 'corepack');
  const target = '/Users/runner/work/release/lib/node_modules/corepack/dist/corepack.js';
  await symlink(target, link);
  await prepareStarterServicesRoot(config);
  assert.ok((await lstat(link)).isSymbolicLink());
  assert.equal(await readlink(link), target);
}));

for (const scenario of ['service directory', 'state custody directory', 'destination ancestor', 'seed path inside state']) {
  test(`rejects linked ${scenario} before writes and preserves escape target`, () => fixture(async config => {
    const todo = path.join(config.servicesRoot, 'todo');
    if (scenario === 'destination ancestor') {
      await symlink(config.outside, config.servicesRoot, linkType);
    } else {
      await mkdir(todo, { recursive: true });
      if (scenario === 'service directory') {
        const linked = path.join(config.servicesRoot, 'linked-service');
        await mkdir(path.join(config.sourceServicesRoot, 'linked-service'));
        await writeFile(path.join(config.sourceServicesRoot, 'linked-service', 'service.json'), 'must not escape');
        await symlink(config.outside, linked, linkType);
      } else if (scenario === 'state custody directory') {
        await symlink(config.outside, path.join(todo, '.state'), linkType);
      } else {
        await mkdir(path.join(todo, '.state'));
        await symlink(config.outside, path.join(todo, '.state', 'escape'), linkType);
        await mkdir(path.join(config.sourceServicesRoot, 'todo', '.state', 'escape'), { recursive: true });
        await writeFile(path.join(config.sourceServicesRoot, 'todo', '.state', 'escape', 'seed'), 'must not escape');
      }
    }
    await writeFile(path.join(config.outside, 'retained'), 'unchanged');
    await assert.rejects(prepareStarterServicesRoot(config), /links/);
    assert.deepEqual(await readdir(config.outside), ['retained']);
    assert.equal(await readFile(path.join(config.outside, 'retained'), 'utf8'), 'unchanged');
    await assert.rejects(lstat(path.join(todo, 'service.json')), { code: 'ENOENT' });
  }));
}
