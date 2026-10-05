# Sources and attribution

Apache-2.0. Preserve the upstream LICENSE files and notices when redistributing.

| Material | Immutable source | Use |
| --- | --- | --- |
| Node host bootstrap, inherited host/release tests | `service-lasso/service-lasso-app-node` `9835a67d27938526750f6816ec8f4cdfca610aca` | Root host fixture and baseline inventory |
| Admin payload/ZIP admission, release acquisition and same-origin Admin server | `service-lasso/service-lasso-app-tauri` `6962c29c7bc5a98a30e0e630c238ed82c6515e5f` (author work candidate); source template develop `2ae33f49507154af14776cee4c4b86625c4d27ee` | Copied `scripts/admin-*.mjs`, `scripts/prepare-admin.mjs`, `src/admin-server.js`; Apache-2.0 |
| Complete native project | `service-lasso/service-lasso-app-tauri` `2ae33f49507154af14776cee4c4b86625c4d27ee` | Checksum-bound source archive; [receipt](lessons/05-desktop/template-source.json) |
| Identity manifest/provision helpers | `service-lasso/service-lasso` `093a2d582ed279dfcf3eafa5f6e621c2c75dd4b8` `examples/todo-sso` | Copied helper; provision imports adapted to installed published Core distribution |
| Managed Node 22 candidate | `lasso-node` `4b473fbbf70e109cce9632d0f59b2e80f1b9a5b5`, published tag `2026.10.5-4b473fb` | Original source manifest retained in `provenance/node/service.json` (producer default Node 24); the lesson explicitly selects the Node 22 version/asset profile from the multi-version publisher. The producer root release manifest keeps its Node 24 default. Five adapted provider manifests; Node `v22.23.3`; `lasso-node-v22.23.3-{win32.zip,linux.tar.gz,darwin.tar.gz}`. Published tag identity and checksum inventory verified; exact Windows archive checksum verified; full managed consumer proof pending; no unpublished runtime bytes copied |
| Core runtime | npm `@service-lasso/service-lasso@2026.9.22-f3de461` | Package lock integrity pins published bytes; helper imports verified against its distribution |
| Admin release | `lasso-serviceadmin` `2026.8.31-f015b44` | `@serviceadmin-win32.zip` SHA256 `fe5e5fe01d1202f3874097e6223652d634c94677c765c5f82d20e6d274c0161c` |

Todo and API producer original `service.json`, `source.json` and `SHA256SUMS.txt` are
retained under [provenance](provenance/). Other exact release manifest digests are recorded
there. Lesson assemblies remove floating channels, adapt dependencies/state paths and disable
unused fixtures/routers. Their artifact source tags and checksum assets remain producer-owned.
Runtime implementation is acquired by Core, never copied into lesson source. SSO enable/disable
uses the paired helper inside Todo's acquired checksum-verified release.
Its exact `configure-sso.mjs` SHA256 is
`0c23c024409d8da53ff37c66b8d900a6c7c51e15274de3ca57b7a56d482e1b84`;
the wrapper checks it before invoking either enable or disable.

Native bootstrap downloads only the pinned source archive, verifies its recorded SHA256,
and runs its own locked native build with lesson 05's complete inventory. Its Rust/settings,
desktop assets, Node sidecar, package lock and payload preparation remain exact upstream
source. Generated output is ignored. Neither source nor bundles include workspace state,
operator secrets, private certificate authority or databases.

Qualified identity release `2026.10.5-d7e04eb` targets full producer
`d7e04ebd9489ddc8c6798e408cd8ce7992711146`. The original public Intel 11
profile and exact checksum inventory are retained under [profiles/zitadel](profiles/zitadel/source.json).
Fresh standard packages share the repaired release. The Intel artifact overlay adds
its exact published inline archive SHA-256 and preserves curated configuration.
Producer security/native/publication qualification and literal lesson consumption
remain separate; no ARM macOS 11 or Mac desktop executable qualification is claimed.
