import { parsePositions } from "../fields/positions";
import { parseCustomDate } from "../utils";
import type { Player } from "../types";

const createStringProcessor = (str: string) => {
  return <T extends (s: string) => unknown>(
    s: string | null | undefined,
    processFn: T
  ): ReturnType<T> | null => {
    if (s === null || s === undefined || s.trim() === str) {
      return null;
    }
    return processFn(s) as ReturnType<T>;
  };
};

const processHyphen = createStringProcessor("-");
const processNA = createStringProcessor("N/A");

const parseWage = (record: Record<string, string>) => {
  const rawWage = record["Wage"];
  const fn = (str: string) =>
    parseInt(
      str
        .replaceAll(",", "")
        .replaceAll("€", "")
        .replaceAll("$", "")
        .replaceAll("£", "")
        .trim()
    );
  return processNA(rawWage, fn);
};

const parseHeight = (record: Record<string, string>): number | null => {
  const rawHeight = record["Height"];
  const fn = (str: string) => parseFloat(str.replace(" cm", ""));
  return processHyphen(rawHeight, fn);
};

const parseWeight = (record: Record<string, string>): number | null => {
  const rawWeight = record["Weight"];
  const fn = (str: string) => parseFloat(str.replace(" kg", ""));
  return processHyphen(rawWeight, fn);
};

/**
 * Parses an HTML table into an array of records.
 * Uses the browser's native DOMParser.
 * @param html The HTML content containing a table.
 * @returns An array of objects where keys are headers and values are cell strings.
 */
export function parseHtmlTable(html: string): Record<string, string>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");

  if (!table) {
    console.error("No table found in HTML content.");
    return [];
  }

  const headerCells = table.querySelectorAll("th");
  const headers: string[] = [];
  headerCells.forEach((th) => {
    headers.push(th.textContent?.trim() || "");
  });

  if (headers.length === 0) {
    console.error("No headers found in table.");
    return [];
  }

  const rows = table.querySelectorAll("tr");
  const records: Record<string, string>[] = [];

  rows.forEach((row, index) => {
    if (index === 0 && row.querySelector("th")) {
      return;
    }

    const cells = row.querySelectorAll("td");
    if (cells.length === 0) {
      return;
    }

    const record: Record<string, string> = {};
    cells.forEach((cell, cellIndex) => {
      if (cellIndex < headers.length) {
        record[headers[cellIndex]] = cell.textContent?.trim() || "";
      }
    });

    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  });

  return records;
}

export const REQUIRED_COLUMNS: readonly string[] = [
  'UID', 'Name', 'Age', 'Nat', 'Division', 'Club', 'Position', 'Sec. Position',
  'Wage', 'Expires', 'Height', 'Weight', 'Rc Injury', 'Starts', 'Mins',
  'Pas %', 'Asts/90', 'xA/90', 'Pr passes/90', 'OP-KP/90', 'Ch C/90',
  'OP-Cr %', 'OP-Crs C/90', 'Conv %', 'xG-OP', 'ShT/90',
  'Shots Outside Box/90', 'NP-xG/90', 'Gls/90', 'Gl Mst', 'Tck/90', 'Tck R',
  'Int/90', 'Clr/90', 'K Tck/90', 'K Hdrs/90', 'Aer A/90', 'Hdr %',
  'Hdrs W/90', 'Blk/90', 'Poss Won/90', 'Poss Lost/90', 'Sprints/90',
  'Drb/90', 'Dist/90', 'Pres C/90', 'Pres A/90', 'Svt', 'Svp', 'Svh',
  'xSv %', 'Sv %', 'xGP/90', 'Con/90',
];

export function findMissingColumns(headers: string[]): string[] {
  const present = new Set(headers.map((header) => header.trim()));
  return REQUIRED_COLUMNS.filter((column) => !present.has(column));
}

