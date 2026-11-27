# Milestone 2 run log

- 2026-11-27: a subagent broke Milestone 2 into tickets #22–#32, as sub-issues of #2, using `anthropic-skills:to-tickets`. They were labelled `needs-triage`, with about 60 open questions between them.
- 2026-11-27: the user said "Pick sensible defaults and mark them ready-for-agent". A subagent was given that job, with this order for choosing defaults: plan/spec, then consistency with M1, then Things 3, then the smallest scope. The decisions are recorded on each ticket.
- 2026-11-27: friction while creating the tickets: `issue_write` at first said the `needs-triage` label didn't exist, then it worked on retry. Reading #2's sub-issues through the MCP tool returned about 300K characters. Also, `docs/agents/issue-tracker.md` describes a top-of-body `Blocked by:` line, but the M1 tickets use a `## Blocked by` section.

Related: [Milestone 1 run log](milestone-1.md).
