# Todo, from first app to desktop

One repository, five complete runnable checkpoints for the Service Lasso article series.
Each folder owns its full service inventory and explains the change from the previous step.
The real service implementations and release archives remain in their producer repositories.

| Checkpoint | What changes | Article |
| --- | --- | --- |
| [01 App](lessons/01-app/README.md) | Todo persists JSON | [Build an app](https://service-lasso.github.io/service-lasso/getting-started/beginner-todo-app) |
| [02 Database](lessons/02-database/README.md) | PostgreSQL and explicit JSON migration | [Make it durable](https://service-lasso.github.io/service-lasso/getting-started/intermediate-make-todo-app-durable) |
| [03 API](lessons/03-api/README.md) | Go API owns SQL | [Add an API](https://service-lasso.github.io/service-lasso/getting-started/advanced-add-go-todo-api-service) |
| [04 SSO](lessons/04-sso/README.md) | Identity, HTTPS, paired App/API protection | [Add SSO](https://service-lasso.github.io/service-lasso/getting-started/zitadel-sso-hub) |
| [05 Desktop](lessons/05-desktop/README.md) | Native Windows shell; optional identity | [Package Todo](https://service-lasso.github.io/service-lasso/getting-started/package-todo-tauri) |

## Platform prerequisites

Use host Node 22 or newer. Fresh checkpoints acquire managed Node 22.23.3 from
lasso-node tag `2026.10.5-4b473fb` (producer commit
`4b473fbbf70e109cce9632d0f59b2e80f1b9a5b5`). The published tag targets that exact commit and its Node 22 asset inventory
and Windows archive checksum have been verified. Fresh managed consumer proof
remains separate; source pins alone do not establish a working checkpoint.

Fresh Intel checkpoints select the qualified Broker macOS 11 compatibility
profile from [release 2026.10.5-9c0b0e6](https://github.com/service-lasso/lasso-secretsbroker/releases/tag/2026.10.5-9c0b0e6).
The checked-in profile bytes and [provenance](profiles/broker/source.json) bind
the exact producer and checksum; native Broker and public Core acquisition,
secret lookup and restart checks passed. ARM uses the default Broker profile
requiring macOS 12. Stage04 still requires macOS 12 for its older Zitadel profile.
Setup and run validate the selected profiles before acquisition or state writes.
Fresh Intel setup merges only artifact fields into the curated lesson manifest,
preserving its secure Unix transport and process health policy.
Retained legacy Broker requires macOS 12 and managed Node 24 requires 13.5;
setup preserves their manifests and acquired bytes. Use a separate fresh
checkpoint for new pins. Complete native lesson SSO remains a separate gate.
Binary compatibility is not production OS support: use a vendor-supported OS.
See [Node 22 platform contract](https://github.com/nodejs/node/blob/v22.23.3/BUILDING.md)
and [Go 1.26 minimum macOS](https://go.dev/doc/go1.26#darwin).
Windows desktop compilation remains a separately qualified Windows x64 flow.

Start at the repository root with Node 22 or newer:

```sh
npm ci
npm run setup -- 01
npm run lesson:01
```

Open the printed Admin URL. Complete first-run Broker setup, then install/configure/start
Todo. Its allocated web endpoint opens the app. Type `shutdown` in the terminal to stop
only the owned stack. Restart the host with the same command, then start managed services
in Admin again, dependencies first. The host restart retains state and does not automatically
start the App stack.

Select another checkpoint explicitly with `npm run setup -- 02` and `npm run lesson:02`
(through 05). `npm run setup -- --01` also works. Stage 04 starts with
`npm run lesson:04 -- --management` for provisioning; normal launch rejects an incomplete
SSO pair. Stage 05 builds an executable with `npm run desktop:build` on Windows x64,
Node 22, Rust stable MSVC and Windows build tools.

Every checkpoint uses separate ignored `.workspace/<checkpoint>/services`, `runtime`
and `registries` directories, including private instance and host-port registries.
Setup copies seeds once and retains existing manifests, credentials and databases.
It rejects linked state paths. Checkpoints do not implicitly share data; follow each
README's explicit migration instructions. Do not run two hosts against one checkpoint.
`LESSON_HOST_PORT` and `LESSON_API_PORT` optionally choose loopback ports.

Fresh API and desktop seeds deliberately allow anonymous local access. Stage 04 requires
real provider setup, operator-approved CA trust, Web PKCE and Basic API clients, private
credential files and the acquired paired Todo helper. Setup never downgrades existing SSO.
Credentials, runtime state and private CAs must stay outside source and build resources.

Core is pinned to published `2026.9.22-f3de461`; Admin is downloaded and checksum-verified
at `2026.8.31-f015b44`. No sibling build is required. Producer pins are Todo
`2026.10.4-15dc4b9`, API `2026.10.4-02ef566` and PostgreSQL `2026.10.4-1af7982`.
[Provenance](PROVENANCE.md) records sources and attribution. `npm test` preserves the
inherited host/release fixtures and adds lesson retention and configuration contracts.
Windows CI invokes the actual lesson desktop build command. Source tests, real managed
operation, compilation, WebView sign-in, installer UI and publication remain separate evidence.

Observed Core startup failures are tracked separately: [Windows ownership inspection](https://github.com/service-lasso/service-lasso/issues/1698)
and [Broker-dependent endpoint changes](https://github.com/service-lasso/service-lasso/issues/1699).
Their failed attempts remain preserved alongside the lesson verification results.

Governed by issue [#1](https://github.com/service-lasso/lesson-todo/issues/1),
[SPEC-LESSONS](.governance/specs/SPEC-LESSONS.md), and Core
[#1695](https://github.com/service-lasso/service-lasso/issues/1695). Development only;
this repository does not declare GA or authorize release promotion.
