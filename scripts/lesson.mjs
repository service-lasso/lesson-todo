import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, lstat, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { prepareAdmin } from './prepare-admin.mjs';
import { prepareStarterServicesRoot, preflightStarterServicesRoot } from '../src/services-root.js';
import { zitadelMacos11, isQualifiedIntelIdentity } from '../src/qualified-zitadel.js';
export { zitadelMacos11 };

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const lessons = ['01-app', '02-database', '03-api', '04-sso', '05-desktop'];
export function lessonPaths(selector, root = repoRoot) {
  const id = lessons.find(id => id === selector || id.slice(0, 2) === selector?.replace(/^--/, ''));
  if (!id) throw Error('Select 01, 02, 03, 04 or 05 explicitly.');
  const base = path.join(root, '.workspace', id);
  return { id, repoRoot: root, sourceServicesRoot: path.join(root, 'lessons', id, 'services'),
    servicesRoot: path.join(base, 'services'), workspaceRoot: path.join(base, 'runtime'),
    registryPath: path.join(base, 'registries', 'instances.json'), portRegistryPath: path.join(base, 'registries', 'ports.json'), adminDistRoot: path.join(root, '.payload', 'admin') };
}
export async function assertOwnedTree(target, root = repoRoot) {
  if (!path.resolve(target).startsWith(path.resolve(root) + path.sep)) throw Error('Path outside lesson repository.');
  let current = path.resolve(target);
  while (current !== path.resolve(root)) {
    try { const entry = await lstat(current); if (entry.isSymbolicLink() || path.resolve(await realpath(current)) !== current) throw Error('Lesson state must not traverse a link or junction.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    current = path.dirname(current);
  }
}
export const brokerMacos11 = {
  tag: '2026.10.5-301b426',
  asset: 'secretsbroker-darwin-amd64-macos11.tar.gz',
  profileSha256: 'dd6fbd9fb9747b34b49ad9ab09e1c8bd29f10d2cb4df91e58e4d9b146f036ada'
};
export async function assertPlatformPrerequisites(config, { platform = process.platform, arch = process.arch, macosVersion } = {}) {
  if (platform !== 'darwin') return;
  const version = macosVersion ?? execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(version)) throw Error('Cannot determine macOS version.');
  const [major, minor] = version.split('.').map(Number);
  if (!['x64', 'arm64'].includes(arch)) throw Error('Unsupported macOS CPU architecture.');
  if (major < 11) throw Error('Managed lessons require macOS 11 or newer.');
  const selected = async id => {
    try { return JSON.parse(await readFile(path.join(config.servicesRoot, id, 'service.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (config.sourceServicesRoot) {
      try { return JSON.parse(await readFile(path.join(config.sourceServicesRoot, id, 'service.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  };
  const node = await selected('@node');
  if (/^v?24\./.test(node?.version ?? '') && (major < 13 || (major === 13 && minor < 5)))
    throw Error(`Retained managed Node ${node.version} requires macOS 13.5 or newer. Setup preserves its manifest and acquired bytes; use a fresh checkpoint for Node 22.`);
  let broker = await selected('@secretsbroker');
  let retainedBroker = false;
  try { await lstat(path.join(config.servicesRoot, '@secretsbroker', 'service.json')); retainedBroker = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!retainedBroker && arch === 'x64' && broker?.artifact?.source?.tag === brokerMacos11.tag) {
    const profile = path.join(config.repoRoot ?? repoRoot, 'profiles', 'broker', 'service-darwin-amd64-macos11.json');
    const bytes = await readFile(profile);
    if (createHash('sha256').update(bytes).digest('hex') !== brokerMacos11.profileSha256) throw Error('Broker platform profile checksum mismatch.');
    broker = JSON.parse(bytes);
    config.seedFileOverrides = { ...config.seedFileOverrides, [path.join('@secretsbroker', 'service.json')]: profile };
  }
  const compatibleBroker = broker?.artifact?.source?.repo === 'service-lasso/lasso-secretsbroker' &&
    broker.artifact.source.tag === brokerMacos11.tag && broker.artifact.platforms?.darwin?.assetName === brokerMacos11.asset;
  if (compatibleBroker && arch !== 'x64') throw Error('Intel macOS Broker profile requires x64; retained profile is preserved.');
  if (major < 12 && !compatibleBroker) throw Error('Broker stack requires macOS 12 or a qualified Intel macOS 11 profile. Lesson state is retained.');
  let identity = await selected('zitadel');
  let retainedIdentity = false;
  try { await lstat(path.join(config.servicesRoot, 'zitadel', 'service.json')); retainedIdentity = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!retainedIdentity && arch === 'x64' && identity?.artifact?.source?.repo === 'service-lasso/lasso-zitadel' && identity.artifact.source.tag === zitadelMacos11.tag) {
    const profile = path.join(config.repoRoot ?? repoRoot, 'profiles', 'zitadel', 'service-darwin-amd64-macos11.json');
    const bytes = await readFile(profile);
    if (createHash('sha256').update(bytes).digest('hex') !== zitadelMacos11.profileSha256) throw Error('Zitadel platform profile checksum mismatch.');
    identity = JSON.parse(bytes);
    identity.artifact.platforms.darwin.checksum = { algorithm: 'sha256', value: zitadelMacos11.archiveSha256 };
    config.seedFileOverrides = { ...config.seedFileOverrides, [path.join('zitadel', 'service.json')]: profile };
  }
  const compatibleIdentity = isQualifiedIntelIdentity(identity);
  if (identity?.artifact?.platforms?.darwin?.assetName === zitadelMacos11.asset && arch !== 'x64') throw Error('Intel macOS Zitadel profile requires x64; retained profile is preserved.');
  if (major < 12 && identity && (!compatibleIdentity || !compatibleBroker)) throw Error('Selected Zitadel profile requires macOS 12 or qualified Intel macOS 11 identity and Broker profiles. Lesson state is retained.');
}
export async function prepareLesson(selector, platformOptions) {
  const config = lessonPaths(selector);
  await assertOwnedTree(config.servicesRoot);
  await assertOwnedTree(config.workspaceRoot);
  await assertOwnedTree(config.registryPath);
  await assertOwnedTree(config.portRegistryPath);
  await assertPlatformPrerequisites(config, platformOptions);
  await preflightStarterServicesRoot(config);
  await prepareAdmin();
  await mkdir(path.dirname(config.registryPath), { recursive: true });
  await prepareStarterServicesRoot(config);
  return config;
}
export async function assertPairedSso(config) {
  const read = async id => JSON.parse(await readFile(path.join(config.servicesRoot, id, 'service.json'), 'utf8'));
  const todo = await read('todo'), api = await read('todo-api');
  const web = todo.env ?? {}, backend = api.env ?? {};
  const keys = ['TODO_OIDC_ISSUER', 'TODO_OIDC_CLIENT_ID', 'TODO_OIDC_AUDIENCE'];
  if (todo.enabled === false || api.enabled === false || backend.TODO_API_AUTH_MODE !== 'zitadel' ||
    keys.some(key => !web[key]) || !backend.TODO_API_CLIENT_ID || !backend.TODO_API_CLIENT_SECRET_FILE || !backend.TODO_API_CA_FILE ||
    backend.TODO_OIDC_ISSUER !== web.TODO_OIDC_ISSUER || backend.TODO_OIDC_CLIENT_ID !== web.TODO_OIDC_CLIENT_ID || backend.TODO_OIDC_AUDIENCE !== web.TODO_OIDC_AUDIENCE)
    throw Error('SSO checkpoint is not paired. Follow lessons/04-sso/README.md; use --management for identity setup.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, selector, ...options] = process.argv.slice(2);
  const config = await prepareLesson(selector);
  if (command === 'setup') console.log(`Prepared ${config.id}; existing manifests and state retained. Run npm run lesson:${config.id.slice(0,2)}.`);
  else if (command === 'run') {
    if (config.id === '04-sso' && !options.includes('--management')) await assertPairedSso(config);
    process.env.SERVICE_LASSO_INSTANCE_REGISTRY_PATH = config.registryPath;
    process.env.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH = config.portRegistryPath;
    const { runLessonHost } = await import('../src/lesson-host.mjs');
    await runLessonHost(config, { management: options.includes('--management') });
  } else throw Error('Use setup or run.');
}
