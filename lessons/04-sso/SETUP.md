# Configure the real identity checkpoint

Run `npm run setup -- 04`, then `npm run lesson:04 -- --management`. Keep the printed
Core origin. Complete Broker first-run setup in Admin and retain its private state.
The App/API seeds are disabled; default launch stays blocked until configuration is paired.

Stop managed App/API/Identity before changing manifests. Configure exact Identity and
dedicated certificates (this edits manifests only):

```sh
node lessons/04-sso/scripts/configure-identity.mjs .workspace/04-sso/services lessons/04-sso/imports
```

This uses a separate `@todo-certs`, `zitadel_todo` database, HTTPS, empty trust-store
mutation list and declared create-only Broker grants. Baseline `@localcert` stays disabled.
Refresh Admin; install/configure Certificates, PostgreSQL and Identity. Start Broker first.
Provision the stable Identity master key and initial admin password through real Broker IPC:

```powershell
pwsh -File lessons/04-sso/scripts/provision-identity.ps1 -ServicesRoot .workspace/04-sso/services -WorkspaceRoot .workspace/04-sso/runtime -ApiOrigin '<printed Core origin>'
```

The prompt reads a private password securely and sends JSON over stdin; values are never
printed or passed on the command line. Existing secrets remain unchanged. The helper uses
private modules from the exact installed published Core package, with a version guard.
Install/configure/start Certificates, PostgreSQL and Identity through Admin. Operator CA
trust is an explicit prerequisite: approve trust for this isolated local CA in the browser/OS
yourself; the lesson does not mutate shared trust stores. Identity must expose a trusted HTTPS
issuer whose discovery metadata matches its actual origin, normally `https://localhost:18084`.

In Identity register a **Web PKCE** client with the actual Todo callback/logout URLs and
a **Basic API** client for token introspection, both in the same project. Keep the API secret
in an absolute private file outside this checkout and outside any bundle. Retain its access
permissions. Record the public Web ID, project audience and API client ID.

Install Todo through Admin to acquire its verified archive. Find its artifact directory
in Admin's safe lifecycle metadata. Use that archive's `configure-sso.mjs`:

```sh
node lessons/04-sso/scripts/configure-pair.mjs '<acquired Todo artifact>/configure-sso.mjs' enable https://localhost:18084 '<Web client ID>' '<Project ID>' '<API client ID>' '<absolute private secret file>' '<absolute public rootCA.pem>'
```

The producer helper preserves storage/env capabilities and configures both sides. The wrapper
enables App/API only after all paired values and CA path exist. Refresh Admin and start them.
Stop the management host and run `npm run lesson:04` for the paired checkpoint. Missing,
partial, mismatched or anonymous configuration is rejected. Test actual login, logout,
session expiry, invalid issuer/audience, API anonymous rejection and dependency recovery.
Mocks cannot establish this provider boundary.

For an explicit reversible disable, stop both services and invoke the same wrapper with
`<helper> disable`. It uses the acquired paired helper, retains data and marks App/API disabled
again. This checkpoint never silently falls back to anonymous operation.
