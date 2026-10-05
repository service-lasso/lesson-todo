// Cross-platform terminal entry. Secret bytes travel only through child stdin.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';

export function readPrivatePassword(input = process.stdin, output = process.stderr) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') throw Error('Use an interactive terminal for the private password prompt.');
  return new Promise((resolve, reject) => {
    let password = '';
    const decoder = new StringDecoder('utf8');
    let finished = false;
    const wasRaw = input.isRaw;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      input.off('data', onData);
      input.off('error', onError);
      input.off('end', onEnd);
      try { input.setRawMode(Boolean(wasRaw)); } catch { error = Error('Private terminal cleanup failed.'); }
      try { input.pause(); } catch { error = Error('Private terminal cleanup failed.'); }
      try { output.write('\n'); } catch { error = Error('Private terminal output failed.'); }
      if (error) { password = ''; reject(error); } else resolve(password);
    };
    const onError = () => finish(Error('Private terminal input failed.'));
    const onEnd = () => finish(Error('Private prompt cancelled.'));
    const onData = chunk => {
      for (const character of decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))) {
        if (character === '\u0003' || character === '\u0004') return finish(Error('Private prompt cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') password = [...password].slice(0, -1).join('');
        else if (character >= ' ' && character !== '\u001b') password += character;
        if (Buffer.byteLength(password) > 512) return finish(Error('Private input too large.'));
      }
    };
    try {
      output.write('Private initial identity admin password (save in your password manager): ');
      input.setRawMode(true);
      input.on('data', onData);
      input.on('error', onError);
      input.on('end', onEnd);
      input.resume();
    } catch { finish(Error('Private terminal setup failed.')); }
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
