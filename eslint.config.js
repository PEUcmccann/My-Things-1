// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

// Words GLOSSARY.md tells us to avoid, so the code speaks the same language as the app.
const avoidedTerms = "task|label|dueDate|backlog|perspective|recurrence|geofence|alarm";

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*"],
  },
  {
    // The core holds every rule of the app and must run without a phone.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(react|react-native|expo)(-.*)?(/.*)?$|^@expo/|^expo-",
              message:
                "The core module must not depend on UI or Expo code. Put platform code behind an adapter.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `Identifier[name=/${avoidedTerms}/i]`,
          message:
            "Use the GLOSSARY.md term (e.g. To-do, not task; Tag, not label; Deadline, not due date).",
        },
      ],
    },
  },
]);
