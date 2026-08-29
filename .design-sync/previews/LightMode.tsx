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
      <PercentileBar label="Pass Completion" value={0.87} percentile={78} />
      <PercentileBar label="Dribbles per 90" value={0.94} percentile={27} />
      <PercentileBar label="Shots on Target" value={1.84} percentile={72} />
    </>
  );
}

export function Default() {
  return (
    <div style={{ padding: 24 }}>
      <LightMode>
        <div style={surface("#f5f5f5")}>
          <Stats />
        </div>
      </LightMode>
    </div>
  );
}

export function AgainstDarkMode() {
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
