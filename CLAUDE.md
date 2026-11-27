# MyThings

A personal task manager app built with React Native and Expo. The design decisions are in `docs/plan.md`, the vocabulary is in `GLOSSARY.md`, and the hard-to-reverse choices are in `docs/adr/`.

## Code layout

- `src/core/` is the core logic module: every rule from `docs/plan.md`, as actions and list queries. It must not import React, React Native or Expo (enforced by ESLint). The clock and storage are passed in.
- Core code must use `GLOSSARY.md` terms; ESLint rejects avoided words such as `task`, `label` and `dueDate` there.
- Tests for the core sit next to it as `*.test.ts` and go through actions and queries only, never internal records.

## Commands

```bash
npm test            # core tests (Vitest)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier
npm run test:ui     # Playwright UI checks on the web build at iPhone size
npx expo start      # dev server (Expo Go on the phone, or press w for web)
```

The pre-commit hook runs lint-staged (ESLint + Prettier), the typecheck and the tests. It rewrites staged files with Prettier, so re-read a file after committing before editing it, and prefer the Edit tool (it fails loudly when text doesn't match). CI (`.github/workflows/ci.yml`) also checks formatting across all files and the web build.

## Expo notes

- Expo SDK 58. Expo changes between SDK versions, so check the versioned docs at https://docs.expo.dev/versions/v58.0.0/ before using an Expo API, rather than relying on memory.
- Add packages with `npx expo install <package>`, which picks SDK-compatible versions. In cloud sessions the proxy blocks Expo's API, so that may fail; then install the version Expo asks for with npm.
- Only Expo Go's bundled native modules can be used (ADR 0003). Never create or edit `ios/` or `android/` by hand.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `PEUcmccann/My-Things-1`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
