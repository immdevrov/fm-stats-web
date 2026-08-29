import { MemoryRouter, Navigation } from "fm-stats-web";

const rail: React.CSSProperties = {
  width: 200,
  minHeight: 380,
  borderRight: "1px solid #e0e0e0",
};

function Rail({ at }: { at: string }) {
  return (
    <MemoryRouter initialEntries={[at]}>
      <div style={rail}>
        <Navigation />
      </div>
    </MemoryRouter>
  );
}

export function Default() {
  return <Rail at="/" />;
}

export function ActiveRoute() {
  return <Rail at="/scouting" />;
}

export function OnImport() {
  return <Rail at="/import" />;
}
