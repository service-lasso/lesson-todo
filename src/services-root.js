import path from "node:path";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir } from "node:fs/promises";

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

async function assertWritePath(target) {
  let current = path.resolve(target);
  while (true) {
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw Error('Service preparation must not traverse links or junctions.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function seedEntries(source, destination, entries = []) {
  await assertWritePath(destination);
  const entry = await lstat(source);
  entries.push({ source, destination, directory: entry.isDirectory() });
  if (entry.isDirectory()) {
    for (const name of await readdir(source)) await seedEntries(path.join(source, name), path.join(destination, name), entries);
  }
  return entries;
}

export async function prepareStarterServicesRoot(config) {
  await assertServiceTree(config.sourceServicesRoot);
  await assertWritePath(config.servicesRoot);
  await assertServiceTree(config.servicesRoot, true);
  // Preflight the complete seed write boundary before creating anything. Even
  // an explicit seed path below .state must not traverse a retained link.
  const entries = await seedEntries(config.sourceServicesRoot, config.servicesRoot);
  for (const { source, destination, directory } of entries) {
    await assertWritePath(destination);
    if (directory) await mkdir(destination, { recursive: true });
    else {
      try { await copyFile(source, destination, constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }

  return {
    servicesRoot: config.servicesRoot,
    echoServiceRoot: path.join(config.servicesRoot, "echo-service"),
    serviceAdminRoot: path.join(config.servicesRoot, "@serviceadmin"),
    echoServiceManifestPath: path.join(config.servicesRoot, "echo-service", "service.json"),
  };
}
