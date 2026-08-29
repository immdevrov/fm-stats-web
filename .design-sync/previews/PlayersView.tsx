import { PlayersView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return <Screen at="/players" path="players" element={<PlayersView />} />;
}