export function transformPlayerStats(rawRecords: Record<string, string>[]): Player[] {
  const players: Player[] = [];

  for (const record of rawRecords) {
    const player: Player = {
      UID: Number(record.UID),
      Name: record.Name,
      Age: Number(record.Age),
      Weight: parseWeight(record),
      Height: parseHeight(record),
      RcInjury: record["Rc Injury"] !== "-",
      Nat: record.Nat,
      Division: record.Division,
      Club: record.Club,
      Wage: parseWage(record),
      Expires: processHyphen(record.Expires, parseCustomDate),
      Position: parsePositions(record.Position),
      SecPosition: processHyphen(record["Sec. Position"], parsePositions),
      Starts: Number(record.Starts),
      Mins: Number(
        typeof record.Mins === "string" ? record.Mins.replace(",", "") : record.Mins
      ),
      PasPercentage: Number(record["Pas %"].replace("%", "")),
      AssistsPer90: Number(record["Asts/90"]),
      xAPer90: Number(record["xA/90"]),
      PrPassesPer90: Number(record["Pr passes/90"]),
      OPKPPer90: Number(record["OP-KP/90"] || 0),
      ChCPer90: processHyphen(record["Ch C/90"], parseFloat) ?? 0,
      OPCrPercentage: processHyphen(record["OP-Cr %"], parseFloat) ?? 0,
      OPCrsCPer90: processHyphen(record["OP-Crs C/90"], parseFloat) ?? 0,
      ConvPercentage: processHyphen(record["Conv %"], parseFloat) ?? 0,
      xGOP: Number(record["xG-OP"] || 0),
      ShTPer90: Number(record["ShT/90"]),
      ShotsOutsideBoxPer90: Number(record["Shots Outside Box/90"]),
      NPxGPer90: Number(record["NP-xG/90"]),
      goals90: processHyphen(record["Gls/90"], parseFloat),
      GlMst: processHyphen(record["Gl Mst"], parseInt) ?? 0,
      TckPer90: processHyphen(record["Tck/90"], parseFloat),
      TckR: processHyphen(record["Tck R"], parseFloat) ?? 0,
      IntPer90: processHyphen(record["Int/90"], parseFloat) ?? 0,
      ClrPer90: processHyphen(record["Clr/90"], parseFloat) ?? 0,
      KTckPer90: processHyphen(record["K Tck/90"], parseFloat) ?? 0,
      KHdrsPer90: processHyphen(record["K Hdrs/90"], parseFloat) ?? 0,
      AerAPer90: processHyphen(record["Aer A/90"], parseFloat) ?? 0,
      HdrPercentage: processHyphen(record["Hdr %"], parseFloat) ?? 0,
      HdrsWPer90: processHyphen(record["Hdrs W/90"], parseFloat) ?? 0,
      BlkPer90: processHyphen(record["Blk/90"], parseFloat) ?? 0,
      PossWonPer90: processHyphen(record["Poss Won/90"], parseFloat) ?? 0,
      PossLostPer90: processHyphen(record["Poss Lost/90"], parseFloat) ?? 0,
      SprintsPer90: processHyphen(record["Sprints/90"], parseFloat) ?? 0,
      DrbPer90: processHyphen(record["Drb/90"], parseFloat) ?? 0,
      DistPer90: processHyphen(record["Dist/90"], parseFloat) ?? 0,
      PresCPer90: processHyphen(record["Pres C/90"], parseFloat) ?? 0,
      PresAPer90: processHyphen(record["Pres A/90"], parseFloat) ?? 0,
      Svt: processHyphen(record["Svt"], parseFloat) ?? 0,
      Svp: processHyphen(record["Svp"], parseFloat) ?? 0,
      Svh: processHyphen(record["Svh"], parseFloat) ?? 0,
      exsvPercentage: Number(record["xSv %"].replace("%", "")),
      svPercentage: Number(record["Sv %"].replace("%", "")),
      xGPPer90: processHyphen(record["xGP/90"], parseFloat) ?? 0,
      ConPer90: processHyphen(record["Con/90"], parseFloat) ?? 0,
    } as Player;

    players.push(player);
  }

  return players;
}
