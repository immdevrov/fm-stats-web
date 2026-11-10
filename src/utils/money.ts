const MULTIPLIERS = { k: 1_000, m: 1_000_000 } as const;

const exactFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const groupedFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

// With a k/m suffix a single "." or "," is a decimal point; without one, every separator is a thousands separator.
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[€$£\s]/g, "").toLowerCase();
  const match = /^(\d+(?:[.,]\d+)*)([km])?$/.exec(cleaned);
  if (!match) return null;
  const [, number, suffix] = match;

  if (!suffix) return Number(number.replace(/[.,]/g, ""));

  const separators = number.match(/[.,]/g)?.length ?? 0;
  if (separators > 1) return null;
  return Math.round(Number(number.replace(",", ".")) * MULTIPLIERS[suffix as keyof typeof MULTIPLIERS]);
}

export function formatMoneyExact(value: number): string {
  return exactFormat.format(value);
}

export function toEditText(value: number): string {
  if (value >= 1_000_000 && value % 10_000 === 0) return `${value / 1_000_000}m`;
  if (value >= 1_000 && value % 10 === 0) return `${value / 1_000}k`;
  return groupedFormat.format(value);
}
