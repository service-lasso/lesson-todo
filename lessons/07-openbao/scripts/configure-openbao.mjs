// Write the lesson's OpenBao source registry into an owned Broker service root.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sourcePath = path.join(repoRoot, 'lessons', '07-openbao', 'secrets-sources.json');
const servicesRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, '.workspace', '07-openbao', 'services'));
const force = process.argv.includes('--force');

if (!servicesRoot.startsWith(repoRoot + path.sep)) {
  throw new Error('Services root must stay inside the lesson repository.');
}

const source = await readFile(sourcePath, 'utf8');
const target = path.join(servicesRoot, '@secretsbroker', 'config', 'secrets-sources.json');

await mkdir(path.dirname(target), { recursive: true });
try {
  const existing = await readFile(target, 'utf8');
  if (existing !== source && !force) {
    throw new Error(`OpenBao source registry already exists at ${target}. Re-run with --force to replace it.`);
  }
  if (existing === source) {
    console.log(`OpenBao source registry already current at ${target}.`);
    process.exit(0);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await writeFile(target, source, { encoding: 'utf8', mode: 0o600 });
console.log(`Wrote OpenBao source registry to ${target}. Restart the Broker to load it.`);
