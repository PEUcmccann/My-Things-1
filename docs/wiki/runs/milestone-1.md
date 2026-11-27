# Milestone 1 run log

One dated entry per delegated ticket: outcome, commit or PR, friction, and whether it was retroed.

- 2026-11-27: run started from `PEUcmccann/My-Things-1@54fde57` on branch `claude/vigilant-bell-8qo0i5`. See [Run all of Milestone 1](../decisions/run-milestone-1.md).
- 2026-11-27: the user authorised unattended decisions, PRs and merges ([Unattended authority](../preferences/unattended-authority.md)). The M1 subagent was told to decide open questions itself and record them on the tickets.
- 2026-11-27: one subagent finished all 15 tickets in about 63 minutes (243 tool calls). Commits, in the order it did them: #4 `be5fc17`, #5 `34068f9`, #6 `1c94a93`, #8 `685f85e`, #14 `91064b5`, #7 `78d986e`, #9 `10d80c1`, #10 `9f23c8c`, #11 `beb5e2c`, #12 `c60494f`, #13 `acde8d5`, #15 `905a4b4`, #16 `9615588`, #17 `2056b74`, #18 `b22ff60`, then review fixes `6a87510`.
- 2026-11-27: verified by the chief of staff at `6a87510`: 215 Vitest tests, lint and typecheck pass; CI run 45925579353 was green. 17 Playwright checks at iPhone 13 size were reported by the subagent. Nothing was tried in Expo Go on a phone, and Android wasn't tried at all.
- 2026-11-27: merged as PR #20 (merge commit `7d900c9`). GitHub closed #4–#18 from the PR's closing keywords; #2 (the full spec) stays open for later milestones.
- 2026-11-27: the product decisions the subagent made are on each ticket's comments and summarised in PR #20's body. See [M1 product decisions](../decisions/m1-product-decisions.md).
- 2026-11-27: friction is in [Cloud session friction](../problems/cloud-session-friction.md). A retro on this session was delegated; a usage limit cut it off at about 02:30 UTC, and it was resumed at 04:18 UTC once the limit reset.
- 2026-11-27: retro done ([M1 build retro](../retros/2026-11-27-m1-build.md)). Fixes `afb975b`, `b9c3110`, `5982996` and `f3b5e66` went into a follow-up PR.
- 2026-11-27: the retro fixes and wiki pages were merged as PR #21 (merge commit `ce8e429`) after CI passed. The 2-hour check-in was deleted because the run was finished. Four offers are waiting on the user: [Open offers](../preferences/open-offers.md).
