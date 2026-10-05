import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { admitAdminZip, ADMIN_ZIP_LIMITS } from "./admin-zip-lib.mjs";
import path from "node:path";

async function assertPlainTree(root) {
  const entry = await lstat(root);
  if (entry.isSymbolicLink() || path.resolve(await realpath(root)) !== path.resolve(root)) {
    throw Error(`Admin staging must not traverse links: ${root}`);
  }
  if (entry.isDirectory()) {
    for (const name of await readdir(root)) await assertPlainTree(path.join(root, name));
  } else if (!entry.isFile()) throw Error(`Unsupported Admin entry: ${root}`);
}

export async function assertExistingPlainTree(target) {
  try { await assertPlainTree(target); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function readAdminArchive(archive) {
  const target = path.resolve(archive);
  const entry = await lstat(target);
  if (!entry.isFile() || entry.isSymbolicLink() || path.resolve(await realpath(target)) !== target ||
      entry.size > ADMIN_ZIP_LIMITS.archiveBytes) throw Error("Admin archive must be a bounded plain file");
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.dev !== entry.dev || current.ino !== entry.ino || current.size !== entry.size) {
      throw Error("Admin archive identity changed");
    }
    const bytes = Buffer.alloc(current.size);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) throw Error("Admin archive truncated");
      offset += result.bytesRead;
    }
    const final = await handle.stat();
    const named = await lstat(target);
    if (final.size !== current.size || final.mtimeMs !== current.mtimeMs || final.ctimeMs !== current.ctimeMs ||
        named.isSymbolicLink() || named.dev !== current.dev || named.ino !== current.ino ||
        path.resolve(await realpath(target)) !== target) throw Error("Admin archive identity changed");
    return bytes;
  } finally { await handle.close(); }
}

async function verifyExtractedMembers(extraction, expected) {
  await assertPlainTree(extraction);
  const seen = new Set();
  const pending = [""];
  while (pending.length) {
    const relative = pending.pop();
    const target = path.join(extraction, relative);
    const entry = await lstat(target);
    const admitted = expected.get(relative);
    if (!admitted || entry.isDirectory() !== admitted.directory) throw Error("Admin extraction membership mismatch");
    seen.add(relative);
    if (entry.isDirectory()) {
      for (const name of await readdir(target)) pending.push(relative ? `${relative}/${name}` : name);
    } else if (createHash("sha256").update(await readAdminArchive(target)).digest("hex") !== admitted.digest) {
      throw Error("Admin extraction content mismatch");
    }
  }
  if (seen.size !== expected.size) throw Error("Admin extraction membership mismatch");
}

async function createPlainDirectories(extraction, target) {
  const relative = path.relative(extraction, target);
  const segments = relative ? relative.split(path.sep) : [];
  let directory = extraction;
  for (let index = 0; index <= segments.length; index += 1) {
    if (index) {
      directory = path.join(directory, segments[index - 1]);
      try { await mkdir(directory); } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    const entry = await lstat(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink() || path.resolve(await realpath(directory)) !== directory) {
      throw Error(`Admin staging must not traverse links: ${directory}`);
    }
  }
}

// Fresh extraction and rename publication prevent either cached or destination-only
// files from becoming part of the checksum-bound Admin payload. No recursive delete:
// old payloads and failed extraction attempts remain separate diagnostic evidence.
export async function stageAdminPayload({ repoRoot, archive, digest }) {
  const root = path.resolve(repoRoot);
  const rootEntry = await lstat(root);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink() || path.resolve(await realpath(root)) !== root) {
    throw Error("Admin repository root must not traverse links");
  }
  const bytes = await readAdminArchive(archive);
  if (createHash("sha256").update(bytes).digest("hex") !== digest) {
    throw Error("Admin archive checksum mismatch");
  }
  const members = admitAdminZip(bytes);
  const cache = path.join(root, ".tmp");
  const payload = path.join(root, ".payload");
  await assertExistingPlainTree(cache);
  await assertExistingPlainTree(payload);
  await mkdir(cache, { recursive: true });
  await mkdir(payload, { recursive: true });
  const extraction = await mkdtemp(path.join(cache, "admin-extraction-"));
  const expected = new Map([["", { directory: true }]]);
  for (const member of members) {
    const target = path.resolve(extraction, member.name);
    if (!(target.startsWith(extraction + path.sep) || (member.directory && member.name === "" && target === extraction))) {
      throw Error(`Unsafe Admin archive member: ${member.name}`);
    }
    const data = member.read();
    const relative = member.name.replace(/\/$/, "");
    const parts = relative.split("/");
    for (let depth = 1; depth < parts.length; depth += 1) expected.set(parts.slice(0, depth).join("/"), { directory: true });
    expected.set(relative, { directory: member.directory, digest: createHash("sha256").update(data).digest("hex") });
    await createPlainDirectories(extraction, member.directory ? target : path.dirname(target));
    // Only create regular files; archive attributes never create filesystem links.
    if (!member.directory) await writeFile(target, data, { flag: "wx", mode: 0o600 });
  }
  await verifyExtractedMembers(extraction, expected);
  const dist = path.join(extraction, "dist");
  await readFile(path.join(dist, "index.html"));
  const destination = path.join(payload, "admin");
  await assertPlainTree(cache);
  await assertPlainTree(payload);
  await assertExistingPlainTree(destination);
  await verifyExtractedMembers(extraction, expected);
  const retired = path.join(cache, `admin-retired-${randomUUID()}`);
  let hadDestination = false;
  try { await rename(destination, retired); hadDestination = true; } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try { await rename(dist, destination); } catch (error) {
    if (hadDestination) await rename(retired, destination);
    throw error;
  }
  return destination;
}
