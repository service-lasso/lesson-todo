import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, cp, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { stageNativeSource } from '../../scripts/native-source.mjs';
import { repoRoot, assertOwnedTree } from '../../scripts/lesson.mjs';
import { assertExistingPlainTree } from '../../scripts/admin-payload-lib.mjs';

if (process.platform !== 'win32' || process.arch !== 'x64' || process.versions.node.split('.')[0] !== '22') throw Error('Desktop build needs Windows x64, Node 22, Rust stable MSVC and Windows build tools.');
const source = JSON.parse(await readFile(new URL('./template-source.json', import.meta.url)));
const cache = path.join(repoRoot, '.native', 'lesson-05');
await assertOwnedTree(cache); await mkdir(cache, { recursive: true });
const archive = path.join(cache, 'template.tar.gz');
let bytes;
try { bytes = await readFile(archive); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`Template source acquisition HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw Error('Template source checksum mismatch.');
try { await access(archive); } catch { await writeFile(archive, bytes, { flag: 'wx' }); }
const { project } = await stageNativeSource(cache, bytes, source);
await assertOwnedTree(project);
await assertExistingPlainTree(project);
try { await access(path.join(project, '.workspace')); throw Error('Native build project contains runtime state; preserve it and use a fresh clone for building.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// Only the generated, ignored project receives the complete lesson inventory.
// A unique verified extraction each run prevents cached edits or secrets entering the bundle.
await cp(path.join(repoRoot, 'lessons', '05-desktop', 'services'), path.join(project, 'services'), { recursive: true, force: true });
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
execFileSync(process.execPath, [npmCli, 'ci', '--ignore-scripts'], { cwd: project, stdio: 'inherit' });
execFileSync(process.execPath, [npmCli, 'run', 'desktop:build'], { cwd: project, stdio: 'inherit' });
const receipt = { source, lesson: '05-desktop', core: '2026.9.22-f3de461',
  output: path.join(project, 'src-tauri', 'target', 'release'), scope: 'native compilation; WebView sign-in and installer UI require separate verification' };
await writeFile(path.join(cache, 'build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
