const TRAILING_DATE = /(\d{1,2})[_-](\d{1,2})[_-](\d{4})$/;

function toIso(day: number, month: number, year: number): string | null {
  // A three-digit year sorts above a four-digit one, which would silently make the snapshot newest.
  if (year < 1000 || year > 9999) return null;
  if (month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function deriveDateFromFilename(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, '');
  const match = stem.match(TRAILING_DATE);
  if (!match) return null;
  return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function displayToIso(display: string): string | null {
  const parts = display.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  return toIso(day, month, year);
}

export function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
