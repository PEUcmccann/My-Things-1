import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigation } from "./navigation";

interface Selection {
  active: boolean;
  ids: string[];
  isSelected(id: string): boolean;
  /** Enters selection mode, optionally with a first item. */
  start(id?: string): void;
  toggle(id: string): void;
  add(id: string): void;
  /** Leaves selection mode and clears the selection. */
  clear(): void;
}

const Context = createContext<Selection | null>(null);

/** Multi-select of To-dos on the current screen. Changing screen clears it. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const { route } = useNavigation();
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [shownRoute, setShownRoute] = useState(route);
  if (shownRoute !== route) {
    // Leaving the screen leaves selection mode.
    setShownRoute(route);
    setActive(false);
    setIds([]);
  }

  const value = useMemo<Selection>(
    () => ({
      active,
      ids,
      isSelected: (id) => ids.includes(id),
      start(id) {
        setActive(true);
        setIds(id ? [id] : []);
      },
      toggle: (id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
      add: (id) => setIds((s) => (s.includes(id) ? s : [...s, id])),
      clear() {
        setActive(false);
        setIds([]);
      },
    }),
    [active, ids],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSelection(): Selection {
  const selection = useContext(Context);
  if (!selection) throw new Error("useSelection must be used inside SelectionProvider");
  return selection;
}
