import { ConfirmDialog } from "fm-stats-web";

const noop = () => {};

export function Default() {
  return (
    <ConfirmDialog
      isOpen
      onClose={noop}
      onConfirm={noop}
      title="Players already imported"
      message="This file contains 1,284 players, 906 of which are already in the database. How should they be handled?"
      options={[
        { label: "Replace existing", value: "replace", description: "Overwrite stored records with the values from this file." },
        { label: "Merge", value: "merge", description: "Keep stored records and fill in only missing fields." },
        { label: "Skip duplicates", value: "skip", description: "Import the 378 new players and leave the rest untouched." },
      ]}
    />
  );
}

export function TwoOptions() {
  return (
    <ConfirmDialog
      isOpen
      onClose={noop}
      onConfirm={noop}
      title="Clear all custom positions"
      message="Every manual position override will be removed and players will fall back to the positions imported from the game."
      options={[
        { label: "Clear all overrides", value: "clear" },
        { label: "Keep them", value: "keep" },
      ]}
    />
  );
}
