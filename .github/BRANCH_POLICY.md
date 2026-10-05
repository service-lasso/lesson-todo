# Development workflow

Use current develop, typed issue branches, pushed commits and reviewed PRs.
Never use main as development input. CI and independent source review precede
landing. Source examples, native builds, public documentation and GA are
separate claims. Repo creation bootstrap came from the authorised template;
subsequent product changes never push directly to develop.

GitHub protects develop with required `test` and `desktop` checks, an up-to-date
branch requirement, pull requests, and disabled force pushes/deletions. Landing
uses squash merges. Independent source review is recorded on the pull request.
