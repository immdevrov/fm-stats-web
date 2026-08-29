import { Layout, MemoryRouter, Route, Routes, Table } from "fm-stats-web";
import type { Column } from "fm-stats-web";

interface ScoutRow {
  Name: string;
  Club: string;
  Position: string;
  Age: number;
  Rating: number;
}

const rows: ScoutRow[] = [
  { Name: "Mateo Ferrán", Club: "Real Betis", Position: "AM(C)", Age: 22, Rating: 7.42 },
  { Name: "Luka Novak", Club: "Dinamo Zagreb", Position: "DM, M(C)", Age: 24, Rating: 7.18 },
  { Name: "Emeka Ofori", Club: "Club Brugge", Position: "ST(C)", Age: 21, Rating: 7.05 },
  { Name: "Tobias Lind", Club: "FC Midtjylland", Position: "D(RC)", Age: 26, Rating: 6.94 },
];

const columns: Column<ScoutRow>[] = [
  { key: "Name", header: "Player", width: "170px" },
  { key: "Club", header: "Club" },
  { key: "Position", header: "Position" },
  { key: "Age", header: "Age", width: "60px" },
  { key: "Rating", header: "Rating", highlighted: true },
];

const heading: React.CSSProperties = {
  font: "600 20px system-ui, sans-serif",
  margin: "0 0 16px",
};

function ScoutingPane() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={heading}>Scouting</h1>
      <Table data={rows} columns={columns} defaultSortKey="Rating" />
    </div>
  );
}

function EmptyPane() {
  return (
    <div style={{ padding: 24, font: "14px system-ui, sans-serif", opacity: 0.6 }}>
      Import a squad export to get started.
    </div>
  );
}

export function Default() {
  return (
    <MemoryRouter initialEntries={["/scouting"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/scouting" element={<ScoutingPane />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

export function EmptyState() {
  return (
    <MemoryRouter initialEntries={["/import"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/import" element={<EmptyPane />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
