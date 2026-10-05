import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertPlatformPrerequisites, lessonPaths, brokerMacos11 } from '../scripts/lesson.mjs';
import { prepareStarterServicesRoot } from '../src/services-root.js';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'lesson-profiles-'));
  const config = { ...lessonPaths('01'), servicesRoot: path.join(root, 'services') };
  try { await run(config, root); } finally { await rm(root, { recursive: true, force: true }); }
}
const intel11 = { platform: 'darwin', arch: 'x64', macosVersion: '11.7.11' };

test('LESSON-2/6: fresh Intel 11 seeds exact qualified Broker profile without replacing retained bytes', () => fixture(async config => {
  await assertPlatformPrerequisites(config, intel11);
  const profile = config.seedFileOverrides[path.join('@secretsbroker', 'service.json')];
  await prepareStarterServicesRoot(config);
  const target = path.join(config.servicesRoot, '@secretsbroker', 'service.json');
  assert.deepEqual(await readFile(target), await readFile(profile));
  await writeFile(path.join(config.servicesRoot, '@secretsbroker', 'private'), 'retained fixture');
  await assertPlatformPrerequisites(config, intel11);
  await prepareStarterServicesRoot(config);
  assert.deepEqual(await readFile(target), await readFile(profile));
  assert.equal(await readFile(path.join(config.servicesRoot, '@secretsbroker', 'private'), 'utf8'), 'retained fixture');
}));

test('LESSON-2/6: ARM uses default profile on 12 and rejects 11 before writes', () => fixture(async config => {
  await assert.rejects(assertPlatformPrerequisites(config, { ...intel11, arch: 'arm64' }), /Broker stack.*macOS 12/);
  await assert.doesNotReject(assertPlatformPrerequisites(config, { ...intel11, arch: 'arm64', macosVersion: '12.0' }));
  assert.equal(config.seedFileOverrides, undefined);
  await prepareStarterServicesRoot(config);
  const broker = JSON.parse(await readFile(path.join(config.servicesRoot, '@secretsbroker', 'service.json')));
  assert.equal(broker.artifact.source.tag, brokerMacos11.tag);
  assert.equal(broker.artifact.platforms.darwin.assetName, 'secretsbroker-darwin.tar.gz');
}));

test('LESSON-2/6: retained legacy Broker and Node 24 remain guarded and unchanged', () => fixture(async config => {
  await mkdir(path.join(config.servicesRoot, '@secretsbroker'), { recursive: true });
  const filename = path.join(config.servicesRoot, '@secretsbroker', 'service.json');
  const bytes = Buffer.from('{"id":"@secretsbroker","artifact":{"source":{"tag":"2026.8.31-f340883"}}}');
  await writeFile(filename, bytes);
  await assert.rejects(assertPlatformPrerequisites(config, intel11), /Broker stack.*macOS 12/);
  assert.deepEqual(await readFile(filename), bytes);
  await mkdir(path.join(config.servicesRoot, '@node'));
  await writeFile(path.join(config.servicesRoot, '@node', 'service.json'), '{"version":"v24.15.0"}');
  await assert.rejects(assertPlatformPrerequisites(config, { ...intel11, macosVersion: '13.4.1' }), /Retained managed Node.*13.5/);
  await assert.doesNotReject(assertPlatformPrerequisites(config, { ...intel11, macosVersion: '13.5' }));
  assert.deepEqual(await readFile(filename), bytes);
}));

test('LESSON-2/6: unknown CPU, unsupported OS, missing profile and legacy identity reject before writes', () => fixture(async (config, root) => {
  for (const options of [{ ...intel11, arch: 'unknown' }, { ...intel11, macosVersion: '10.15' }, { ...intel11, macosVersion: 'unknown' }])
    await assert.rejects(assertPlatformPrerequisites(config, options));
  await assert.rejects(assertPlatformPrerequisites({ ...config, repoRoot: root }, intel11), { code: 'ENOENT' });
  await assert.rejects(assertPlatformPrerequisites({ ...lessonPaths('04'), servicesRoot: config.servicesRoot }, intel11), /Zitadel profile.*macOS 12/);
  assert.deepEqual(await readdir(root), []);
}));

test('LESSON-2/6: linked override source fails complete preflight before destination writes', () => fixture(async (config, root) => {
  await mkdir(path.join(root, 'outside'));
  await writeFile(path.join(root, 'outside', 'profile.json'), '{}');
  await symlink(path.join(root, 'outside'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  config.seedFileOverrides = { [path.join('@secretsbroker', 'service.json')]: path.join(root, 'linked', 'profile.json') };
  await assert.rejects(prepareStarterServicesRoot(config), /qualified source/);
  await assert.rejects(readFile(path.join(config.servicesRoot, '@secretsbroker', 'service.json')), { code: 'ENOENT' });
}));

test('LESSON-2/6: plain external, aliased and unqualified profile overrides reject before any writes', () => fixture(async (config, root) => {
  const outside = path.join(root, 'external.json');
  await writeFile(outside, '{}');
  const sources = [outside, path.join(root, '..', path.basename(root), 'external.json'),
    path.join(config.repoRoot, 'profiles', 'broker', '..', 'unqualified.json')];
  for (const source of sources) {
    await assert.rejects(prepareStarterServicesRoot({ ...config, seedFileOverrides: { [path.join('@secretsbroker', 'service.json')]: source } }), /qualified source/);
    await assert.rejects(readdir(config.servicesRoot), { code: 'ENOENT' });
  }
  await assertPlatformPrerequisites(config, intel11);
  const approved = config.seedFileOverrides[path.join('@secretsbroker', 'service.json')];
  await assert.rejects(prepareStarterServicesRoot({ ...config, seedFileOverrides: { [path.join('todo', 'service.json')]: approved } }), /qualified source/);
  await assert.rejects(readdir(config.servicesRoot), { code: 'ENOENT' });
}));

test('LESSON-2/6: altered compatibility profile rejects before creating services', () => fixture(async (config, root) => {
  const directory = path.join(root, 'profiles', 'broker');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'service-darwin-amd64-macos11.json'), '{}');
  await assert.rejects(assertPlatformPrerequisites({ ...config, repoRoot: root }, intel11), /checksum mismatch/);
  await assert.rejects(readFile(path.join(config.servicesRoot, '@secretsbroker', 'service.json')), { code: 'ENOENT' });
}));

test('LESSON-2/6: retained Intel-only profile rejects ARM without replacing it', () => fixture(async config => {
  await assertPlatformPrerequisites(config, intel11);
  await prepareStarterServicesRoot(config);
  const filename = path.join(config.servicesRoot, '@secretsbroker', 'service.json');
  const before = await readFile(filename);
  await assert.rejects(assertPlatformPrerequisites({ ...config, seedFileOverrides: undefined }, { ...intel11, arch: 'arm64', macosVersion: '12.0' }), /requires x64/);
  assert.deepEqual(await readFile(filename), before);
}));
