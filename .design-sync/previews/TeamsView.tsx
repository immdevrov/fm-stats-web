import { TeamsView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return <Screen at="/teams" path="teams" element={<TeamsView />} />;
}
