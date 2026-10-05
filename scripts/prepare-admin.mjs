import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { assertExistingPlainTree, readAdminArchive, stageAdminPayload } from "./admin-payload-lib.mjs";
import { ADMIN_ZIP_LIMITS } from "./admin-zip-lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function prepareAdmin() {
  const cache = path.join(root, ".tmp", "admin-2026.8.31-f015b44");
  const archive = path.join(cache, "admin.zip");
  const digest = "fe5e5fe01d1202f3874097e6223652d634c94677c765c5f82d20e6d274c0161c";
  await assertExistingPlainTree(path.join(root, ".tmp"));
  await mkdir(cache, {recursive:true});
  let bytes;
  let acquired = false;
  try { bytes = await readAdminArchive(archive); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch("https://github.com/service-lasso/lasso-serviceadmin/releases/download/2026.8.31-f015b44/%40serviceadmin-win32.zip", { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Admin acquisition HTTP ${response.status}`);
    if (!response.body) throw Error("Admin acquisition has no body");
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > ADMIN_ZIP_LIMITS.archiveBytes) throw Error("Admin acquisition exceeds archive byte limit");
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    bytes = Buffer.concat(chunks, size);
    acquired = true;
  }
  if (createHash("sha256").update(bytes).digest("hex") !== digest) throw Error("Admin archive checksum mismatch");
  if (acquired) await writeFile(archive, bytes, { flag: "wx", mode: 0o600 });
  await stageAdminPayload({repoRoot:root, archive, digest});
  return {tag:"2026.8.31-f015b44", sha256:digest};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await prepareAdmin()));
