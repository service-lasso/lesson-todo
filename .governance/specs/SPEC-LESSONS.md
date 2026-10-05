# Five runnable Todo checkpoints — issue #1 / Core #1695

- LESSON-1: Each numbered folder contains a complete app-owned service inventory,
  README, article URL, purpose-first Mermaid diagram, previous/next links and
  exact service source/release references. Baseline support services are
  consistent; canonical runtimes are consumed from pinned release archives.
- LESSON-2: Root setup/run commands select a lesson explicitly, work from a fresh
  clone with pinned Core/Admin and no sibling builds, bind loopback and use
  isolated ignored per-lesson workspace/registry paths. Setup never overwrites
  existing manifests, credentials or data; shutdown affects only owned services.
  Issue #5: setup writes only seed paths without replacing files. Reject seed
  links, destination links/junctions and linked ancestors before any copy.
  Service-level `.state` must be a plain directory; its Core-owned acquired
  contents are retained without traversal, except paths explicitly in the seed.
- LESSON-3: Stage1 persists JSON; Stage2 owns PostgreSQL and migrates explicitly;
  Stage3 delegates SQL to the managed Go API. Real startup, create/read,
  stop/restart, outage recovery and retained IDs support runnable claims.
  Issue #5: acquired artifact links must survive setup reruns and public host
  restart without flattening, rewriting or deleting producer-owned state.
- LESSON-4: Stage4 adds identity, dedicated certificates and Broker provisioning,
  uses acquired paired configuration helper and private credential paths, and
  rejects partial/anonymous SSO configuration. Real provider proof remains
  separate from fixtures. Unconfigured stage4 may run management for setup but
  cannot start unprotected Todo/API behind an SSO-labelled checkpoint.
- LESSON-5: Stage5 uses the exact Tauri template to build a Windows executable
  with the managed stack; preserve source template provenance and service pins.
  Do not bundle runtime state or credentials. Fresh desktop mode follows the
  article's explicit local anonymous seed; optional identity and native WebView
  qualification are clearly distinguished and existing SSO is never downgraded.
- LESSON-6: Preserve inherited protected tests; add meaningful setup/retention and
  lesson contract checks, independent review, exact fresh managed acceptance and
  native build evidence. Publish source via reviewed develop PR, then five Core
  article links through its reviewed PR and explicit Pages/live validation.
  Issue #5: preserve the inherited junction/retention gates; add acquired-link
  and seed/destination escape coverage, plus exact-candidate Mac setup/restart
  proof. Platform prerequisites and full managed stack acceptance stay distinct.

- LESSON-2/3/6, issue #3: Fresh inventories pin managed Node 22.23.3 from
  exact producer source/tag. Require macOS >=12 for the complete Broker stack
  before setup writes/downloads or managed launch; retained Node 24 pins require
  >=13.5 and are never silently replaced. Node binary macOS >=11 compatibility
  does not qualify the complete stack or EOL production support. Published
  tag/commit identity, checksums and exact consumer startup/CRUD/restart proof
  remain required before a working managed-provider claim. Preserve Big Sur
  Node 24 and Broker failures as separate evidence.

Issue #4 / LESSON-4/6: Stage04 setup must be executable with Node on Windows and
POSIX terminals without requiring PowerShell. Private bootstrap input uses a
hidden interactive prompt and a child stdin pipe; abort/invalid input must not
launch provisioning. CA trust is process-local. Browser acceptance uses an owned
isolated Chrome profile pinned to the generated leaf SPKI, without OS trust-store
mutation. Identity configuration retains the selected published manifest port;
new producer pins require exact publication/checksum qualification before use.
