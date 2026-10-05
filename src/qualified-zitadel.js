// Immutable public producer inputs; do not infer compatibility from an asset name.
export const zitadelMacos11 = Object.freeze({
  tag: '2026.10.5-d7e04eb',
  asset: 'lasso-zitadel-v4.14.0-darwin-amd64-macos11.tar.gz',
  profileSha256: 'a7da28a3d851fb626c92094d5baefcf7a91ba72a63ba2d9218c74abb6be0e36e',
  archiveSha256: '24538a0a1ac2ea236416222816711ef786701a113e968c96027f2478f407f169'
});
export function isQualifiedIntelIdentity(manifest) {
  return manifest?.id === 'zitadel' && manifest.artifact?.source?.repo === 'service-lasso/lasso-zitadel' &&
    manifest.artifact.source.tag === zitadelMacos11.tag &&
    manifest.artifact.platforms?.darwin?.assetName === zitadelMacos11.asset &&
    manifest.artifact.platforms.darwin.checksum?.algorithm === 'sha256' &&
    manifest.artifact.platforms.darwin.checksum.value === zitadelMacos11.archiveSha256;
}
