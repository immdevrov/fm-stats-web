import { LeaguesView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return <Screen at="/leagues" path="leagues" element={<LeaguesView />} />;
}
