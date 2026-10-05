import path from "node:path";
import { fileURLToPath } from "node:url";
import { stageReleaseArtifacts } from "./release-artifact-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await stageReleaseArtifacts({ repoRoot });

console.log("[service-lasso starter] staged release artifacts");
console.log(`- source artifact: ${result.artifacts.source.artifactName}`);
console.log(`- source folder: ${result.artifacts.source.artifactRoot}`);
console.log(`- source archive: ${result.artifacts.source.archivePath}`);
console.log(`- runtime artifact: ${result.artifacts.runtime.artifactName}`);
console.log(`- runtime folder: ${result.artifacts.runtime.artifactRoot}`);
console.log(`- runtime archive: ${result.artifacts.runtime.archivePath}`);
console.log(`- preloaded artifact: ${result.artifacts.preloaded.artifactName}`);
console.log(`- preloaded folder: ${result.artifacts.preloaded.artifactRoot}`);
console.log(`- preloaded archive: ${result.artifacts.preloaded.archivePath}`);
