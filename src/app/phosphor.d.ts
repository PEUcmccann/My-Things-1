// phosphor-react-native passes className to Svg (used on the web), which
// react-native-svg's types leave out. Its README asks apps to add it, so the
// per-icon files in src/app/components/Icon.tsx type-check.
import "react-native-svg";

declare module "react-native-svg" {
  interface SvgProps {
    className?: string;
  }
}
