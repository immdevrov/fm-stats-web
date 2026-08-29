// Shared harness for the view previews: seeds IndexedDB from the fixture squad,
// then mounts the view inside the real app shell. Not a component preview.
import { useEffect, useState } from "react";
import { Layout, MemoryRouter, Route, Routes, db } from "fm-stats-web";
import { leagueRankings, players } from "./_fixtures";

let seeding: Promise<void> | null = null;

function seed() {
  if (!seeding) {
    seeding = (async () => {
      await db.clearAllPlayers();
      await db.savePlayers(players);
      await db.saveLeagueRankings(leagueRankings);
    })();
  }
  return seeding;
}

export function Screen({
  at,
  path,
  element,
  compare,
}: {
  at: string;
  path: string;
  element: React.ReactNode;
  compare?: number[];
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    seed()
      .then(() => (compare ? db.saveCompareList(compare) : undefined))
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  if (!ready) return <div style={{ height: 640 }} />;

  return (
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path={path} element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
