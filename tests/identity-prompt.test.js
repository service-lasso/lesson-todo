import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readPrivatePassword } from '../lessons/04-sso/scripts/provision-identity-prompt.mjs';

function terminal() {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, isRaw: false, setRawMode(value) { this.isRaw = value; }, resume() {}, pause() {} });
  const writes = [];
  return { input, writes, output: { write(value) { writes.push(value); } } };
}

test('LESSON-4: private terminal input is hidden, editable and restores terminal mode', async () => {
  const { input, writes, output } = terminal();
  const result = readPrivatePassword(input, output);
  input.emit('data', Buffer.from('Secret1!wrong\u007f\u007f\u007f\u007f\u007fValid\r'));
  assert.equal(await result, 'Secret1!Valid');
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.ok(writes.every(value => !value.includes('Secret1!')));
});

test('LESSON-4: abort restores the terminal and rejects private input', async () => {
  const { input, output } = terminal();
  const result = readPrivatePassword(input, output);
  input.emit('data', Buffer.from('Secret1!\u0003'));
  await assert.rejects(result, /cancelled/);
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
});

test('LESSON-4: noninteractive input cannot silently echo a secret', () => {
  assert.throws(() => readPrivatePassword({ isTTY: false }), /interactive terminal/);
});

test('LESSON-4: split UTF-8 input preserves characters and deletes complete code points', async () => {
  const { input, writes, output } = terminal();
  const result = readPrivatePassword(input, output);
  const bytes = Buffer.from('Example1!é🙂\b漢\u007f🙂\r');
  for (const byte of bytes) input.emit('data', Buffer.from([byte]));
  assert.equal(await result, 'Example1!é🙂');
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
  assert.ok(writes.every(value => !value.includes('Example1!')));
});

test('LESSON-4: multibyte input enforces the byte bound and restores an already raw terminal', async () => {
  const { input, output } = terminal();
  input.isRaw = true;
  const result = readPrivatePassword(input, output);
  input.emit('data', Buffer.from('é'.repeat(257)));
  await assert.rejects(result, /too large/);
  assert.equal(input.isRaw, true);
  assert.equal(input.listenerCount('data'), 0);
});

for (const signal of ['\u0004', 'end', 'error']) {
  test(`LESSON-4: ${JSON.stringify(signal)} terminates input without leaking stream errors`, async () => {
    const { input, writes, output } = terminal();
    const result = readPrivatePassword(input, output);
    if (signal === '\u0004') input.emit('data', Buffer.from(`Example1!${signal}`));
    else input.emit(signal, Error('sensitive stream detail'));
    await assert.rejects(result, error => !error.message.includes('sensitive'));
    assert.equal(input.isRaw, false);
    assert.equal(input.listenerCount('data'), 0);
    assert.equal(input.listenerCount('end'), 0);
    assert.equal(input.listenerCount('error'), 0);
    assert.ok(writes.every(value => !value.includes('Example1!')));
  });
}

test('LESSON-4: terminal output failures reject after restoring mode and listeners', async () => {
  const { input } = terminal();
  const result = readPrivatePassword(input, { write() { throw Error('sensitive output detail'); } });
  await assert.rejects(result, error => !error.message.includes('sensitive'));
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('data'), 0);
});
