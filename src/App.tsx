import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ImportView } from "./views/ImportView";
import { LeaguesView } from "./views/LeaguesView";
import { TeamsView } from "./views/TeamsView";
import { TeamView } from "./views/TeamView";
import { PlayersView } from "./views/PlayersView";
import { PlayerProfileView } from "./views/PlayerProfileView";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="import" element={<ImportView />} />
        <Route path="leagues" element={<LeaguesView />} />
        <Route path="teams" element={<TeamsView />} />
        <Route path="teams/:teamName" element={<TeamView />} />
        <Route path="players" element={<PlayersView />} />
        <Route path="players/:playerId" element={<PlayerProfileView />} />
      </Route>
    </Routes>
  );
}

export default App;
