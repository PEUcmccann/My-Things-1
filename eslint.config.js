// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

// Words GLOSSARY.md tells us to avoid, so the code speaks the same language as the app.
const avoidedTerms = "task|label|dueDate|backlog|perspective|recurrence|geofence|alarm";

// Avoided words in text people read in the app. "Checklist item" is a glossary term, so it passes.
const avoidedText = "/(?<!checklist )\\b(task|label|item)s?\\b/i";
const textMessage =
  "Use the GLOSSARY.md term in app text (To-do, not task or item; Tag, not label).";

// Emoji, and the symbols once used as icons, in app text. Icons come from components/Icon.tsx.
const emoji = "/[\\p{Extended_Pictographic}\\u2691\\u25A3\\u25D4\\uFF0B]/u";
const emojiMessage = "Use the Icon component (src/app/components/Icon.tsx), not emoji or symbols.";
const noEmoji = [
  { selector: `JSXText[value=${emoji}]`, message: emojiMessage },
  { selector: `Literal[value=${emoji}]`, message: emojiMessage },
  { selector: `TemplateElement[value.raw=${emoji}]`, message: emojiMessage },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*", ".claude/skills/*", ".claude/worktrees/*"],
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
  {
    // Gestures use react-native-gesture-handler (docs/adr/0004).
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["PanResponder"],
              message:
                "Use react-native-gesture-handler for gestures, not PanResponder (docs/adr/0004).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `JSXText[value=${avoidedText}]`, message: textMessage },
        // Any string with a space reads as prose; one-word strings count only as JSX attributes
        // (placeholder, title...), so code values like kind: "item" and test IDs pass.
        { selector: `Literal[value=/\\s/][value=${avoidedText}]`, message: textMessage },
        {
          selector: `JSXAttribute[name.name!='testID'] > Literal[value=/^\\S+$/][value=${avoidedText}]`,
          message: textMessage,
        },
        ...noEmoji,
      ],
    },
  },
  {
    files: ["src/app/**/*.ts"],
    rules: { "no-restricted-syntax": ["error", ...noEmoji] },
  },
]);
