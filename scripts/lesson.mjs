import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, lstat, realpath } from 'node:fs/promises';
import { prepareAdmin } from './prepare-admin.mjs';
import { prepareStarterServicesRoot } from '../src/services-root.js';

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
export async function prepareLesson(selector) {
  const config = lessonPaths(selector);
  await assertOwnedTree(config.servicesRoot);
  await assertOwnedTree(config.workspaceRoot);
  await assertOwnedTree(config.registryPath);
  await assertOwnedTree(config.portRegistryPath);
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
