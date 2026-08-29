import { ImportView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return <Screen at="/import" path="import" element={<ImportView />} />;
}
