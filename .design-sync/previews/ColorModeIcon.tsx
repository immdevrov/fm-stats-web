import { ColorModeIcon } from "fm-stats-web";

const row: React.CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
  padding: 24,
};

export function Default() {
  return (
    <div style={{ ...row, fontSize: 24 }}>
      <ColorModeIcon />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={row}>
      <span style={{ fontSize: 14, display: "inline-flex" }}><ColorModeIcon /></span>
      <span style={{ fontSize: 20, display: "inline-flex" }}><ColorModeIcon /></span>
      <span style={{ fontSize: 28, display: "inline-flex" }}><ColorModeIcon /></span>
      <span style={{ fontSize: 40, display: "inline-flex" }}><ColorModeIcon /></span>
    </div>
  );
}

export function InlineWithLabel() {
  return (
    <div style={{ ...row, fontSize: 15, fontFamily: "system-ui, sans-serif" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <ColorModeIcon />
        Current colour mode
      </span>
    </div>
  );
}
