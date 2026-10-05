import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import {
  createTemporaryOutputRoot,
  readRootPackageJson,
  stageReleaseArtifacts,
  verifyStagedArtifacts,
} from "../scripts/release-artifact-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("starter release artifacts can be staged and verified", async () => {
  const outputRoot = await createTemporaryOutputRoot();

  try {
    const packageJson = await readRootPackageJson(repoRoot);
    const packageSuffix = packageJson.name.split("/").at(-1);
    const staged = await stageReleaseArtifacts({
      repoRoot,
      outputRoot,
    });

    assert.match(staged.baseName, new RegExp(`^${packageSuffix}-\\d+\\.\\d+\\.\\d+$`));
    assert.equal(staged.artifacts.source.manifest.artifactKind, "starter-template-source");
    assert.equal(staged.artifacts.runtime.manifest.artifactKind, "runnable-bootstrap-download");
    assert.equal(staged.artifacts.preloaded.manifest.artifactKind, "runnable-preloaded");

    const verified = await verifyStagedArtifacts({
      repoRoot,
      staged,
    });

    assert.equal(verified.baseName, staged.baseName);
    assert.ok(verified.artifacts.runtime.verification.archiveDownloads >= 1);
    assert.equal(verified.artifacts.preloaded.verification.archiveDownloads, 0);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
