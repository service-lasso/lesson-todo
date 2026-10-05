import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { extract } from 'tar';
import { assertServiceTree } from '../src/services-root.js';

export async function stageNativeSource(cache, bytes, source) {
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw Error('Template source checksum mismatch.');
  if ((await lstat(cache)).isSymbolicLink()) throw Error('Native cache cannot be a link or junction.');
  const buildRoot = path.join(cache, `build-${randomUUID()}`);
  await mkdir(buildRoot, {recursive:false});
  const archive = path.join(buildRoot, 'verified-template.tar.gz');
  await writeFile(archive, bytes, {flag:'wx'});
  await extract({file:archive,cwd:buildRoot,strict:true,preservePaths:false});
  await assertServiceTree(buildRoot);
  return {buildRoot,project:path.join(buildRoot, `service-lasso-app-tauri-${source.commit}`)};
}
