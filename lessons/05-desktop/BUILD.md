# Native build inventory

From the root, on Windows x64 with Node 22, Rust stable MSVC, Visual Studio C++ build tools
and the Windows SDK: `npm ci`, then `npm run desktop:build`.

`build.mjs` verifies [template-source.json](template-source.json), extracts the exact archive
under ignored `.native/lesson-05`, supplies this folder's complete service inventory, runs
the template's locked dependency install and executes `npm run desktop:build`. The Windows
workflow calls this same root command and retains executables and the source/build receipt.

| Owned build input | Exact source location |
| --- | --- |
| Complete service inventory | `lessons/05-desktop/services` |
| Source and checksum binding | `template-source.json` |
| Build command | `build.mjs` |
| Rust entrypoint and native sidecar shutdown | Exact archive `src-tauri/src/main.rs` |
| Cargo manifest and lock | Exact archive `src-tauri/Cargo.toml`, `Cargo.lock` |
| Windows app settings and bundled resources | Exact archive `src-tauri/tauri.conf.json` |
| Desktop bootstrap page | Exact archive `desktop/` |
| Node host, Admin routing and payload scripts | Exact archive `src/`, `scripts/` |
| Locked npm/Core/Tauri CLI | Exact archive `package.json`, `package-lock.json` |

Every build uses a new verified extraction, preserving all previous build trees and rejecting
cached-source reuse. Output lives in `.native/lesson-05/build-<UUID>/app/src-tauri/target/release`;
NSIS installers are under `bundle/nsis`. The template packages its Node host with the real
published Core and verified Admin payload. It uses its native app-owned runtime state and
copy-once seeds, preserving existing SSO on rerun. A fresh lesson 05 inventory is explicitly
anonymous local mode; optional identity requires lesson 04's actual provider prerequisites.
Do not place credentials or runtime state in the build project. The build refuses a project
containing `.workspace`. Native compilation proves executable production only; WebView SSO,
installer interaction, sign-in, CA trust and server acceptance need separate direct evidence.
The source/output receipt is `.native/lesson-05/build-receipt.json`. CI requires both the
native executable and NSIS installer before uploading; a receipt alone cannot pass.
The archive's enclosing directory is stripped into `app` to keep Windows linker paths short;
all project-relative source bytes remain bound to the exact recorded archive digest.
