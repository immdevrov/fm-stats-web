import { Tooltip } from "fm-stats-web";

const frame: React.CSSProperties = { padding: 24, minHeight: 120, position: "relative" };
const trigger: React.CSSProperties = {
  font: "inherit",
  fontSize: 13,
  padding: "6px 12px",
  border: "1px solid #d4d4d4",
  borderRadius: 6,
  background: "#fafafa",
  cursor: "default",
};

export function Default() {
  return (
    <div style={frame}>
      <Tooltip content="Average match rating across the season" open portalled={false}>
        <button style={trigger}>Rating</button>
      </Tooltip>
    </div>
  );
}

export function WithArrow() {
  return (
    <div style={frame}>
      <Tooltip content="Percentile vs. players in the same role" open showArrow portalled={false}>
        <button style={trigger}>Press Ratio</button>
      </Tooltip>
    </div>
  );
}

export function Closed() {
  return (
    <div style={frame}>
      <Tooltip content="Shown on hover">
        <button style={trigger}>Hover me</button>
      </Tooltip>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={frame}>
      <Tooltip content="Never shown" disabled>
        <button style={trigger}>Tooltip disabled</button>
      </Tooltip>
    </div>
  );
}
