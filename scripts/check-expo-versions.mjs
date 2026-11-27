// Fails if a dependency that Expo pins for this SDK uses a different version range.
// Expo's list is node_modules/expo/bundledNativeModules.json (what `npx expo install` picks).
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const pkg = read("../package.json");
const bundled = read("../node_modules/expo/bundledNativeModules.json");

const mismatches = [];
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    const expected = bundled[name];
    if (expected && range !== expected) mismatches.push({ field, name, range, expected });
  }
}

if (mismatches.length > 0) {
  console.error("These packages differ from the versions Expo expects for this SDK:");
  for (const m of mismatches) {
    console.error(`  ${m.name} (${m.field}): "${m.range}", expected "${m.expected}"`);
  }
  console.error(
    'Install the expected range with `npx expo install <package>`, or `npm install "<package>@<range>"`.',
  );
  process.exit(1);
}
console.log("Expo-pinned dependencies match bundledNativeModules.json.");
