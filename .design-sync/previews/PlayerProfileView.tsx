import { PlayerProfileView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return (
    <Screen at="/players/1105" path="players/:playerId" element={<PlayerProfileView />} />
  );
}
