# Cloud session friction

Problems agents hit in Claude Code cloud sessions on this repo.

- 2026-11-27: a background subagent started from the chief-of-staff session didn't have the Agent tool, so `implement-spec`'s parallel worktrees and two-agent review were done by one agent. Delegate work that needs fan-out from the chief-of-staff session itself.
- 2026-11-27: `npx expo install` failed because the proxy blocked Expo's API. The workaround was to install the versions listed in `node_modules/expo/bundledNativeModules.json` with npm, then fix the `^` ranges npm added.
- 2026-11-27: `docs.expo.dev` was blocked, so the SDK 58 docs that CLAUDE.md points to couldn't be read. The splash-screen and haptics code was written from the packages' type definitions.
- 2026-11-27: Playwright's browser download was blocked. The environment already has Chromium at `/opt/pw-browsers/chromium`.
- 2026-11-27: the coordinator and the subagent shared one working tree and branch. The coordinator's wiki commit (`9674a5a`) landed mid-run, and the subagent had to stage around `docs/wiki`. Stop-hook prompts to commit kept pointing at the subagent's unfinished files. Lesson: while a subagent is implementing, the coordinator doesn't commit to its tree; a worktree is the alternative.

Related: [Milestone 1 run log](../runs/milestone-1.md).
