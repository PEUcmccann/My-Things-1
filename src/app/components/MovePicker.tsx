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
  if (!visible) return null;
  const tree = app.sidebar();
  const projectOptions = (id: string, title: string, depth: number): MenuOption[] => [
    {
      title: `◔ ${title}`,
      depth,
      onPress: () => onChoose({ kind: "project", id }),
      testID: `move-project-${id}`,
    },
    ...app.headings(id).map((h) => ({
      title: `— ${h.title}`,
      depth: depth + 1,
      onPress: () => onChoose({ kind: "heading", id: h.id }),
      testID: `move-heading-${h.id}`,
    })),
  ];
  const options: MenuOption[] = [
    { title: "📥 Inbox", onPress: () => onChoose({ kind: "inbox" }), testID: "move-inbox" },
    ...tree.projects.flatMap((p) => projectOptions(p.id, p.title, 0)),
    ...tree.areas.flatMap(({ area, projects }) => [
      {
        title: `▣ ${area.title}`,
        onPress: () => onChoose({ kind: "area", id: area.id }),
        testID: `move-area-${area.id}`,
      },
      ...projects.flatMap((p) => projectOptions(p.id, p.title, 1)),
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
