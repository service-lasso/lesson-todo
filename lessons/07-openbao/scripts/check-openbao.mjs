// Prove Echo received the OpenBao-backed Broker value without printing it.
const rawOrigin = process.argv[2] ?? process.env.OPENBAO_CHECK_ORIGIN;
if (!rawOrigin) throw new Error('Pass the Echo Service HTTP origin or set OPENBAO_CHECK_ORIGIN.');

const origin = new URL(rawOrigin);
if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) {
  throw new Error('Use the loopback Echo HTTP origin printed by Service Admin.');
}
const expected = process.env.OPENBAO_LESSON_VALUE ?? 'openbao-lesson-secret';
const response = await fetch(new URL('/env', origin), { redirect: 'error' });
if (!response.ok) throw new Error(`Echo /env returned HTTP ${response.status}.`);
const payload = await response.json();
if (payload?.env?.ECHO_OPENBAO_SECRET !== expected) {
  throw new Error('Echo did not receive the expected OpenBao-backed Broker value. Check the Broker source and restart the check service.');
}

console.log(JSON.stringify({
  outcome: 'ready',
  ref: 'todo/openbao/openbao.DEMO_VALUE',
  source: 'openbao',
  matched: true,
}));
