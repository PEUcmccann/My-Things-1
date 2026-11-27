# Implementer brief

The template the coordinator fills in for each ticket before handing it to an implementer agent. Replace every `<placeholder>`; `<integration>` is the branch the coordinator merges finished tickets into. Copy everything from **Brief** down.

## Brief

You are implementing ticket #<ticket> in a git worktree of this repo.

### Pointers

- **Ticket**: #<ticket>. Read its body and comments as in `docs/agents/issue-tracker.md`.
- **Spec**: #2, for the context the ticket sits in.
- **`CLAUDE.md`**: code layout, commands and working rules.
- **Relevant code**: <files and modules the ticket touches>.

### Definition of done

Done means every acceptance criterion and every Decision on the ticket is delivered. A scope note limits which code you may change, not what you deliver. If a scope note and a criterion or Decision conflict, ask the coordinator, or mark the item not done and say why. Never drop it silently.

### Steps

1. Confirm the worktree base: `git merge-base --is-ancestor <integration> HEAD`. If it fails, run `git reset --hard <integration>`.
2. Run `npm ci`.
3. Use the `anthropic-skills:tdd` skill to build the ticket test-first.
4. Run the checks: `npm test`, `npm run lint`, `npm run typecheck`, `npx prettier --check .`, `npm run check:expo` and `UI_PORT=81<ticket> npm run test:ui`.
5. Before reporting, run `git merge --no-commit <integration>`, resolve any conflicts, then `git commit -F <msg file>` with the attribution trailers. Re-run the checks.

### Rules

- Commit in the worktree branch only. No push, no PR, no issue comments, no edits to `docs/wiki/` or `.claude/`.
- Never skip tests or bypass hooks (`--no-verify`, `.skip`, `.only`).
- Open a file with Read before changing it with Edit.
- Run one git command per Bash call.
- Write commit messages to a file and commit with `git commit -F <file>`, ending with the attribution trailers.

### Report

- Worktree path and branch.
- Commits, one line each.
- Check results, one line each.
- A checklist of every acceptance criterion and Decision on the ticket, each marked **done** or **not done** with the reason.
- Judgement calls you made where the ticket was silent.
- Friction: anything in the repo, tools or brief that slowed you down.

## Coordinator

- Before merging, compare the report's checklist with the ticket itself, not with the report's summary. Send back any criterion or Decision that is not done or missing from the checklist.
- When frontier tickets share core files (`src/core/`), run them one after another rather than in parallel, merging each before starting the next.
