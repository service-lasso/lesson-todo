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
