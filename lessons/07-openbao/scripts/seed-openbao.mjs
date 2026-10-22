// Seed the synthetic lesson value into OpenBao KV v2 without printing the value.
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = new URL(process.env.BAO_ADDR ?? 'https://127.0.0.1:18200');
const token = process.env.BAO_TOKEN ?? 'lesson-root';
const value = process.env.OPENBAO_LESSON_VALUE ?? 'openbao-lesson-secret';
const caPath = process.env.BAO_CACERT ?? path.join(repoRoot, '.workspace', '07-openbao', 'services', '@openbao', 'runtime', 'tls', 'vault-ca.pem');

if (!['http:', 'https:'].includes(base.protocol)) throw new Error('OpenBao address must use http or https.');
if (base.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Plaintext OpenBao HTTP is allowed only for loopback lesson hosts.');
}
if (base.protocol === 'https:' && !caPath) {
  throw new Error('Set BAO_CACERT to the generated OpenBao CA file for the TLS lesson source.');
}
const ca = caPath ? readFileSync(caPath) : undefined;

function vaultRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const transport = base.protocol === 'https:' ? https : http;
    const request = transport.request({
      method,
      hostname: base.hostname,
      port: base.port,
      path,
      ca,
      rejectUnauthorized: true,
      headers: {
        'X-Vault-Token': token,
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }),
      },
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    request.on('error', reject);
    if (payload !== undefined) request.write(payload);
    request.end();
  });
}

const secretPath = '/v1/secret/data/todo/demo';
const write = await vaultRequest('POST', secretPath, { data: { value } });
if (write.status < 200 || write.status >= 300) throw new Error(`OpenBao write failed with HTTP ${write.status}.`);

const read = await vaultRequest('GET', secretPath);
if (read.status < 200 || read.status >= 300) throw new Error(`OpenBao read failed with HTTP ${read.status}.`);
const payload = JSON.parse(read.text);
if (payload?.data?.data?.value !== value) throw new Error('OpenBao did not return the seeded lesson value.');

console.log('Seeded and verified secret/data/todo/demo in OpenBao (value not printed).');
