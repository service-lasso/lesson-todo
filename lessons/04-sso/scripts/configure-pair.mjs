import { readFile, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { lessonPaths, assertOwnedTree } from '../../../scripts/lesson.mjs';
const [helper, mode, ...args] = process.argv.slice(2);
if (!helper || !['enable', 'disable'].includes(mode)) throw Error('Use acquired configure-sso.mjs path, enable/disable and its arguments; stop Todo/API first.');
const config = lessonPaths('04'); await assertOwnedTree(config.servicesRoot);
// This is the helper from Todo's checksum-verified acquired release, not a copied producer implementation.
await access(path.resolve(helper));
if (createHash('sha256').update(await readFile(path.resolve(helper))).digest('hex') !== '0c23c024409d8da53ff37c66b8d900a6c7c51e15274de3ca57b7a56d482e1b84') throw Error('Use the exact paired helper from Todo 2026.10.4-15dc4b9; nothing changed.');
execFileSync(process.execPath, [path.resolve(helper), path.join(config.servicesRoot, 'todo'), mode, ...args], { stdio: 'inherit' });
if (mode === 'enable') {
  const files = ['todo', 'todo-api'].map(id => path.join(config.servicesRoot, id, 'service.json'));
  const manifests = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
  const web = manifests[0].env, api = manifests[1].env;
  if (api.TODO_API_AUTH_MODE !== 'zitadel' || !api.TODO_API_CLIENT_SECRET_FILE || !api.TODO_API_CA_FILE ||
    ['TODO_OIDC_ISSUER', 'TODO_OIDC_CLIENT_ID', 'TODO_OIDC_AUDIENCE'].some(key => !web[key] || api[key] !== web[key])) throw Error('Partial pair stays disabled. Supply all helper arguments, including CA path.');
  for (let n = 0; n < 2; n++) { manifests[n].enabled = true; await writeFile(files[n], JSON.stringify(manifests[n], null, 2) + '\n'); }
} else {
  for (const id of ['todo', 'todo-api']) {
    const file = path.join(config.servicesRoot, id, 'service.json'), manifest = JSON.parse(await readFile(file, 'utf8'));
    manifest.enabled = false;
    if (id === 'todo') manifest.env.TODO_OIDC_ISSUER = 'https://localhost:18084';
    else manifest.env.TODO_API_AUTH_MODE = 'zitadel';
    await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
  }
}
