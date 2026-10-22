// Write the lesson's TLS OpenBao source and pin its generated CA into Broker.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sourcePath = path.join(repoRoot, 'lessons', '07-openbao', 'secrets-sources.json');
const servicesRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, '.workspace', '07-openbao', 'services'));
const force = process.argv.includes('--force');
const addressIndex = process.argv.indexOf('--address');
const address = addressIndex >= 0 ? process.argv[addressIndex + 1] : 'https://127.0.0.1:18200';
const caIndex = process.argv.indexOf('--ca');
const caPath = path.resolve(caIndex >= 0
  ? process.argv[caIndex + 1]
  : path.join(servicesRoot, '@openbao', 'runtime', 'tls', 'vault-ca.pem'));

if (!servicesRoot.startsWith(repoRoot + path.sep)) {
  throw new Error('Services root must stay inside the lesson repository.');
}
if (!/^https:\/\/127\.0\.0\.1:\d+$/.test(address)) {
  throw new Error('OpenBao address must be a loopback HTTPS origin.');
}

const caBytes = await readFile(caPath);
const caPin = `sha256:${createHash('sha256').update(caBytes).digest('hex')}`;
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
source.sources[0].address = address;

const sourceTarget = path.join(servicesRoot, '@secretsbroker', 'config', 'secrets-sources.json');
await mkdir(path.dirname(sourceTarget), { recursive: true });
let currentSource = '';
try { currentSource = await readFile(sourceTarget, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const nextSource = `${JSON.stringify(source, null, 2)}\n`;
if (currentSource && currentSource !== nextSource && !force) {
  throw new Error(`OpenBao source registry already exists at ${sourceTarget}. Re-run with --force to replace it.`);
}
if (currentSource !== nextSource) await writeFile(sourceTarget, nextSource, { encoding: 'utf8', mode: 0o600 });

const brokerPath = path.join(servicesRoot, '@secretsbroker', 'service.json');
const broker = JSON.parse(await readFile(brokerPath, 'utf8'));
broker.env = broker.env ?? {};
broker.env.SECRETSBROKER_SOURCE_CA_FILE = caPath;
broker.env.SECRETSBROKER_SOURCE_CA_SHA256 = caPin;
await writeFile(brokerPath, `${JSON.stringify(broker, null, 2)}\n`, 'utf8');

console.log(`Configured TLS OpenBao source at ${address}.`);
console.log(`Pinned Broker source CA ${caPin}. Restart the Broker to load it.`);
