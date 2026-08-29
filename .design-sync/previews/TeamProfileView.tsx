import { TeamProfileView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return (
    <Screen at="/teams/Fiorentina" path="teams/:teamName" element={<TeamProfileView />} />
  );
}
