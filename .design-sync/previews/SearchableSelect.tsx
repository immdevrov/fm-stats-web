import { useEffect, useRef } from "react";
import { useState } from "react";
import { SearchableSelect } from "fm-stats-web";

const leagues = [
  "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
  "Eredivisie", "Primeira Liga", "Belgian Pro League", "Scottish Premiership",
  "Super Lig", "Championship", "MLS",
];

const clubs = [
  "Arsenal", "Aston Villa", "Brighton", "Chelsea", "Crystal Palace",
  "Everton", "Fulham", "Liverpool", "Manchester City", "Manchester United",
];

const frame: React.CSSProperties = { padding: 16, minHeight: 90 };
const tallFrame: React.CSSProperties = { padding: 16, minHeight: 400 };

function OpenOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = ref.current?.firstElementChild?.firstElementChild;
    (trigger as HTMLElement | undefined)?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function Default() {
  const [value, setValue] = useState("");
  return (
    <div style={frame}>
      <SearchableSelect options={leagues} value={value} onChange={setValue} />
    </div>
  );
}

export function WithSelection() {
  const [value, setValue] = useState("La Liga");
  return (
    <div style={frame}>
      <SearchableSelect options={leagues} value={value} onChange={setValue} />
    </div>
  );
}

export function Open() {
  const [value, setValue] = useState("La Liga");
  return (
    <div style={tallFrame}>
      <OpenOnMount>
        <SearchableSelect options={leagues} value={value} onChange={setValue} />
      </OpenOnMount>
    </div>
  );
}

export function OpenWithClubs() {
  const [value, setValue] = useState("");
  return (
    <div style={tallFrame}>
      <OpenOnMount>
        <SearchableSelect
          options={clubs}
          value={value}
          onChange={setValue}
          placeholder="Filter by club..."
          allLabel="All clubs"
          width="260px"
        />
      </OpenOnMount>
    </div>
  );
}
