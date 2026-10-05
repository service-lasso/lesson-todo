import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm,realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { create } from 'tar';
import { stageNativeSource } from '../scripts/native-source.mjs';

test('native rebuild ignores mutated cached source and private credential fields',async()=>{
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'lesson-native-')));
  try {
    const input=path.join(root,'input'), cache=path.join(root,'cache');
    const project='service-lasso-app-tauri-fixture';
    await mkdir(path.join(input,project),{recursive:true});await mkdir(cache);
    await writeFile(path.join(input,project,'service.json'),'{}');
    await writeFile(path.join(input,project,'host.js'),'// verified source');
    const archive=path.join(root,'fixture.tar.gz');
    await create({gzip:true,file:archive,cwd:input},[project]);
    const bytes=await readFile(archive),source={commit:'fixture',sha256:createHash('sha256').update(bytes).digest('hex')};
    const first=await stageNativeSource(cache,bytes,source);
    await writeFile(path.join(first.project,'service.json'),'{"env":{"TODO_API_CLIENT_SECRET":"must-never-bundle"}}');
    await writeFile(path.join(first.project,'host.js'),'// mutated host');
    const second=await stageNativeSource(cache,bytes,source);
    assert.notEqual(first.project,second.project);
    assert.equal(await readFile(path.join(second.project,'service.json'),'utf8'),'{}');
    assert.equal(await readFile(path.join(second.project,'host.js'),'utf8'),'// verified source');
    await assert.rejects(stageNativeSource(cache,Buffer.from('wrong'),source),/checksum mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});
