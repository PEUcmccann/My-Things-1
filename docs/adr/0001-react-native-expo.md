# Cross-platform native app with React Native and Expo

MyThings is built with React Native and Expo rather than as a web app (PWA) or a SwiftUI iPhone app. A PWA could not deliver location reminders, widgets, the share sheet or a native feel on iPhone. SwiftUI would make the app Apple-only again, which is one of the limitations we set out to fix. Expo gives one TypeScript codebase for iPhone, Android and the web, and native features can still be added through Expo modules.

## Consequences

Widgets, an Apple Watch app and Siri need native Swift code beside the React Native code, so they cost more to build than the rest of the app.
