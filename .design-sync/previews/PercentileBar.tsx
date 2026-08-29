import { PercentileBar } from "fm-stats-web";

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: 420,
  padding: 16,
};

export function Default() {
  return (
    <div style={stack}>
      <PercentileBar label="Pass Completion" value={0.87} percentile={78} />
    </div>
  );
}

export function StatProfile() {
  return (
    <div style={stack}>
      <PercentileBar label="Goals per 90" value={0.61} percentile={91} />
      <PercentileBar label="Shots on Target" value={1.84} percentile={72} />
      <PercentileBar label="Pass Completion" value={0.87} percentile={64} />
      <PercentileBar label="Key Passes" value={1.32} percentile={48} />
      <PercentileBar label="Dribbles per 90" value={0.94} percentile={27} />
      <PercentileBar label="Aerial Wins" value={0.41} percentile={12} />
    </div>
  );
}

export function ColourThresholds() {
  return (
    <div style={stack}>
      <PercentileBar label="Green (>60)" value={2.4} percentile={84} />
      <PercentileBar label="Yellow (30-60)" value={1.1} percentile={45} />
      <PercentileBar label="Red (<30)" value={0.3} percentile={18} />
    </div>
  );
}

export function Inverted() {
  return (
    <div style={stack}>
      <PercentileBar label="Press Ratio" value={6.2} percentile={22} />
      <PercentileBar label="Press Ratio (inverted)" value={6.2} percentile={22} inverted />
      <PercentileBar label="Errors per 90" value={0.08} percentile={15} />
      <PercentileBar label="Errors per 90 (inverted)" value={0.08} percentile={15} inverted />
    </div>
  );
}

export function FormattedValues() {
  return (
    <div style={stack}>
      <PercentileBar
        label="Pass Completion"
        value={0.874}
        percentile={69}
        formatValue={(v) => `${(v * 100).toFixed(1)}%`}
      />
      <PercentileBar
        label="Minutes Played"
        value={2418}
        percentile={88}
        formatValue={(v) => v.toLocaleString("en-GB")}
      />
    </div>
  );
}
