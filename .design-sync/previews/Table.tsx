import { Table } from "fm-stats-web";
import type { Column } from "fm-stats-web";

interface ScoutRow {
  Name: string;
  Club: string;
  Position: string;
  Age: number;
  Rating: number;
  Wage: string;
}

const rows: ScoutRow[] = [
  { Name: "Tobias Lind", Club: "FC Midtjylland", Position: "D(RC)", Age: 26, Rating: 6.94, Wage: "€9,200 p/w" },
  { Name: "Mateo Ferrán", Club: "Real Betis", Position: "AM(C)", Age: 22, Rating: 7.42, Wage: "€24,000 p/w" },
  { Name: "Rafael Pinto", Club: "Sporting CP", Position: "WB(L)", Age: 23, Rating: 6.88, Wage: "€15,750 p/w" },
  { Name: "Emeka Ofori", Club: "Club Brugge", Position: "ST(C)", Age: 21, Rating: 7.05, Wage: "€18,000 p/w" },
  { Name: "Luka Novak", Club: "Dinamo Zagreb", Position: "DM, M(C)", Age: 24, Rating: 7.18, Wage: "€11,500 p/w" },
];

const columns: Column<ScoutRow>[] = [
  { key: "Name", header: "Player", width: "180px" },
  { key: "Club", header: "Club" },
  { key: "Position", header: "Position" },
  { key: "Age", header: "Age", width: "60px" },
  { key: "Rating", header: "Rating", highlighted: true },
  { key: "Wage", header: "Wage", sortable: false },
];

export function Default() {
  return <Table data={rows} columns={columns} />;
}

export function SortedByRating() {
  return <Table data={rows} columns={columns} defaultSortKey="Rating" defaultSortDirection="desc" />;
}

export function WithRenderedCells() {
  const withBars: Column<ScoutRow>[] = [
    { key: "Name", header: "Player", width: "180px" },
    { key: "Position", header: "Position" },
    {
      key: "Rating",
      header: "Rating",
      headerTooltip: "Average match rating across the season",
      highlighted: true,
      render: (value) => (
        <span style={{ fontWeight: 600, color: Number(value) >= 7 ? "#2f855a" : "#975a16" }}>
          {Number(value).toFixed(2)}
        </span>
      ),
    },
    {
      key: "Age",
      header: "Age",
      render: (value) => (Number(value) <= 23 ? `${value} ★` : String(value)),
    },
  ];
  return <Table data={rows} columns={withBars} defaultSortKey="Rating" />;
}

export function Empty() {
  return <Table data={[]} columns={columns} />;
}
