import path from "node:path";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { zitadelMacos11 } from './qualified-zitadel.js';

const profileRoot = fileURLToPath(new URL('../profiles/', import.meta.url));
const qualifiedProfiles = new Map([
  [path.join('@secretsbroker', 'service.json'), {
    relative: path.join('broker', 'service-darwin-amd64-macos11.json'),
    sha256: 'dd6fbd9fb9747b34b49ad9ab09e1c8bd29f10d2cb4df91e58e4d9b146f036ada'
  }],
  [path.join('zitadel', 'service.json'), {
    relative: path.join('zitadel', 'service-darwin-amd64-macos11.json'),
    sha256: zitadelMacos11.profileSha256
  }]
]);

// lstat rejects both symlinks and Windows junctions without confusing short-path aliases.
export async function assertServiceTree(root, retainedState = false, depth = 0) {
  let entry;
  try { entry = await lstat(root); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (entry.isSymbolicLink()) throw Error('Service preparation must not traverse links or junctions.');
  if (entry.isDirectory()) {
    for (const name of await readdir(root)) {
      const child = path.join(root, name);
      // Core owns acquired artifacts below <service>/.state. Check the custody
      // directory itself, but never walk, copy or alter its retained contents.
      if (retainedState && depth === 1 && name === '.state') {
        const state = await lstat(child);
        if (state.isSymbolicLink()) throw Error('Service preparation must not traverse links or junctions.');
        if (!state.isDirectory()) throw Error('Service state requires a plain directory.');
      } else await assertServiceTree(child, retainedState, depth + 1);
    }
  } else if (!entry.isFile()) throw Error('Service preparation requires plain files and directories.');
}

function preparationBoundary(source, destination) {
  let boundary = path.resolve(source);
  const target = path.resolve(destination);
  while (target !== boundary && !target.startsWith(boundary + path.sep)) {
    const parent = path.dirname(boundary);
    if (parent === boundary) return boundary;
    boundary = parent;
  }
  return boundary;
}

async function assertWritePath(target, boundary) {
  let current = path.resolve(target);
  while (true) {
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw Error('Service preparation must not traverse links or junctions.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // The shared seed/destination anchor bounds this preparation. System aliases
    // above it (for example macOS /var -> /private/var) are not owned write paths.
    if (current === boundary) return;
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function seedEntries(source, destination, boundary, entries = []) {
  await assertWritePath(destination, boundary);
  const entry = await lstat(source);
  try {
    const existing = await lstat(destination);
    if (entry.isDirectory() ? !existing.isDirectory() : !existing.isFile()) {
      throw Error('Service preparation requires matching seed and destination file/directory types.');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  entries.push({ source, destination, directory: entry.isDirectory() });
  if (entry.isDirectory()) {
    for (const name of await readdir(source)) await seedEntries(path.join(source, name), path.join(destination, name), boundary, entries);
  }
  return entries;
}

export async function preflightStarterServicesRoot(config) {
  const boundary = preparationBoundary(config.sourceServicesRoot, config.servicesRoot);
  await assertWritePath(config.sourceServicesRoot, boundary);
  await assertServiceTree(config.sourceServicesRoot);
  await assertWritePath(config.servicesRoot, boundary);
  await assertServiceTree(config.servicesRoot, true);
  // Preflight the complete seed write boundary before creating anything. Even
  // an explicit seed path below .state must not traverse a retained link.
  const entries = await seedEntries(config.sourceServicesRoot, config.servicesRoot, boundary);
  // Qualified profiles select artifact bytes only. The curated consumer seed
  // retains its secure transport, endpoint and health policy.
  for (const [relative, source] of Object.entries(config.seedFileOverrides ?? {})) {
    const approved = qualifiedProfiles.get(relative);
    if (!approved || path.resolve(source) !== path.resolve(profileRoot, approved.relative))
      throw Error('Platform profile must use its exact qualified source within the owned profile root.');
    // Walk the whole owned source ancestry, independently of the seed/destination
    // shared anchor. Neither external files nor aliases can supply profiles.
    await assertWritePath(source, path.dirname(profileRoot));
    const entry = entries.find(item => path.relative(config.sourceServicesRoot, item.source) === relative);
    if (!entry || entry.directory) throw Error('Platform profile must select an existing seed file.');
    await assertWritePath(source, boundary);
    await assertServiceTree(source);
    if (!(await lstat(source)).isFile()) throw Error('Platform profile requires a plain file.');
    const profileBytes = await readFile(source);
    if (createHash('sha256').update(profileBytes).digest('hex') !== approved.sha256)
      throw Error('Platform profile checksum mismatch; no files changed.');
    const producer = JSON.parse(profileBytes);
    if (relative === path.join('zitadel', 'service.json')) {
      if (producer.artifact?.platforms?.darwin?.assetName !== zitadelMacos11.asset)
        throw Error('Zitadel profile requires its exact qualified Intel archive.');
      for (const platform of Object.values(producer.artifact.platforms))
        platform.checksum = { algorithm: 'sha256', assetName: 'SHA256SUMS.txt' };
      producer.artifact.platforms.darwin.checksum = { algorithm: 'sha256', value: zitadelMacos11.archiveSha256 };
    }
    const consumer = JSON.parse(await readFile(entry.source, 'utf8'));
    if (consumer.id !== producer.id || consumer.artifact?.source?.repo !== producer.artifact?.source?.repo ||
      consumer.artifact.source.tag !== producer.artifact.source.tag)
      throw Error('Platform profile must match the exact curated consumer identity and release.');
    entry.contents = JSON.stringify({ ...consumer, artifact: producer.artifact }, null, 2) + '\n';
  }
  return { boundary, entries };
}

export async function prepareStarterServicesRoot(config) {
  const { boundary, entries } = await preflightStarterServicesRoot(config);
  for (const { source, destination, directory, contents } of entries) {
    await assertWritePath(destination, boundary);
    if (directory) await mkdir(destination, { recursive: true });
    else {
      try {
        if (contents !== undefined) await writeFile(destination, contents, { flag: 'wx' });
        else await copyFile(source, destination, constants.COPYFILE_EXCL);
      }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        await assertWritePath(destination, boundary);
        if (!(await lstat(destination)).isFile()) throw Error('Service preparation requires a retained plain file.');
      }
    }
  }

  return {
    servicesRoot: config.servicesRoot,
    echoServiceRoot: path.join(config.servicesRoot, "echo-service"),
    serviceAdminRoot: path.join(config.servicesRoot, "@serviceadmin"),
    echoServiceManifestPath: path.join(config.servicesRoot, "echo-service", "service.json"),
  };
}
