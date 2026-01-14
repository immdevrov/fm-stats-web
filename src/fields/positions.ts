// Define allowed position types.
type PositionType = "GK" | "D" | "WB" | "DM" | "M" | "AM" | "ST";

// An individual position with an optional set of variations.
export interface PlayerPosition {
  type: PositionType;
  side?: Array<"R" | "C" | "L">; // e.g. ['R'], ['L'], or ['R', 'C']
}

// The array type representing all positions a player can play.
export type PlayerPositions = PlayerPosition[];

/**
 * Parses a single token such as "D", "WB(R)" or "AM (L)".
 */
function parsePositionToken(token: string): PlayerPosition {
  token = token.trim();
  // This regex only accepts the allowed position abbreviations.
  const regex = /^(GK|D|WB|DM|M|AM|ST)\s*(?:\(([^)]+)\))?$/;
  const match = token.match(regex);
  if (!match) {
    throw new Error(`Invalid token format: "${token}"`);
  }
  const base = match[1] as PositionType;
  let variations: string[] | undefined;
  if (match[2]) {
    // Split the characters (e.g. "RC" becomes ['R','C']).
    variations = match[2].split("").filter((ch) => /\S/.test(ch));
  }
  return { type: base, side: variations as PlayerPosition["side"] };
}

/**
 * Parses a complete string describing one or more position options.
 *
 * Examples:
 * - "D/WB(R)" -> [ {position: "D", variations: ["R"]}, {position: "WB", variations: ["R"]} ]
 * - "D/WB/M/AM(L)" -> [ {position: "D", variations: ["L"]}, {position: "WB", variations: ["L"]}, ... ]
 * - "AM (L), ST (C)" -> two separate options.
 * - "D (RC), DM" -> first option has variations ["R", "C"], second is "DM".
 */
export function parsePositions(input: string): PlayerPositions {
  // Split groups by comma.
  const groups = input
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);

  const positions: PlayerPositions = [];

  for (const group of groups) {
    // If the group contains "/" then multiple positions share (or may share) the same variation.
    if (group.includes("/")) {
      const tokens = group.split("/").map((t) => t.trim());
      let commonVariations: string[] | undefined;

      // Check if the last token includes a variation.
      const lastToken = tokens[tokens.length - 1];
      const parenMatch = lastToken.match(/\(([^)]+)\)/);
      if (parenMatch) {
        commonVariations = parenMatch[1]
          .split("")
          .filter((ch) => /\S/.test(ch));
        // Remove the parenthesized part from the last token.
        tokens[tokens.length - 1] = lastToken
          .replace(/\s*\(([^)]+)\)/, "")
          .trim();
      }

      // Parse each token. If a token itself does not include a variation,
      // assign the common variations (if any).
      for (const token of tokens) {
        const pos = parsePositionToken(token);
        if (!pos.side && commonVariations) {
          pos.side = commonVariations as PlayerPosition["side"];
        }
        positions.push(pos);
      }
    } else {
      // Single token group.
      positions.push(parsePositionToken(group));
    }
  }

  return positions;
}
