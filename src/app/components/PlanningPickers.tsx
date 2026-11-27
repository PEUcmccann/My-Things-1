import { useState } from "react";
import { formatEstimate, isValidEstimate, type Energy, type Priority } from "../../core";
import { energyNames, priorityMarks, priorityNames } from "../format";
import { MenuSheet } from "./MenuSheet";
import { PromptSheet } from "./PromptSheet";

interface Props<T> {
  visible: boolean;
  onChoose: (value: T) => void;
  onClose: () => void;
}

const priorityOrder: Priority[] = ["high", "medium", "low", "none"];

export function PriorityPicker({ visible, onChoose, onClose }: Props<Priority>) {
  return (
    <MenuSheet
      visible={visible}
      title="Priority"
      onClose={onClose}
      testID="priority-picker"
      options={priorityOrder.map((p) => ({
        title: p === "none" ? "None" : `${priorityMarks[p]}  ${priorityNames[p]}`,
        onPress: () => onChoose(p),
        testID: `priority-${p}`,
      }))}
    />
  );
}

export function EnergyPicker({ visible, onChoose, onClose }: Props<Energy | null>) {
  return (
    <MenuSheet
      visible={visible}
      title="Energy"
      onClose={onClose}
      testID="energy-picker"
      options={[
        { title: energyNames.high, onPress: () => onChoose("high"), testID: "energy-high" },
        { title: energyNames.low, onPress: () => onChoose("low"), testID: "energy-low" },
        { title: "None", onPress: () => onChoose(null), testID: "energy-none" },
      ]}
    />
  );
}

/** Quick choices for an Estimate, in minutes. */
const estimatePresets = [5, 10, 15, 30, 45, 60, 90, 120];

/** Presets, "Custom…" for any whole number of minutes, or none. */
export function EstimatePicker({ visible, onChoose, onClose }: Props<number | null>) {
  const [custom, setCustom] = useState(false);
  return (
    <>
      <MenuSheet
        visible={visible}
        title="Estimate"
        onClose={onClose}
        testID="estimate-picker"
        options={[
          ...estimatePresets.map((m) => ({
            title: formatEstimate(m),
            onPress: () => onChoose(m),
            testID: `estimate-${m}`,
          })),
          { title: "Custom…", onPress: () => setCustom(true), testID: "estimate-custom" },
          { title: "None", onPress: () => onChoose(null), testID: "estimate-none" },
        ]}
      />
      {custom ? (
        <PromptSheet
          title="Estimate in minutes"
          placeholder="e.g. 25"
          keyboardType="number-pad"
          validate={(text) =>
            /^\d+$/.test(text) && isValidEstimate(Number(text))
              ? null
              : "Enter a whole number of minutes, more than 0."
          }
          onSubmit={(text) => onChoose(Number(text))}
          onClose={() => setCustom(false)}
          testID="estimate-custom-prompt"
        />
      ) : null}
    </>
  );
}
