import { DarkMode, LightMode, PercentileBar } from "fm-stats-web";

const surface = (bg: string): React.CSSProperties => ({
  background: bg,
  padding: 16,
  borderRadius: 8,
  width: 400,
});

const label: React.CSSProperties = {
  font: "600 12px system-ui, sans-serif",
  letterSpacing: 0.4,
  textTransform: "uppercase",
  marginBottom: 8,
  opacity: 0.6,
};

function Stats() {
  return (
    <>
      <PercentileBar label="Goals per 90" value={0.61} percentile={91} />
      <PercentileBar label="Key Passes" value={1.32} percentile={48} />
      <PercentileBar label="Aerial Wins" value={0.41} percentile={12} />
    </>
  );
}

export function Default() {
  return (
    <div style={{ padding: 24 }}>
      <DarkMode>
        <div style={surface("#0f0f0f")}>
          <Stats />
        </div>
      </DarkMode>
    </div>
  );
}

export function AgainstLightMode() {
  return (
    <div style={{ display: "flex", gap: 16, padding: 24, flexWrap: "wrap" }}>
      <LightMode>
        <div style={surface("#f5f5f5")}>
          <div style={{ ...label, color: "#0f0f0f" }}>LightMode</div>
          <Stats />
        </div>
      </LightMode>
      <DarkMode>
        <div style={surface("#0f0f0f")}>
          <div style={{ ...label, color: "#fdf7f7" }}>DarkMode</div>
          <Stats />
        </div>
      </DarkMode>
    </div>
  );
}
