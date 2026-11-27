import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import type { SeriesScope } from "../core";
import { SeriesScopeChoice } from "./components/SeriesScopeChoice";
import { useMyThings } from "./state";

/**
 * Asks "this one or all future ones" when any of the To-dos repeats, then calls
 * `then` with the answer, or with null straight away when none of them repeats.
 * Backing out calls `onBackOut` instead.
 */
type AskScope = (
  ids: string[],
  then: (scope: SeriesScope | null) => void,
  onBackOut?: () => void,
) => void;

const Context = createContext<AskScope | null>(null);

interface Asking {
  then: (scope: SeriesScope) => void;
  onBackOut?: () => void;
}

/**
 * Every edit to a field the next occurrence of a repeating To-do copies goes through
 * here, so no editor can skip the question: the detail, bulk actions and row menus
 * all use `useAskSeriesScope()` or `useSeriesEdit()`.
 */
export function SeriesScopeProvider({ children }: { children: ReactNode }) {
  const app = useMyThings();
  const [asking, setAsking] = useState<Asking | null>(null);
  // Read from callbacks, so a second edit while the question is open is ignored.
  const open = useRef(false);

  const ask = useCallback<AskScope>(
    (ids, then, onBackOut) => {
      if (!ids.some((id) => app.findToDo(id) && app.asksThisOneOrAllFuture(id))) {
        then(null);
        return;
      }
      if (open.current) return;
      open.current = true;
      setAsking({ then, onBackOut });
    },
    [app],
  );

  const answer = (scope: SeriesScope) => {
    const then = asking?.then;
    open.current = false;
    setAsking(null);
    // iOS cannot show another sheet (a picker) while this one is still sliding away.
    if (Platform.OS === "ios") setTimeout(() => then?.(scope), 450);
    else then?.(scope);
  };
  const backOut = () => {
    const onBackOut = asking?.onBackOut;
    open.current = false;
    setAsking(null);
    onBackOut?.();
  };

  return (
    <Context.Provider value={ask}>
      {children}
      <SeriesScopeChoice visible={asking !== null} onChoose={answer} onBackOut={backOut} />
    </Context.Provider>
  );
}

export function useAskSeriesScope(): AskScope {
  const ask = useContext(Context);
  if (!ask) throw new Error("useAskSeriesScope must be used inside SeriesScopeProvider");
  return ask;
}

/**
 * Makes an edit that changes fields the next occurrence copies on the To-dos `ids`,
 * asking first when any of them repeats and applying the answer to each.
 */
export function useSeriesEdit(): (ids: string[], change: () => void) => void {
  const app = useMyThings();
  const ask = useAskSeriesScope();
  return (ids, change) =>
    ask(ids, (scope) => (scope ? app.editOccurrences(ids, scope, change) : change()));
}
