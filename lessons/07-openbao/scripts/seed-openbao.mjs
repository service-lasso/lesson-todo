// Seed the synthetic lesson value into OpenBao KV v2 without printing the value.
const base = new URL(process.env.BAO_ADDR ?? 'http://127.0.0.1:18200');
const token = process.env.BAO_TOKEN ?? 'lesson-root';
const value = process.env.OPENBAO_LESSON_VALUE ?? 'openbao-lesson-secret';

if (!['http:', 'https:'].includes(base.protocol)) throw new Error('OpenBao address must use http or https.');
if (base.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Plaintext OpenBao HTTP is allowed only for loopback lesson hosts.');
}

const path = '/v1/secret/data/todo/demo';
const headers = { 'X-Vault-Token': token, 'Content-Type': 'application/json' };
const write = await fetch(new URL(path, base), {
  method: 'POST',
  headers,
  body: JSON.stringify({ data: { value } }),
  redirect: 'error',
});
if (!write.ok) throw new Error(`OpenBao write failed with HTTP ${write.status}.`);

const read = await fetch(new URL(path, base), { headers, redirect: 'error' });
if (!read.ok) throw new Error(`OpenBao read failed with HTTP ${read.status}.`);
const payload = await read.json();
if (payload?.data?.data?.value !== value) throw new Error('OpenBao did not return the seeded lesson value.');

console.log('Seeded and verified secret/data/todo/demo in OpenBao (value not printed).');
