import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MyTeamView } from "./views/MyTeamView";
import { ImportView } from "./views/ImportView";
import { LeaguesView } from "./views/LeaguesView";
import { TeamsView } from "./views/TeamsView";
import { TeamProfileView } from "./views/TeamProfileView";
import { PlayersView } from "./views/PlayersView";
import { PlayerProfileView } from "./views/PlayerProfileView";
import { ScoutingView } from "./views/ScoutingView";
import { ListsView } from "./views/ListsView";
import { CompareView } from "./views/CompareView";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="my-team" element={<MyTeamView />} />
        <Route path="my-team/planner" element={<MyTeamView />} />
        <Route path="import" element={<ImportView />} />
        <Route path="leagues" element={<LeaguesView />} />
        <Route path="teams" element={<TeamsView />} />
        <Route path="teams/:teamName" element={<TeamProfileView />} />
        <Route path="players" element={<PlayersView />} />
        <Route path="players/:playerId" element={<PlayerProfileView />} />
        <Route path="scouting" element={<ScoutingView />} />
        <Route path="lists" element={<ListsView />} />
        <Route path="compare" element={<CompareView />} />
      </Route>
    </Routes>
  );
}

export default App;
