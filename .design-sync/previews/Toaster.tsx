import { useEffect } from "react";
import { Toaster, toaster } from "fm-stats-web";

const frame: React.CSSProperties = { padding: 24, minHeight: 320 };

function Fire({ toasts }: { toasts: Array<Parameters<typeof toaster.create>[0]> }) {
  useEffect(() => {
    for (const t of toasts) toaster.create(t);
    return () => toaster.dismiss();
  }, [toasts]);
  return <Toaster />;
}

export function Success() {
  return (
    <div style={frame}>
      <Fire
        toasts={[
          { title: "Import complete", description: "1,284 players imported from squad-export.rtf", type: "success", duration: 60000 },
        ]}
      />
    </div>
  );
}

export function Error() {
  return (
    <div style={frame}>
      <Fire
        toasts={[
          { title: "Could not parse file", description: "No pipe-delimited table was found in this RTF export.", type: "error", duration: 60000 },
        ]}
      />
    </div>
  );
}

export function Info() {
  return (
    <div style={frame}>
      <Fire
        toasts={[
          { title: "3 players skipped", description: "They have no club, so they were not imported.", type: "info", duration: 60000 },
        ]}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div style={frame}>
      <Fire toasts={[{ title: "Parsing squad export...", type: "loading", duration: 60000 }]} />
    </div>
  );
}
