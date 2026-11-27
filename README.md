# MyThings

A personal task manager built with React Native and Expo. See `CLAUDE.md` for the code layout and commands.

## UI checks

`npm run test:ui` builds the web version and runs the Playwright checks in `e2e/` at iPhone size.
If Playwright cannot download its own browser (as in cloud sessions), point it at an installed Chrome:

```bash
CHROME_PATH=/usr/bin/google-chrome npm run test:ui
```
