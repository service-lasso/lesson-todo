# App Node task list

This document tracks the first real implementation slice for `service-lasso-app-node`.

## Goal

Turn the starter into the smallest real plain-Node host that:
- uses published `@service-lasso/service-lasso`
- shows host-owned output
- exposes `lasso-@serviceadmin`
- discovers real `lasso-echoservice`

## Bounded tasks

1. Add package-registry wiring for `@service-lasso/service-lasso`
   status: done

2. Define deterministic local runtime/host ports and sibling-repo path assumptions
   status: done

3. Replace the placeholder entrypoint with a real Node host
   status: done

4. Serve a host-owned shell page with runtime/admin links and status
   status: done

5. Mount the built Service Admin app from the sibling repo
   status: done

6. Add direct tests for config resolution and host routes
   status: done

7. Prove local start behavior against the current workspace
   status: done

## Honest current scope

This slice does not yet build a final packaged executable or installer.

It only proves:

**a plain Node host can boot the published runtime, surface its own output, and make Service Admin reachable against the shared workspace containing Echo Service**

## Current evidence

- `npm test`
- local smoke:
  - host shell on `http://127.0.0.1:19010`
  - runtime API on `http://127.0.0.1:18081`
  - admin UI on `/admin/`
  - discovered service id: `echo-service`
  - install/config/start/stop exercised against the real sibling `lasso-echoservice`
