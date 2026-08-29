import { CompareView } from "fm-stats-web";
import { Screen } from "./_seed";

export function Default() {
  return (
    <Screen
      at="/compare"
      path="compare"
      element={<CompareView />}
      compare={[1001, 1002, 1003]}
    />
  );
}

export function EmptyState() {
  return <Screen at="/compare" path="compare" element={<CompareView />} compare={[]} />;
}
