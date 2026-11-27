# Milestone 2 run log

- 2026-11-27: a subagent broke Milestone 2 into tickets #22–#32, as sub-issues of #2, using `anthropic-skills:to-tickets`. They were labelled `needs-triage`, with about 60 open questions between them.
- 2026-11-27: the user said "Pick sensible defaults and mark them ready-for-agent". A subagent was given that job, with this order for choosing defaults: plan/spec, then consistency with M1, then Things 3, then the smallest scope. The decisions are recorded on each ticket.
- 2026-11-27: friction while creating the tickets: `issue_write` at first said the `needs-triage` label didn't exist, then it worked on retry. Reading #2's sub-issues through the MCP tool returned about 300K characters. Also, `docs/agents/issue-tracker.md` describes a top-of-body `Blocked by:` line, but the M1 tickets use a `## Blocked by` section.

Related: [Milestone 1 run log](milestone-1.md).

- 2026-11-27: the defaults subagent answered every open question and relabelled #22–#32 `ready-for-agent`. The decisions are on each ticket under "Decisions (defaults chosen 2026-11-27)". The ones with most effect on behaviour: a repeating To-do always has a Start date (#25); the next repeat date comes after the later of the old Start date and today, and Cancel also creates the next one (#25); repeat rules are a tested hand-written subset, not the `rrule` package, which had had no release since 2023-11 and was about 690 kB (#25); a bare "evening" in quick entry no longer means This Evening (#32); Today's header shows a total Estimate (#22, scope added).
- 2026-11-27: the user hadn't reviewed these defaults as of when they were relayed. PR #33 (gestures, the Pages web app, the README) was merged as `0acbdb8` the same day.
- 2026-11-27: the user said "Go in milestone 2" and asked for the live web link to be used for testing. `peucmccann.github.io` was added to the "My-Things-1" environment, and a Playwright smoke test at iPhone size loaded the live app with no errors.
- 2026-11-27: `implement-spec` was run from the chief-of-staff session itself, as the skill change `55d0000` requires. The integration branch was `claude/vigilant-bell-8qo0i5`, starting from `2576c69`. `2576c69` itself added `UI_PORT`, so that implementers in parallel worktrees don't collide on port 8081. The first frontier was #22 and #23, each with an implementer in its own worktree, using `UI_PORT=81<ticket>`.
