// app.json holds the app config. This file only adds a base path for web builds served from a
// subpath, such as GitHub Pages at /My-Things-1/ (.github/workflows/pages.yml):
//   EXPO_BASE_URL=/My-Things-1 npx expo export --platform web
// Without EXPO_BASE_URL the config is app.json unchanged, served at the site root.
// https://docs.expo.dev/versions/v58.0.0/config/app/#baseurl
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
