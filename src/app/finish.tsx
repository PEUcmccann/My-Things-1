import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { MenuSheet } from "./components/MenuSheet";
import { haptics } from "./haptics";
import { useMyThings } from "./state";

type Outcome = "completed" | "cancelled";
type Finish = (id: string, outcome: Outcome) => void;

const Context = createContext<Finish | null>(null);

/**
 * Completing or cancelling a To-do with open Sub-to-dos asks whether to complete
 * or cancel the rest. Screens call `useFinishToDo()` instead of the core directly.
 */
export function FinishProvider({ children }: { children: ReactNode }) {
  const app = useMyThings();
  const [asking, setAsking] = useState<{ id: string; outcome: Outcome } | null>(null);

  const finish = useCallback<Finish>(
    (id, outcome) => {
      if (app.openSubToDoCount(id) > 0) {
        setAsking({ id, outcome });
        return;
      }
      if (outcome === "completed") app.complete(id);
      else app.cancel(id);
      haptics.success();
    },
    [app],
  );

  const apply = (remaining: "complete" | "cancel") => {
    if (!asking) return;
    if (asking.outcome === "completed") app.complete(asking.id, { remaining });
    else app.cancel(asking.id, { remaining });
    haptics.success();
  };

  return (
    <Context.Provider value={finish}>
      {children}
      <MenuSheet
        visible={asking !== null}
        title={asking?.outcome === "completed" ? "Complete To-do" : "Cancel To-do"}
        message={asking ? `It still has ${app.openSubToDoCount(asking.id)} open Sub-to-do(s).` : ""}
        onClose={() => setAsking(null)}
        options={[
          {
            title: "Complete all remaining",
            onPress: () => apply("complete"),
            testID: "remaining-complete",
          },
          {
            title: "Cancel all remaining",
            onPress: () => apply("cancel"),
            testID: "remaining-cancel",
          },
        ]}
      />
    </Context.Provider>
  );
}

export function useFinishToDo(): Finish {
  const finish = useContext(Context);
  if (!finish) throw new Error("useFinishToDo must be used inside FinishProvider");
  return finish;
}
