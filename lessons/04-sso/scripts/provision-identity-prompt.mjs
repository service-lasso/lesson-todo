// Cross-platform terminal entry. Secret bytes travel only through child stdin.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function readPrivatePassword(input = process.stdin, output = process.stderr) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') throw Error('Use an interactive terminal for the private password prompt.');
  return new Promise((resolve, reject) => {
    let password = '';
    const wasRaw = input.isRaw;
    const finish = (error) => {
      input.off('data', onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      output.write('\n');
      if (error) { password = ''; reject(error); } else resolve(password);
    };
    const onData = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004') return finish(Error('Private prompt cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') password = password.slice(0, -1);
        else if (character >= ' ' && character !== '\u001b') password += character;
        if (Buffer.byteLength(password) > 512) return finish(Error('Private input too large.'));
      }
    };
    output.write('Private initial identity admin password (save in your password manager): ');
    input.setRawMode(true);
    input.on('data', onData);
    input.resume();
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.slice(2).length !== 3) throw Error('Expected services root, workspace root and printed Core origin.');
    let password = await readPrivatePassword();
    if (password.length < 12 || password.length > 69 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[\W_]/.test(password)) throw Error('Use a 12–69 character password with uppercase, lowercase, digit and symbol.');
    const child = spawn(process.execPath, [fileURLToPath(new URL('./provision-identity.mjs', import.meta.url)), ...process.argv.slice(2)], { stdio: ['pipe', 'inherit', 'inherit'] });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ bootstrapPassword: password }));
    password = '';
    process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  } catch {
    console.error('Identity provisioning cancelled or failed. Check the private password policy, terminal and local inputs. Existing state is preserved.');
    process.exitCode = 1;
  }
}
