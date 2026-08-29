import { FileInput } from "fm-stats-web";

const frame: React.CSSProperties = { padding: 24 };
const noop = () => {};

export function Default() {
  return (
    <div style={frame}>
      <FileInput onFileSelect={noop} accept=".html,.rtf" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={frame}>
      <FileInput onFileSelect={noop} accept=".html,.rtf" disabled />
    </div>
  );
}
