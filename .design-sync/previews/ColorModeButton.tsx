import { ColorModeButton } from "fm-stats-web";

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 24,
};

export function Default() {
  return (
    <div style={row}>
      <ColorModeButton />
    </div>
  );
}

export function Variants() {
  return (
    <div style={row}>
      <ColorModeButton variant="ghost" />
      <ColorModeButton variant="outline" />
      <ColorModeButton variant="subtle" />
      <ColorModeButton variant="solid" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={row}>
      <ColorModeButton size="xs" variant="outline" />
      <ColorModeButton size="sm" variant="outline" />
      <ColorModeButton size="md" variant="outline" />
      <ColorModeButton size="lg" variant="outline" />
    </div>
  );
}
