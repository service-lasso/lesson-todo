# Minimal POC

This document defines the most minimal useful POC for `service-lasso-app-node`.

It must use:
- `service-lasso` as the runtime/API
- `lasso-echoservice` as the first managed service under test
- `lasso-@serviceadmin` as the operator UI

## POC goal

Prove that a plain Node host can package and run the Service Lasso runtime together with a usable admin UI and Echo Service as the first managed service.

## Minimal shape

The POC should:
- start the `service-lasso` runtime from a Node host entrypoint
- prepare a local `servicesRoot` that includes Echo Service
- show host-owned startup or status output from the Node host itself
- provide or proxy a local `lasso-@serviceadmin` build/dev server
- open or print one URL for the operator to use
- let the operator manage Echo Service through the admin UI

## Required ingredients

1. Runtime host:
   - one Node entrypoint that boots `service-lasso`
   - explicit `servicesRoot`
   - explicit `workspaceRoot`

2. Service under test:
   - local or released `lasso-echoservice`

3. UI:
   - `lasso-@serviceadmin`
   - configured against the runtime API

## Minimal user flow

1. Run one Node host command.
2. The host starts `service-lasso`.
3. The host shows its own startup/status output.
4. The host makes Service Admin available locally.
5. The operator opens the printed URL.
6. Echo Service appears in the admin UI.
7. The operator starts/stops Echo Service and views logs.

## POC deliverables

- one Node start command
- one documented local URL
- documented how Echo Service is included
- documented how Service Admin is served or proxied
- documented host-owned output behavior
- one short smoke checklist

## Current status

This bounded POC is now implemented in-repo:
- `npm start` boots the published `@service-lasso/service-lasso` runtime
- the host serves its own shell at `/`
- the host mounts the sibling built `lasso-@serviceadmin` app at `/admin/`
- the host prepares a local wrapper `servicesRoot` so `lasso-echoservice` is the discovered service under test

## Honest scope limit

This POC does not need:
- a final executable packager
- single-file binaries
- installers
- cross-platform distribution polish

It only needs to prove:

**a plain Node host can run Service Lasso and expose Service Admin against real Echo Service**
