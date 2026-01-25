import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ImportView } from "./views/ImportView";
import { LeaguesView } from "./views/LeaguesView";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="import" element={<ImportView />} />
        <Route path="leagues" element={<LeaguesView />} />
      </Route>
    </Routes>
  );
}

export default App;
