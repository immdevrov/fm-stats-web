import { useEffect, useRef } from "react";
import { PlayerAutocomplete } from "fm-stats-web";

const players = [
  { UID: 1, Name: "Mateo Ferrán", Club: "Real Betis", Position: [{ type: "AM", side: ["C"] }] },
  { UID: 2, Name: "Luka Novak", Club: "Dinamo Zagreb", Position: [{ type: "DM" }, { type: "M", side: ["C"] }] },
  { UID: 3, Name: "Emeka Ofori", Club: "Club Brugge", Position: [{ type: "ST", side: ["C"] }] },
  { UID: 4, Name: "Tobias Lind", Club: "FC Midtjylland", Position: [{ type: "D", side: ["R", "C"] }] },
  { UID: 5, Name: "Rafael Pinto", Club: "Sporting CP", Position: [{ type: "WB", side: ["L"] }] },
  { UID: 6, Name: "Andrej Kovač", Club: "Red Bull Salzburg", Position: [{ type: "M", side: ["C"] }] },
  { UID: 7, Name: "Idrissa Diallo", Club: "Stade Rennais", Position: [{ type: "D", side: ["C"] }] },
  { UID: 8, Name: "Nico Brandt", Club: "VfB Stuttgart", Position: [{ type: "GK" }] },
] as never[];

const frame: React.CSSProperties = { padding: 16, width: 320 };
const tallFrame: React.CSSProperties = { padding: 16, width: 320, minHeight: 420 };
const noop = () => {};

function OpenOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = ref.current?.firstElementChild?.firstElementChild;
    (trigger as HTMLElement | undefined)?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function Default() {
  return (
    <div style={frame}>
      <PlayerAutocomplete players={players} onChange={noop} excludeUids={[]} />
    </div>
  );
}

export function Open() {
  return (
    <div style={tallFrame}>
      <OpenOnMount>
        <PlayerAutocomplete players={players} onChange={noop} excludeUids={[]} />
      </OpenOnMount>
    </div>
  );
}

export function ExcludingCompared() {
  return (
    <div style={tallFrame}>
      <OpenOnMount>
        <PlayerAutocomplete
          players={players}
          onChange={noop}
          excludeUids={[1, 2, 3]}
          placeholder="Search for a player to compare..."
        />
      </OpenOnMount>
    </div>
  );
}
