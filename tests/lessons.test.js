import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { lessonPaths, lessons, assertPairedSso, assertPlatformPrerequisites, prepareLesson } from '../scripts/lesson.mjs';
import { prepareStarterServicesRoot } from '../src/services-root.js';

test('setup retains changed manifests, credentials and database bytes; refuses nested junctions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lesson-retention-'));
  const sourceServicesRoot = path.join(root, 'source'), servicesRoot = path.join(root, 'owned');
  try {
    await mkdir(path.join(sourceServicesRoot, 'todo'), {recursive:true});
    await writeFile(path.join(sourceServicesRoot, 'todo', 'service.json'), '{"id":"todo","env":{"new":"seed"}}');
    await prepareStarterServicesRoot({sourceServicesRoot, servicesRoot});
    const retained = '{"id":"todo","env":{"configured":"retain"}}';
    await writeFile(path.join(servicesRoot, 'todo', 'service.json'), retained);
    await writeFile(path.join(servicesRoot, 'todo', 'private-credential'), 'private fixture');
    await writeFile(path.join(servicesRoot, 'todo', 'database'), Buffer.from([0,255,1,13]));
    await prepareStarterServicesRoot({sourceServicesRoot, servicesRoot});
    assert.equal(await readFile(path.join(servicesRoot,'todo','service.json'),'utf8'),retained);
    assert.equal(await readFile(path.join(servicesRoot,'todo','private-credential'),'utf8'),'private fixture');
    assert.deepEqual(await readFile(path.join(servicesRoot,'todo','database')),Buffer.from([0,255,1,13]));
    const outside=path.join(root,'outside');await mkdir(outside);
    await symlink(outside,path.join(servicesRoot,'nested-link'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(prepareStarterServicesRoot({sourceServicesRoot,servicesRoot}),/links/);
    assert.deepEqual(await (await import('node:fs/promises')).readdir(outside),[]);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('each checkpoint has complete resolved dependencies, exact pins and independent registries', async () => {
  const registries=new Set(), portRegistries=new Set();
  for(const id of lessons){
    const config=lessonPaths(id);registries.add(config.registryPath);portRegistries.add(config.portRegistryPath);
    const lesson=JSON.parse(await readFile(path.join(config.repoRoot,'lessons',id,'lesson.json')));
    assert.ok(!lesson.article.includes('/docs/'));
    const inventory=new Map();
    for(const serviceId of lesson.services){const m=JSON.parse(await readFile(path.join(config.sourceServicesRoot,serviceId,'service.json')));assert.equal(m.id,serviceId);inventory.set(serviceId,m);assert.ok(m.artifact.source.tag);assert.equal(m.artifact.source.channel,undefined);}
    for(const m of inventory.values())for(const dependency of m.depend_on??[])assert.ok(inventory.has(dependency),`${id}: ${dependency}`);
    assert.equal(inventory.get('todo').artifact.source.tag,'2026.10.4-15dc4b9');
    const node=inventory.get('@node');
    assert.equal(node.version,'v22.23.3');
    assert.equal(node.artifact.source.tag,'2026.10.5-4b473fb');
    for(const [platform,extension] of [['win32','zip'],['linux','tar.gz'],['darwin','tar.gz']]) {
      assert.equal(node.artifact.platforms[platform].assetName,`lasso-node-v22.23.3-${platform}.${extension}`);
      assert.deepEqual(node.artifact.platforms[platform].checksum, { algorithm: 'sha256', assetName: 'SHA256SUMS.txt' });
    }
    for(const unused of ['echo-service','@nginx','@traefik','@localcert'])assert.equal(inventory.get(unused).enabled,false);
    if(inventory.has('todo-api'))assert.equal(inventory.get('todo-api').artifact.source.tag,'2026.10.4-02ef566');
    if(inventory.has('postgres'))assert.equal(inventory.get('postgres').artifact.source.tag,'2026.10.4-1af7982');
    const readme=await readFile(path.join(config.repoRoot,'lessons',id,'README.md'),'utf8');
    assert.match(readme,/```mermaid/);assert.ok(readme.includes(lesson.article));
  }
  assert.equal(registries.size,5);assert.equal(portRegistries.size,5);
  assert.throws(()=>lessonPaths(undefined),/explicitly/);
});

test('macOS preflight distinguishes full Broker stack from retained Node provider requirements without state mutation', async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'lesson-platform-'));
  const config={servicesRoot:path.join(root,'services')};
  try {
    await assert.rejects(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:'11.7.11'}),/Broker stack.*macOS 12/);
    // The public setup entry must reject before Admin acquisition or state preparation.
    await assert.rejects(prepareLesson('04',{platform:'darwin',arch:'x64',macosVersion:'11.7.11'}),/Zitadel profile.*macOS 12/);
    await assert.doesNotReject(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:'12.0'}));
    await assert.rejects(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:'unknown'}),/Cannot determine/);
    await mkdir(path.join(config.servicesRoot,'@node'),{recursive:true});
    const manifest='{"id":"@node","version":"v24.15.0","private":"retain"}';
    const filename=path.join(config.servicesRoot,'@node','service.json');
    await writeFile(filename,manifest);
    for(const version of ['12.7.6','13.4.1'])
      await assert.rejects(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:version}),/Retained managed Node.*13.5/);
    for(const version of ['13.5','14.0'])
      await assert.doesNotReject(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:version}));
    await assert.doesNotReject(assertPlatformPrerequisites(config,{platform:'win32'}));
    assert.equal(await readFile(filename,'utf8'),manifest);
    await writeFile(filename,'{"id":"@node","version":"v22.23.3"}');
    await assert.doesNotReject(assertPlatformPrerequisites(config,{platform:'darwin',macosVersion:'12.0'}));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('unconfigured SSO seeds fail closed even if manually started; partial pair is rejected',async()=>{
  const config=lessonPaths('04');
  const app=JSON.parse(await readFile(path.join(config.sourceServicesRoot,'todo','service.json')));
  const api=JSON.parse(await readFile(path.join(config.sourceServicesRoot,'todo-api','service.json')));
  assert.equal(app.enabled,false);assert.ok(app.env.TODO_OIDC_ISSUER);assert.equal(app.env.TODO_OIDC_CLIENT_ID,undefined);
  assert.equal(api.env.TODO_API_AUTH_MODE,'zitadel');assert.equal(api.env.TODO_API_CLIENT_SECRET_FILE,undefined);
  await assert.rejects(assertPairedSso({...config,servicesRoot:config.sourceServicesRoot}),/not paired/);
  const root=await mkdtemp(path.join(tmpdir(),'lesson-sso-'));
  try{
    await mkdir(path.join(root,'todo'));await mkdir(path.join(root,'todo-api'));
    app.enabled=true;api.enabled=true;Object.assign(app.env,{TODO_OIDC_ISSUER:'https://localhost:18084',TODO_OIDC_CLIENT_ID:'web',TODO_OIDC_AUDIENCE:'project'});
    Object.assign(api.env,{TODO_OIDC_ISSUER:app.env.TODO_OIDC_ISSUER,TODO_OIDC_CLIENT_ID:'other',TODO_OIDC_AUDIENCE:'project',TODO_API_CLIENT_ID:'api',TODO_API_CLIENT_SECRET_FILE:'/private/secret',TODO_API_CA_FILE:'/public/ca'});
    for(const [id,m]of [['todo',app],['todo-api',api]])await writeFile(path.join(root,id,'service.json'),JSON.stringify(m));
    await assert.rejects(assertPairedSso({servicesRoot:root}),/not paired/);
    api.env.TODO_OIDC_CLIENT_ID='web';await writeFile(path.join(root,'todo-api','service.json'),JSON.stringify(api));
    await assert.doesNotReject(assertPairedSso({servicesRoot:root}));
  }finally{await rm(root,{recursive:true,force:true});}
});
