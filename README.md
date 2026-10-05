# service-lasso-app-node

Template repo for a plain-Node app host around Service Lasso.

Package identity:
- `@service-lasso/service-lasso-app-node`

Purpose:
- show how to host Service Lasso in a plain Node app without coupling that logic into core
- act as a quick-start template for downstream teams
- stay close to real runtime behavior while remaining outside the core repo

Expected runtime model:
- `servicesRoot`
- `workspaceRoot`

Current implementation:
- plain Node host entrypoint under `src/index.js`
- published `@service-lasso/service-lasso` runtime package consumption
- host-owned shell at `/`
- mounted sibling `lasso-@serviceadmin` build at `/admin/`
- tracked repo-owned baseline `services/` definitions for Echo Service, Service Admin, `@node`, `@localcert`, `@nginx`, and `@traefik`, plus disabled optional `@python` and `@java` provider examples
- manifest-owned Echo Service archive metadata under `services/echo-service/service.json`
- manifest-owned Traefik archive metadata under `services/@traefik/service.json`, with `@localcert` and `@nginx` declared as Traefik dependencies
- core Service Lasso services use the `@` prefix: `@node`, `@python`, `@java`, `@localcert`, `@nginx`, `@traefik`, and `@serviceadmin`; `echo-service` stays unprefixed because it is the sample/test managed service
- prepared local `servicesRoot` copied from the tracked service inventory before runtime startup

Current local start command:
- `npm start`

Current local URLs:
- host shell: `http://127.0.0.1:19010`
- admin UI: `http://127.0.0.1:19010/admin/`
- runtime API: `http://127.0.0.1:18081`

## Current release artifact

This starter repo now has bounded source, bootstrap-download, and bundled/no-download release artifacts.

Current local commands:
- `npm test`
- `npm run release:artifact`
- `npm run release:verify`

Current pipelines:
- `CI`
  - runs on pushes to `main` and on pull requests
  - installs dependencies and runs `npm test`
- `Release`
  - runs on pushes to `main` or by manual dispatch
  - runs tests, verifies the artifact, uploads the packaged files, and creates a `yyyy.m.d-<shortsha>` release on `main`

Current shipped artifact contents are documented in:
- `docs/release-artifact.md`

Current honest label:
- this repo ships a runnable plain-Node app-host starter plus explicit source, bootstrap-download, and bundled runtime artifacts

Release versions from `main` follow the protected-branch pattern:
- `yyyy.m.d-<shortsha>`

## Minimal POC

The first concrete target for this repo is documented in:
- `docs/minimal-poc.md`
