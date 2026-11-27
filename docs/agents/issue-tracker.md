# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `PEUcmccann/My-Things-1` (owner `PEUcmccann`, repo `My-Things-1`).

This repo is worked on from Claude Code cloud sessions, where the `gh` CLI can only be used for search. Use the GitHub MCP tools (`mcp__github__*`; load them with ToolSearch if they are deferred) for everything else.

## Conventions

- **Create an issue**: `issue_write` with `method: "create"`, `title`, `body` and optional `labels`.
- **Read an issue**: `issue_read` with `method: "get"` for the body and labels, and `method: "get_comments"` for comments.
- **List issues**: `list_issues` with `state` and `labels` filters.
- **Search issues**: `gh api -X GET search/issues -f q='repo:PEUcmccann/My-Things-1 is:issue <terms>'`.
- **Make an issue a sub-issue of a parent**: `sub_issue_write` with `method: "add"`, the parent's `issue_number` and the child's `sub_issue_id` (the child's database `id` from `issue_read`, not its `#number`). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `add_issue_comment`.
- **Apply / remove labels**: `issue_write` with `method: "update"` and the full new `labels` list.
- **Close**: `add_issue_comment` with the reason, then `issue_write` with `method: "update"`, `state: "closed"` and a `state_reason`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues: read them with `pull_request_read`, list them with `list_pull_requests`, and comment, label and close them with the issue tools above (pass the PR number as `issue_number`).

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: try `pull_request_read` and fall back to `issue_read`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: an issue linked to the map as a sub-issue (see above). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: the MCP tools here cannot set GitHub's native issue dependencies, so put a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every issue listed there is closed.
- **Frontier query**: list the map's open sub-issues (`sub_issue_write` / `issue_read` on the map), drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `issue_write` with `method: "update"` and `assignees`, the session's first write.
- **Resolve**: `add_issue_comment` with the answer, close the issue, then append a context pointer (gist + link) to the map's Decisions-so-far.
