# 1 — Build a Todo app

[Repository](../../README.md) · [Next](../02-database/README.md) · [Article](https://service-lasso.github.io/service-lasso/getting-started/beginner-todo-app)

Todo persists JSON in its own data folder.

```mermaid
flowchart LR
  user[User] --> app
  subgraph lasso[Service Lasso]
    subgraph owned[App owned storage]
      app["App<br/>(lasso-todo)"] --> data[(JSON)]
    end
  end
```

| Purpose | Service | Responsibility | Seed |
| --- | --- | --- | --- |
| Runtime | [@node](services/@node/service.json) | Run the App and database launcher | Enabled |
| Runtime | [@python](services/@python/service.json) | Baseline provider | Disabled |
| Runtime | [@java](services/@java/service.json) | Baseline provider | Disabled |
| Certificates | [@localcert](services/@localcert/service.json) | Baseline certificate service, disabled | Disabled |
| Routing | [@nginx](services/@nginx/service.json) | Disabled baseline | Disabled |
| Routing | [@traefik](services/@traefik/service.json) | Disabled baseline | Disabled |
| Management | [@serviceadmin](services/@serviceadmin/service.json) | Install, configure and inspect services | Disabled |
| Example | [echo-service](services/echo-service/service.json) | Disabled inherited fixture | Disabled |
| Secrets | [@secretsbroker](services/@secretsbroker/service.json) | Provide scoped secret access | Enabled |
| App | [todo](services/todo/service.json) | Serve Todo and validate requests | Enabled |

Prerequisites: host Node 22 or newer; fresh Intel macOS 11 uses the qualified Broker compatibility profile; ARM and retained legacy Broker require macOS 12. Stage04 also requires macOS 12 until its Zitadel compatibility profile is qualified. Managed Node is pinned to 22.23.3 (its binary minimum is macOS 11). Production use requires an OS still supported by its vendor. Existing Node 24 state requires macOS 13.5 or newer and is retained by setup. See [platform prerequisites](../../README.md#platform-prerequisites).

From the repository root, with Node 22 or newer:

```sh
npm ci
npm run setup -- 01
npm run lesson:01
```

Open the printed loopback Admin URL, complete its local first-run Broker setup, then install/configure/start App services in dependency order. Open Todo's allocated web endpoint. Type `shutdown` in the host terminal or Ctrl+C to stop only this owned stack. Restart the host with the same command, then start the managed services in Admin again, dependencies first. Setup preserves manifests, credentials and data; restarting the host does not automatically start the App stack. Do not launch two hosts against the same checkpoint.

State is isolated under `.workspace/01-app` with `services/`, `runtime/` and `registries/instances.json`. Optional `LESSON_HOST_PORT` and `LESSON_API_PORT` select loopback ports; defaults allocate available ports. Admin follows Core's actual port through its same-origin proxy. Core installs checksum-backed archives from exact tags.



Public disposable local database defaults are documented by the producer; operator credentials, private CAs and databases are never committed or bundled. Earlier API checkpoints explicitly allow anonymous local access. Setup never changes existing SSO.

The disabled inherited `@serviceadmin` manifest is inventory provenance only. The actual host serves checksum-bound Admin `2026.8.31-f015b44` from `.payload/admin` through its loopback proxy.

## Source and release inventory

- @node: [source and release 2026.10.5-4b473fb](https://github.com/service-lasso/lasso-node/releases/tag/2026.10.5-4b473fb).
- @python: [source and release 2026.4.27-63f915c](https://github.com/service-lasso/lasso-python/releases/tag/2026.4.27-63f915c).
- @java: [source and release 2026.4.27-b313cb0](https://github.com/service-lasso/lasso-java/releases/tag/2026.4.27-b313cb0).
- @localcert: [source and release 2026.4.27-591ed28](https://github.com/service-lasso/lasso-localcert/releases/tag/2026.4.27-591ed28).
- @nginx: [source and release 2026.4.27-712c75f](https://github.com/service-lasso/lasso-nginx/releases/tag/2026.4.27-712c75f).
- @traefik: [source and release 2026.4.27-bbc7f15](https://github.com/service-lasso/lasso-traefik/releases/tag/2026.4.27-bbc7f15).
- @serviceadmin: [source and release 2026.4.18-170a1af](https://github.com/service-lasso/lasso-serviceadmin/releases/tag/2026.4.18-170a1af).
- echo-service: [source and release 2026.4.20-a417abd](https://github.com/service-lasso/lasso-echoservice/releases/tag/2026.4.20-a417abd).
- @secretsbroker: [source and release 2026.10.5-9c0b0e6](https://github.com/service-lasso/lasso-secretsbroker/releases/tag/2026.10.5-9c0b0e6).
- todo: [source and release 2026.10.4-15dc4b9](https://github.com/service-lasso/lasso-todo/releases/tag/2026.10.4-15dc4b9).

Canonical implementations remain in those producer repositories. This folder owns the assembly. [Host](../../src/lesson-host.mjs), [safe setup](../../scripts/lesson.mjs), [provenance](../../PROVENANCE.md).
