import { ScoutingView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return <Screen at="/scouting" path="scouting" element={<ScoutingView />} />;
}
