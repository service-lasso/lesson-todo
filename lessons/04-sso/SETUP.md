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
Refresh Admin and install Certificates, PostgreSQL and Identity. Keep Broker ready.
Provision the stable Identity master key and initial admin password through real Broker IPC:

```sh
node lessons/04-sso/scripts/provision-identity-prompt.mjs .workspace/04-sso/services .workspace/04-sso/runtime '<printed Core origin>'
```

The Node prompt works in an interactive Windows, macOS or Linux terminal. Input is hidden; Enter submits and Ctrl+C cancels. The existing PowerShell wrapper remains available for Windows operators. The prompt sends private JSON over child stdin; values are never
printed or passed on the command line. Existing secrets remain unchanged. The helper uses
private modules from the exact installed published Core package, with a version guard.
Configure Certificates in Admin and run **generate-pfx**, then **generate-key-cert**.
Preserve its CA, key and certificate under `.workspace/04-sso/services/@todo-certs/data/`.
Use the isolated Chrome procedure below for this local certificate; retain the private CA key. The lesson does not mutate shared trust stores.

Type `shutdown` to stop the management host. In the same PowerShell terminal, give Node
the public CA before restarting the host:

```powershell
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path .workspace/04-sso/services/@todo-certs/data/rootCA.pem).Path
npm run lesson:04 -- --management
```

On macOS/Linux, from the repository root, use a process-local environment value (repeat it for every management or paired host launch):

```sh
NODE_EXTRA_CA_CERTS="$(pwd)/.workspace/04-sso/services/@todo-certs/data/rootCA.pem" npm run lesson:04 -- --management
```

Keep that environment setting for subsequent paired launches. Core health checks and the
managed App need it to verify Identity's HTTPS certificate. Complete the private prompt
against the new printed Core origin if secrets have not yet been provisioned.
Configure PostgreSQL and Identity, then start PostgreSQL followed by Identity through Admin.
Confirm healthy discovery metadata at its actual origin, normally `https://localhost:18084`.

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

## Isolated Chrome on macOS

Close any previous Chrome window using this lesson profile. In Terminal, derive the
SPKI SHA-256 from the generated leaf certificate, then open a dedicated profile.
This pins only this certificate key in this Chrome process; it does not install a
CA in macOS Keychain or change your everyday Chrome profile. Regenerate the pin if
you regenerate the leaf key. Do not use an ignore-all-certificates option.

```sh
TODO_CERT="$PWD/.workspace/04-sso/services/@todo-certs/data/mkcert.pem"
TODO_SPKI=$(openssl x509 -in "$TODO_CERT" -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl base64 -A)
test -n "$TODO_SPKI" || exit 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir="$PWD/.workspace/04-sso/browser-profile" --ignore-certificate-errors-spki-list="$TODO_SPKI" '<actual Identity console URL>'
```

Use this same isolated browser for the Todo login/callback/logout flow. Read the
actual Identity origin in Admin rather than copying a port from another run. The
Core API origin, Identity HTTPS origin and Todo callback origin are different
endpoints. Supply the resolved Identity issuer to the paired helper. Keep the
Basic API credential in the protected private file required by that helper,
outside this checkout; never put its value in a command argument or manifest.
The profile and all runtime/certificate/private credential state stay untracked.