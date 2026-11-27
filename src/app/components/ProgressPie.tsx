import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../theme";

/** A small ring that fills up as a Project's To-dos are Completed. */
export function ProgressPie({ share, size = 18 }: { share: number; size?: number }) {
  const theme = useTheme();
  const s = Math.max(0, Math.min(1, share));
  const r = size / 2;
  const inner = r - 3;
  const angle = s * 2 * Math.PI;
  const x = r + inner * Math.sin(angle);
  const y = r - inner * Math.cos(angle);
  const large = s > 0.5 ? 1 : 0;
  return (
    <Svg width={size} height={size} accessibilityLabel={`${Math.round(s * 100)}% complete`}>
      <Circle cx={r} cy={r} r={r - 1} stroke={theme.accent} strokeWidth={1.5} fill="none" />
      {s >= 1 ? (
        <Circle cx={r} cy={r} r={inner} fill={theme.accent} />
      ) : s > 0 ? (
        <Path
          d={`M ${r} ${r} L ${r} ${r - inner} A ${inner} ${inner} 0 ${large} 1 ${x} ${y} Z`}
          fill={theme.accent}
        />
      ) : null}
    </Svg>
  );
}
