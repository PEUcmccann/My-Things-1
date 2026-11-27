import type { Destination } from "../../core";
import { useMyThings } from "../state";
import { MenuSheet, type MenuOption } from "./MenuSheet";

interface Props {
  visible: boolean;
  onChoose: (to: Destination) => void;
  onClose: () => void;
}

/** Chooses where to file To-dos: the Inbox, an Area or a Project. */
export function MovePicker({ visible, onChoose, onClose }: Props) {
  const app = useMyThings();
  const tree = app.sidebar();
  const projectOption = (id: string, title: string, depth: number): MenuOption => ({
    title: `◔ ${title}`,
    depth,
    onPress: () => onChoose({ kind: "project", id }),
    testID: `move-project-${id}`,
  });
  const options: MenuOption[] = [
    { title: "📥 Inbox", onPress: () => onChoose({ kind: "inbox" }), testID: "move-inbox" },
    ...tree.projects.map((p) => projectOption(p.id, p.title, 0)),
    ...tree.areas.flatMap(({ area, projects }) => [
      {
        title: `▣ ${area.title}`,
        onPress: () => onChoose({ kind: "area", id: area.id }),
        testID: `move-area-${area.id}`,
      },
      ...projects.map((p) => projectOption(p.id, p.title, 1)),
    ]),
  ];
  return (
    <MenuSheet
      visible={visible}
      title="Move to"
      options={options}
      onClose={onClose}
      testID="move-picker"
    />
  );
}
