import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BackHandler } from "react-native";

/** The built-in lists, in sidebar order. */
export const builtInLists = [
  "inbox",
  "today",
  "upcoming",
  "anytime",
  "someday",
  "logbook",
  "trash",
] as const;
export type BuiltInList = (typeof builtInLists)[number];

export type Route =
  | { name: "sidebar" }
  | { name: "list"; list: BuiltInList }
  | { name: "settings" }
  | { name: "toDo"; id: string }
  | { name: "area"; id: string }
  | { name: "project"; id: string }
  | { name: "tags" }
  | { name: "tag"; id: string }
  | { name: "quickFind" };

interface Navigation {
  route: Route;
  canGoBack: boolean;
  push(route: Route): void;
  /** Replaces the whole stack, as when choosing from the sidebar on a wide screen. */
  reset(route: Route): void;
  back(): void;
}

const Context = createContext<Navigation | null>(null);

export function NavigationProvider({ root, children }: { root: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([root]);
  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const reset = useCallback(
    (route: Route) => setStack(route.name === root.name ? [root] : [root, route]),
    [root],
  );
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length <= 1) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const value = useMemo(
    () => ({ route: stack[stack.length - 1], canGoBack: stack.length > 1, push, reset, back }),
    [stack, push, reset, back],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNavigation(): Navigation {
  const nav = useContext(Context);
  if (!nav) throw new Error("useNavigation must be used inside NavigationProvider");
  return nav;
}
