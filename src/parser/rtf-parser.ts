import { parsePositions } from "../fields/positions";
import { parseCustomDate } from "../utils";
import type { Player } from "../types";

// Helper to process cell values (e.g., convert "N/A" or "-" to null)
const createStringProcessor = (str: string) => {
  return <T extends (s: string) => any>(
    s: string | null | undefined,
    processFn: T
  ): ReturnType<T> | null => {
    if (s === null || s === undefined || s.trim() === str) {
      return null;
    }
    return processFn(s);
  };
};

const processHyphen = createStringProcessor("-");
const processNA = createStringProcessor("N/A");

// Functions to parse specific data types
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
 * Extracts the plain-text table lines from the RTF content.
 * Assumes the structured, pipe-delimited data starts after the RTF header.
 * @param rtfContent The entire content of the RTF file.
 * @returns An array of strings, where each string is a table row (header, separator, or data).
 */
export function extractPlainTextTable(rtfContent: string): string[] {
  const lines = rtfContent.split("\n");
  const tableLines: string[] = [];
  let isTable = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    if (trimmedLine.includes("UID") && trimmedLine.includes("|")) {
      isTable = true;
    }

    if (isTable && trimmedLine.startsWith("|")) {
      const cleanLine = trimmedLine.replace(/\\(par|tab|b|i)\s*0?\}?\s*/g, "").trim();
      
      if (cleanLine.startsWith("|")) {
        if (cleanLine === "|" && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (/^-+/.test(nextLine)) {
            continue;
          }
        }
        
        const isSeparator = /^\|[\s-]*$/.test(cleanLine) || cleanLine.startsWith("|-") || cleanLine.startsWith("| -")
        if (!isSeparator) {
          tableLines.push(cleanLine);
        }
      }
    }
  }

  return tableLines;
}

/**
 * Parses the array of pipe-delimited table lines into an array of raw string records.
 * It uses the pipe positions in the header row for accurate column slicing.
 * @param tableLines An array of clean table rows (header + data).
 * @returns An array of objects where keys are headers and values are raw cell strings.
 */
export function parseRtfTable(tableLines: string[]): Record<string, string>[] {
  if (tableLines.length < 2) {
    // Need at least header and one data row
    console.error("No valid table data found.");
    return [];
  }

  const headerLine = tableLines[0];
  const dataLines = tableLines.slice(1);

  // 1. Identify raw headers and pipe indices for column slicing
  const pipeIndices: number[] = [];
  for (let i = 0; i < headerLine.length; i++) {
    if (headerLine[i] === "|") {
      pipeIndices.push(i);
    }
  }

  const rawHeaders = headerLine
    .split("|")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  // 2. Map pipe indices to header start/end positions
  // The content for header N is between pipeIndices[N] and pipeIndices[N+1]

  const dataRecords: Record<string, string>[] = [];

  for (const dataLine of dataLines) {
    if (!dataLine.startsWith("|")) continue; // Ensure it's a valid data row

    const record: Record<string, string> = {};
    let isValidRecord = true;

    // Iterate through headers to extract cell content based on fixed width
    for (let j = 0; j < rawHeaders.length; j++) {
      const header = rawHeaders[j];
      const start = pipeIndices[j] + 1; // Start index after the pipe
      const end = pipeIndices[j + 1]; // End index at the next pipe

      if (end === undefined || start >= dataLine.length) {
        // Should not happen with well-formed tables, but serves as a safety break
        isValidRecord = false;
        console.warn(`Skipping malformed row: Data too short at column ${header}`);
        break;
      }

      // Slice the content and aggressively trim
      let cellContent = dataLine.substring(start, end);
      cellContent = cellContent.trim(); // Trim leading/trailing whitespace

      record[header] = cellContent;
    }

    if (isValidRecord && Object.keys(record).length === rawHeaders.length) {
      dataRecords.push(record);
    }
  }

  return dataRecords;
}

/**
 * Converts the raw string records into the final Player array with correct types.
 * @param rawRecords The array of raw string records from the RTF table.
 * @returns An array of Player objects.
 */
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
      SecPosition: processHyphen(record.Position, parsePositions),
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
    } as Player; // Casting to Player, assuming all required fields are added above.

    players.push(player);
  }

  return players;
}
