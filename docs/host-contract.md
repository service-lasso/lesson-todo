# Node host contract

This file records the component-specific implementation boundary. The operator journey is owned by the Core guides linked from the repository README.

## Host and runtime boundary

`src/index.js` consumes the published `@service-lasso/service-lasso` runtime. The host owns its shell at `/` and mounts a sibling built Service Admin at `/admin/`. It supplies explicit `servicesRoot` and `workspaceRoot`, preparing its local service inventory from the tracked `services/` definitions before startup.

The current host entrypoint is `npm start`. Its defaults are host shell `http://127.0.0.1:19010`, Admin `http://127.0.0.1:19010/admin/` and runtime API `http://127.0.0.1:18081`. These are source defaults; availability depends on the configured instance and prerequisites described by the shared guide.

## Managed inventory

The tracked baseline contains `echo-service`, `@serviceadmin`, `@node`, `@localcert`, `@nginx` and `@traefik`. Optional `@python` and `@java` examples are disabled. Echo and Traefik download/archive identities belong to their service manifests. Traefik declares `@localcert` and `@nginx` as dependencies. Core service identifiers retain their `@` prefix; the sample `echo-service` remains unprefixed.

## Packaging boundary

The implemented starter hosts a runtime, a host shell and a sibling Admin build; its release contracts distinguish source, bootstrap-download and bundled/no-download artifacts. A runnable starter is not evidence of a single-file executable, installer or cross-platform distribution acceptance. Native packaging and release verification remain governed by the component's [release artifact contract](release-artifact.md), scripts and workflows.

## Documentation migration receipt

For service-lasso/service-lasso#1418 / SPEC-002 AC-4AJ.3 and companion issue #12, the reviewed `README.md` and `docs/minimal-poc.md` came from develop revision `468dabe9f9aea29b7767fcf66067bce5c59eca29`. The duplicated host/Admin/Echo reader journey moved to Core PR #1424; README now links to that exact merged guide. The replaced generic `docs/minimal-poc.md` is removed. Component-specific host and packaging boundaries remain here and in `docs/release-artifact.md`. No runtime acceptance, guide publication or release is claimed by this migration.
