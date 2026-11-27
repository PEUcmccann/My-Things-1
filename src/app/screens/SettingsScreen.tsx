import { Screen } from "../components/Screen";
import { Empty } from "../components/Empty";

export function SettingsScreen() {
  return (
    <Screen title="Settings" testID="screen-settings">
      <Empty text="No settings yet" />
    </Screen>
  );
}
