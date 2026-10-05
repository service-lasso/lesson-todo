import path from "node:path";
import { cp, lstat, readdir } from "node:fs/promises";

// lstat rejects both symlinks and Windows junctions without confusing short-path aliases.
export async function assertServiceTree(root) {
  let entry;
  try { entry = await lstat(root); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (entry.isSymbolicLink()) throw Error('Service preparation must not traverse links or junctions.');
  if (entry.isDirectory()) {
    for (const name of await readdir(root)) await assertServiceTree(path.join(root, name));
  } else if (!entry.isFile()) throw Error('Service preparation requires plain files and directories.');
}

export async function prepareStarterServicesRoot(config) {
  await assertServiceTree(config.sourceServicesRoot);
  await assertServiceTree(config.servicesRoot);
  await cp(config.sourceServicesRoot, config.servicesRoot, { recursive: true, force: false, errorOnExist: false });

  return {
    servicesRoot: config.servicesRoot,
    echoServiceRoot: path.join(config.servicesRoot, "echo-service"),
    serviceAdminRoot: path.join(config.servicesRoot, "@serviceadmin"),
    echoServiceManifestPath: path.join(config.servicesRoot, "echo-service", "service.json"),
  };
}
