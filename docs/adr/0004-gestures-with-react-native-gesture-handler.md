# Gestures use react-native-gesture-handler, not PanResponder

Swiping a To-do, dragging to reorder or move, dragging Magic Plus and sliding down the list edge to select were first written by hand with React Native's PanResponder. Each one had to be created once and then read the latest props through a ref, which lint flags, so the same workaround was copied four times. PanResponder also takes part in the JavaScript responder system, so it competed with Pressable for the same touch, and on the web the row took over the swipe. We replaced all of them with react-native-gesture-handler, which recognizes gestures on the native side and lets one gesture cancel another. It is one of Expo Go's bundled native modules, so ADR 0003 allows it. New gestures use it too, and ESLint rejects PanResponder in the app code.

## Consequences

The app root is wrapped in GestureHandlerRootView, which gesture-handler needs. Gesture callbacks run on the JavaScript thread, because react-native-reanimated is not installed. On the web, gesture-handler does not take part in react-native-web's responder system, and Pressable presses on the click event. A drag handle is therefore a Pressable that does nothing, so its click does not reach the row, and a row ignores the click that ends a swipe.
