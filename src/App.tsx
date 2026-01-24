import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ImportView } from "./views/ImportView";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="import" element={<ImportView />} />
        {/* Add more routes here as you create new views */}
      </Route>
    </Routes>
  );
}

export default App;
