# Web app on GitHub Pages

- On 2026-11-27 the user asked for a way to run the app without a laptop. The chief of staff chose a static web build on GitHub Pages, added to the iPhone Home Screen. The app keeps its data on the device and has no server, so a static site is enough. Running in Expo Go through EAS Update was held back because it needs an Expo account.
- As of the commit that added it (`c9f858c` on `claude/vigilant-bell-8qo0i5`): `.github/workflows/pages.yml` deploys on every push to `main`; `app.config.js` sets `experiments.baseUrl` from `EXPO_BASE_URL`; and `public/index.html` plus `public/manifest.json` hold the Home Screen meta tags and icons.
- Caveats noted on 2026-11-27: the repository is private, so Pages needs a paid GitHub plan, and the user's plan hadn't been checked. The user has to set Settings → Pages → Source to "GitHub Actions" once. Data is per browser. The README gives Netlify or Cloudflare Pages as the fallback.
- The README was rewritten the same day (`96d223c`).

Related: [Cloud environment](../subsystems/cloud-environment.md).
