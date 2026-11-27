import type { Icon as PhosphorIcon } from "phosphor-react-native";
// One file per icon, so the bundle holds only the icons used here.
import { ArchiveIcon } from "phosphor-react-native/src/icons/Archive";
import { CalendarBlankIcon } from "phosphor-react-native/src/icons/CalendarBlank";
import { CalendarDotsIcon } from "phosphor-react-native/src/icons/CalendarDots";
import { ChartPieSliceIcon } from "phosphor-react-native/src/icons/ChartPieSlice";
import { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
import { CheckSquareIcon } from "phosphor-react-native/src/icons/CheckSquare";
import { CubeIcon } from "phosphor-react-native/src/icons/Cube";
import { DotsSixVerticalIcon } from "phosphor-react-native/src/icons/DotsSixVertical";
import { DotsThreeIcon } from "phosphor-react-native/src/icons/DotsThree";
import { FlagIcon } from "phosphor-react-native/src/icons/Flag";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { ListChecksIcon } from "phosphor-react-native/src/icons/ListChecks";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { MoonIcon } from "phosphor-react-native/src/icons/Moon";
import { NotePencilIcon } from "phosphor-react-native/src/icons/NotePencil";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { StackIcon } from "phosphor-react-native/src/icons/Stack";
import { StarIcon } from "phosphor-react-native/src/icons/Star";
import { TagIcon } from "phosphor-react-native/src/icons/Tag";
import { TrashIcon } from "phosphor-react-native/src/icons/Trash";
import { TrayIcon } from "phosphor-react-native/src/icons/Tray";
import { useTheme, type IconColours } from "../theme";

/** What each icon stands for in the app, and the Phosphor icon drawn for it. */
const icons = {
  inbox: TrayIcon,
  today: StarIcon,
  upcoming: CalendarDotsIcon,
  anytime: StackIcon,
  someday: ArchiveIcon,
  logbook: CheckSquareIcon,
  trash: TrashIcon,
  tags: TagIcon,
  tag: TagIcon,
  settings: GearSixIcon,
  quickFind: MagnifyingGlassIcon,
  add: PlusIcon,
  notes: NotePencilIcon,
  evening: MoonIcon,
  checklist: ListChecksIcon,
  deadline: FlagIcon,
  project: ChartPieSliceIcon,
  area: CubeIcon,
  when: CalendarBlankIcon,
  select: CheckCircleIcon,
  energy: LightningIcon,
  more: DotsThreeIcon,
  drag: DotsSixVerticalIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof icons;

/**
 * Plain marks whose fill versions sit in a filled square, which looks wrong inside
 * Magic Plus and beside rows. They use the bold weight instead.
 */
const boldMarks = new Set<IconName>(["add", "more", "drag"]);

interface Props {
  name: IconName;
  size?: number;
  /** Defaults to the list's own colour for a list, otherwise the text colour. */
  color?: string;
}

/** An icon from the app's one icon set (Phosphor, fill weight but for boldMarks). */
export function Icon({ name, size = 18, color }: Props) {
  const theme = useTheme();
  const Drawn = icons[name];
  const colour = color ?? theme.icons[name as keyof IconColours] ?? theme.text;
  return <Drawn weight={boldMarks.has(name) ? "bold" : "fill"} size={size} color={colour} />;
}
