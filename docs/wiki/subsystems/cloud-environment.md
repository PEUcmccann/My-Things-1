# Cloud environment

- On 2026-11-27, with the user's approval, the chief-of-staff session created a personal cloud environment named "My-Things-1", saved for `PEUcmccann/My-Things-1`. It has limited network access: package registries, MCP servers, `docs.expo.dev`, `api.expo.dev` and `reactnative.directory`. Before that, sessions ran on the user's Default environment, where `npx expo install` and the Expo docs were blocked.
- On 2026-11-27, once that environment was in place, `npx expo install react-native-gesture-handler` worked first time. `curl` could reach `docs.expo.dev`, but the WebFetch tool couldn't (a DNS error), and `docs.swmansion.com` (gesture-handler's own docs) was blocked with a 403. The environment had no setup script.
- On 2026-11-27, running two agents' Playwright checks at once collided on port 8081, because the Playwright config reuses an already-running server outside CI.

Related: [Cloud session friction](../problems/cloud-session-friction.md).
