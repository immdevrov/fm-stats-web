import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ImportView } from "./views/ImportView";
import { LeaguesView } from "./views/LeaguesView";
import { TeamsView } from "./views/TeamsView";
import { TeamView } from "./views/TeamView";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="import" element={<ImportView />} />
        <Route path="leagues" element={<LeaguesView />} />
        <Route path="teams" element={<TeamsView />} />
        <Route path="teams/:teamName" element={<TeamView />} />
      </Route>
    </Routes>
  );
}

export default App;
