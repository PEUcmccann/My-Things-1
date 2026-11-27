import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** How Today is shown: as a list, or as the day timeline. */
export type TodayView = "list" | "timeline";

interface TodayViewState {
  view: TodayView;
  setView(view: TodayView): void;
}

const Context = createContext<TodayViewState | null>(null);

/**
 * Keeps the Today view while moving between screens. It is not saved, so Today
 * shows the list each time the app starts.
 */
export function TodayViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<TodayView>("list");
  const value = useMemo(() => ({ view, setView }), [view]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTodayView(): TodayViewState {
  const state = useContext(Context);
  if (!state) throw new Error("useTodayView must be used inside TodayViewProvider");
  return state;
}
