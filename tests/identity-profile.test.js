import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lessonPaths, assertPlatformPrerequisites, zitadelMacos11 } from '../scripts/lesson.mjs';
import { prepareStarterServicesRoot } from '../src/services-root.js';
const intel11 = { platform: 'darwin', arch: 'x64', macosVersion: '11.7.11' };
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'lesson-identity-'));
  const config = {...lessonPaths('04'),servicesRoot:path.join(root,'services')};
  try {await run(config,root);} finally {await rm(root,{recursive:true,force:true});}
}
test('LESSON-2/4/6: fresh Intel identity overlays artifact only and retains inline digest/configuration/state on rerun',()=>fixture(async config=>{
  await assertPlatformPrerequisites(config,intel11);
  const profile=config.seedFileOverrides[path.join('zitadel','service.json')];
  assert.equal(createHash('sha256').update(await readFile(profile)).digest('hex'),zitadelMacos11.profileSha256);
  await prepareStarterServicesRoot(config);
  const seed=JSON.parse(await readFile(path.join(config.sourceServicesRoot,'zitadel','service.json')));
  const target=path.join(config.servicesRoot,'zitadel','service.json');
  const selected=JSON.parse(await readFile(target));
  assert.deepEqual({...selected,artifact:seed.artifact},seed);
  assert.equal(selected.artifact.platforms.darwin.assetName,zitadelMacos11.asset);
  assert.deepEqual(selected.artifact.platforms.darwin.checksum,{algorithm:'sha256',value:zitadelMacos11.archiveSha256});
  const before=await readFile(target);
  await writeFile(path.join(config.servicesRoot,'zitadel','private'),'retained');
  await assertPlatformPrerequisites({...config,seedFileOverrides:undefined},intel11);
  await prepareStarterServicesRoot(config);
  assert.deepEqual(await readFile(target),before);
  assert.equal(await readFile(path.join(config.servicesRoot,'zitadel','private'),'utf8'),'retained');
  await assert.rejects(assertPlatformPrerequisites(config,{...intel11,arch:'arm64',macosVersion:'12.0'}),/requires x64/);
}));
test('LESSON-2/4/6: ARM/default and retained legacy identity stay guarded with no writes',()=>fixture(async(config,root)=>{
  await assert.rejects(assertPlatformPrerequisites(config,{...intel11,arch:'arm64'}),/macOS 12/);
  await assertPlatformPrerequisites(config,{...intel11,arch:'arm64',macosVersion:'12.0'});
  assert.equal(config.seedFileOverrides,undefined);
  await prepareStarterServicesRoot(config);
  const target=path.join(config.servicesRoot,'zitadel','service.json');
  const standard=JSON.parse(await readFile(target));
  assert.equal(standard.artifact.source.tag,zitadelMacos11.tag);
  assert.equal(standard.artifact.platforms.darwin.assetName,'lasso-zitadel-v4.14.0-darwin.tar.gz');
  standard.artifact.source.tag='2026.9.25-93d4c84';
  await writeFile(target,JSON.stringify(standard));const before=await readFile(target);
  // Let fresh Broker selection satisfy its own gate so this exercises the
  // independent retained identity gate, rather than stopping at legacy Broker.
  await rm(path.join(config.servicesRoot,'@secretsbroker','service.json'));
  await assert.rejects(assertPlatformPrerequisites(config,intel11),/Zitadel profile.*macOS 12/);
  assert.deepEqual(await readFile(target),before);
}));
test('LESSON-2/4/6: forged identity archive digest and alternate profile source reject',()=>fixture(async(config,root)=>{
  await assertPlatformPrerequisites(config,intel11);
  await prepareStarterServicesRoot(config);
  const target=path.join(config.servicesRoot,'zitadel','service.json');
  const identity=JSON.parse(await readFile(target));identity.artifact.platforms.darwin.checksum.value='0'.repeat(64);
  await writeFile(target,JSON.stringify(identity));const before=await readFile(target);
  await assert.rejects(assertPlatformPrerequisites(config,intel11),/Zitadel profile.*macOS 12/);
  assert.deepEqual(await readFile(target),before);
  const external=path.join(root,'external.json');await writeFile(external,'{}');
  const destination=path.join(root,'fresh');
  await assert.rejects(prepareStarterServicesRoot({...config,servicesRoot:destination,seedFileOverrides:{[path.join('zitadel','service.json')]:external}}),/qualified source/);
  await assert.rejects(readdir(destination),{code:'ENOENT'});
}));
test('LESSON-4: exact identity helper preserves selected digest, chosen port, TLS, database and create-only grants',()=>fixture(async config=>{
  await assertPlatformPrerequisites(config,intel11);await prepareStarterServicesRoot(config);
  const identityFile=path.join(config.servicesRoot,'zitadel','service.json');
  const identity=JSON.parse(await readFile(identityFile));identity.ports.http=24202;
  await writeFile(identityFile,JSON.stringify(identity));
  const helper=path.join(config.repoRoot,'lessons','04-sso','scripts','configure-identity.mjs');
  const imports=path.join(config.repoRoot,'lessons','04-sso','imports');
  execFileSync(process.execPath,[helper,config.servicesRoot,imports],{stdio:'pipe'});
  const configured=JSON.parse(await readFile(identityFile));
  assert.equal(configured.ports.http,24202);assert.equal(configured.env.ZITADEL_PORT,'${HTTP_PORT}');
  assert.deepEqual(configured.artifact,identity.artifact);
  assert.equal(configured.env.ZITADEL_TLS_ENABLED,'true');assert.equal(configured.env.ZITADEL_TLS_CERTPATH,'${TODO_CERT_FILE}');
  assert.match(configured.env.ZITADEL_DATABASE_POSTGRES_DSN,/zitadel_todo/);
  assert.equal(configured.broker.writeback.allowOverwrite,false);
  assert.deepEqual(configured.broker.writeback.allowedOperations,['create']);
  const files=['zitadel','postgres','@todo-certs'].map(id=>path.join(config.servicesRoot,id,'service.json'));
  const before=await Promise.all(files.map(file=>readFile(file)));
  configured.artifact.source.tag='2026.9.25-93d4c84';await writeFile(identityFile,JSON.stringify(configured));
  const invalid=await readFile(identityFile);
  assert.throws(()=>execFileSync(process.execPath,[helper,config.servicesRoot,imports],{stdio:'pipe'}));
  assert.deepEqual(await readFile(identityFile),invalid);
  for(let n=1;n<files.length;n++)assert.deepEqual(await readFile(files[n]),before[n]);
}));
