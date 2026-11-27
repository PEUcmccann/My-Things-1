# MyThings

A personal task manager built with React Native and Expo. See `CLAUDE.md` for the code layout and commands.

## UI checks

`npm run test:ui` builds the web version and runs the Playwright checks in `e2e/` at iPhone size.
`@playwright/test` is pinned to the exact version whose Chromium is preinstalled in cloud sessions (`/opt/pw-browsers`), where Playwright cannot download a browser. Keep that pin when upgrading; elsewhere run `npx playwright install chromium` once.
