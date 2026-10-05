# Release artifacts

This repo now ships three bounded release artifacts.

Each artifact has a different job:
- source template
- runnable bootstrap-download bundle
- runnable bundled artifact

## Source template

Artifact:
- `service-lasso-app-node-<version>-source.tar.gz`

Purpose:
- give downstream teams a downloadable starter repo shape
- keep tracked `services/` metadata in the template repo itself

What ships:
- `.gitignore`
- `.npmrc`
- `.github/`
- `README.md`
- `package.json`
- `package-lock.json`
- `src/`
- `services/`
- `docs/`
- `scripts/`
- `tests/`
- generated `release-artifact.json`

Honest label:
- **starter-template source artifact**

## Runnable bootstrap-download bundle

Artifact:
- `service-lasso-app-node-<version>-runtime.tar.gz`

Purpose:
- provide a ready-to-run plain-Node host with the core runtime already installed
- include bundled Service Admin assets for the host shell
- keep the canonical repo-owned `services/` inventory inside the artifact
- prove that Echo Service is acquired from manifest-owned release metadata before use

What ships:
- `.npmrc`
- `README.md`
- `package.json`
- `package-lock.json`
- `src/`
- `services/`
- `docs/`
- installed `node_modules/`
- bundled admin assets under `.payload/admin/`
- generated `release-artifact.json`

How it works:
- the app repo owns the baseline `services/` inventory, including `echo-service`, `@serviceadmin`, `@node`, `@localcert`, `@nginx`, and `@traefik`
- `@traefik` declares `@localcert` and `@nginx` as dependencies in its manifest
- release-backed manifests carry bounded `artifact` blocks pointing at their service release assets
- on `install`, Service Lasso downloads and unpacks the matching archive from the manifest metadata
- the app artifact itself does not ship the Echo Service archive

Honest label:
- **runnable bootstrap-download bundle**

## Runnable bundled artifact

Artifact:
- `service-lasso-app-node-<version>-bundled.tar.gz`

Purpose:
- provide a ready-to-run plain-Node host with the core runtime already installed
- include bundled Service Admin assets for the host shell
- keep the canonical repo-owned `services/` inventory inside the artifact
- prove that the Echo Service archive is already present before first install/use

What ships:
- everything in the runnable bootstrap-download bundle
- acquired Echo Service archive under:
  - `services/echo-service/.state/artifacts/<releaseTag>/<assetName>`

How it works:
- the app repo still owns the same canonical baseline `services/` inventory
- the release package step acquires the matching archive into the repo-owned service folder before publishing
- on `install`, Service Lasso reuses that archive and skips the network fetch

Honest label:
- **runnable bundled artifact**

## What the release proves

The release now proves:
- the repo owns explicit tracked service metadata under `services/`
- the tracked service metadata includes the baseline Traefik dependency graph through `@localcert` and `@nginx`
- the plain-Node host can be packaged repeatably
- the runnable artifact can boot Service Lasso and Service Admin without sibling-repo checkout tricks
- Echo Service acquisition now depends on manifest-owned archive metadata instead of a generated local wrapper
- bootstrap-download mode installs the service payload before first use
- bundled mode installs from an already-shipped service archive without a first-run download

## Public package note

This starter depends on the public npm core package:
- `@service-lasso/service-lasso`

Local and CI installs resolve it from `https://registry.npmjs.org` without GitHub Packages auth.

## Commands

Stage the artifacts:

```bash
npm run release:artifact
```

Stage and verify the artifacts:

```bash
npm run release:verify
```

## Current expectation

Any application using Service Lasso should keep a tracked `services/` folder in its repo with the service metadata it intends to manage.

This app-node starter now uses that tracked inventory directly for bootstrap-download behavior.
