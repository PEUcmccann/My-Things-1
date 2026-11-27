import type { Remaining } from "../../core";
import { MenuSheet } from "./MenuSheet";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onChoose: (remaining: Remaining) => void;
  onClose: () => void;
}

/** Asks "Complete all remaining" or "Cancel all remaining" for open To-dos left behind. */
export function RemainingChoice({ visible, title, message, onChoose, onClose }: Props) {
  return (
    <MenuSheet
      visible={visible}
      title={title}
      message={message}
      onClose={onClose}
      options={[
        {
          title: "Complete all remaining",
          onPress: () => onChoose("complete"),
          testID: "remaining-complete",
        },
        {
          title: "Cancel all remaining",
          onPress: () => onChoose("cancel"),
          testID: "remaining-cancel",
        },
      ]}
    />
  );
}
