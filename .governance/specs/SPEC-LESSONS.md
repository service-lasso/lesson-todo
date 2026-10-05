# Five runnable Todo checkpoints — issue #1 / Core #1695

- LESSON-1: Each numbered folder contains a complete app-owned service inventory,
  README, article URL, purpose-first Mermaid diagram, previous/next links and
  exact service source/release references. Baseline support services are
  consistent; canonical runtimes are consumed from pinned release archives.
- LESSON-2: Root setup/run commands select a lesson explicitly, work from a fresh
  clone with pinned Core/Admin and no sibling builds, bind loopback and use
  isolated ignored per-lesson workspace/registry paths. Setup never overwrites
  existing manifests, credentials or data; shutdown affects only owned services.
- LESSON-3: Stage1 persists JSON; Stage2 owns PostgreSQL and migrates explicitly;
  Stage3 delegates SQL to the managed Go API. Real startup, create/read,
  stop/restart, outage recovery and retained IDs support runnable claims.
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
