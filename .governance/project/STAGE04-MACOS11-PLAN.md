# Issue #9 — qualified Stage 04 Intel macOS 11 consumption

Development mode; preparation only. Base: develop
`3b8b3acf388d275d76df6afc5c28afacb4795102`. No product pins or runtime
behavior change is authorized by this preparation artifact.

## Required producer handoff

Before implementation, the coordinating parent must provide the actual public
qualified ZITADEL tag/full source SHA, immutable published profile bytes and
SHA-256, checksum inventory/asset names and direct native issue #18 receipt.
Verify the tag/asset identity against that receipt. A pending build, private
candidate or expected tag cannot supply product inputs. Until then, preserve
Stage 04's legacy ZITADEL macOS >=12 rejection. This document contains no
placeholder producer manifest or compatibility hash.

## Existing boundaries and bounded extension

`scripts/lesson.mjs` selects retained manifests first, rejects unknown macOS
versions/CPU architectures, and chooses the exact Broker Intel profile only for
fresh x64 state. Node 24 retention still requires 13.5. Stage 04 currently
rejects macOS 11 when ZITADEL is present.

`src/services-root.js` admits only a static per-service profile whitelist inside
the owned profile root. It rejects linked sources/ancestors, requires a plain
file, hashes and parses the same buffer, checks service ID/repository/tag against
the curated seed, then overlays only `artifact`. Complete seed/destination
preflight precedes writes; manifest creation uses `wx` or `COPYFILE_EXCL`.
Core-owned acquired `.state` contents remain outside traversal and replacement.

Extend these existing controls with a single exact qualified ZITADEL entry.
Fresh Intel macOS 11 selection must require the exact qualified source/tag,
profile hash and compatibility asset, and the matching qualified Broker
profile. Default/ARM retains macOS >=12; unknown architectures fail closed.
Do not infer minimum OS from a filename alone, allow arbitrary profile paths,
disable the platform guard, or rewrite retained legacy manifests. Retained
legacy ZITADEL remains >=12. A retained Intel-only profile rejects ARM.

Producer manifests remain provenance inputs. Only producer `artifact` may
overlay the curated lesson seed; keep HTTPS/TLS, database name/DSN,
certificates, BrokerRefs, executable command, environment, endpoints and
readiness policy. Pin the fresh curated inventory only after qualification.
Keep Todo `2026.10.4-15dc4b9`, API `2026.10.4-02ef566`, managed Node
`2026.10.5-4b473fb` and Broker `2026.10.5-301b426`; no downgrades.

`configure-identity.mjs` must require the same exact qualified tag, preserve
its already validated chosen unprivileged port, and retain HTTPS configuration.
Do not broaden the exact release guard. Keep private API client credentials in
the required 0600 file, use the acquired paired helper, and preserve private
stdin provisioning and isolated browser/process trust. Update helper paths,
resolved-port instructions and platform READMEs together with the real pins.

## Verification and landing gates

Preserve existing protected tests. Add conditional fresh Intel 11 success,
legacy retained rejection/no mutation, ARM/default >=12, unknown CPU/version,
bad/missing/hash-mismatched profile, external/link/ancestor boundary and
artifact-only curated configuration checks. Check retained credentials,
manifests and acquired links after rerun. Exact-tag helper rejection and chosen
port preservation need direct coverage.

After implementation, freeze the exact PR head, run CI, obtain a fresh distinct
reviewer and perform the actual literal Stage 04 Mac instructions against the
exact qualified public bytes in an isolated owned workspace. Capture setup,
Broker initialization, TLS readiness, paired login/API authorization, CRUD,
shutdown/restart and retained IDs; keep private secret receipts separate.
Producer issue #18 proof, lesson fixtures, native consumer acceptance and docs
publication are independent claims. Publish the corresponding Core article
only through its governed authorized flow and verify the live content.

This preparation PR does not close issue #9, claim native SSO acceptance,
declare release readiness or change product pins. Keep the worktree while its
PR is open; one writer owns it. Resume only with the required producer handoff.
