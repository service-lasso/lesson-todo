# Todo lesson repository

This repository is the application assembly for five progressive Service Lasso
articles. Read `.governance/project/PROJECT_INTENT.md` and
`.governance/specs/SPEC-LESSONS.md`, then the ordered gov-01 through gov-14 rules
under `.governance/rules/` before changes. Core-specific inherited release rule
links describe Core authority; this repo does not publish Core or declare GA.

Use current `develop` and typed issue branches only. Never inspect, fetch,
compare, branch from or target `main` for development. Every commit is pushed;
every change lands through a PR. Preserve protected inherited tests and retained
state. One writer owns each checkout. Fresh delegated workers/reviewers use
GPT-6.1 Sol at low reasoning effort. User instructions take precedence.

The upstream Node host template supplied the bootstrap. Canonical service source
stays in lasso-todo, lasso-todo-api, lasso-postgres and lasso-zitadel. This repo
owns lesson manifests, host/setup tooling, READMEs, tests and CI. Runtime state,
credentials, private CAs and databases are never committed. Source, fixture,
managed runtime, native compilation, native SSO and publication evidence remain
separate. Current work: issue #1, SPEC-LESSONS LESSON-1 through LESSON-6,
coordinated by Core #1695 / AC-4AJ.12.
