import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { DefensiveMidfielder, type IDefensiveMidfielder } from "../roles/defensive-midfilder";

export class DefensiveMidfielderProcessor {
  players: DefensiveMidfielder[];

  private ARHETYPE_NAMES = {
    DESTROYER: "destroyer",
    DEEP_PLAYMAKER: "deep playmaker",
    ANCHOR: "anchor",
  };

  constructor(players: Player[]) {
    const pl = players.filter(DefensiveMidfielder.isRole);

    this.players = pl.map((p) => new DefensiveMidfielder(p));
  }

  get archetypes(): Record<string, KeyOfType<IDefensiveMidfielder, number>[]> {
    return {
      [this.ARHETYPE_NAMES.DESTROYER]: ["pressuresSuccessful", "tackleRatio", "possessionWon"],
      [this.ARHETYPE_NAMES.DEEP_PLAYMAKER]: [
        "ballRetention",
        "progressivePasses",
        "keyPasses",
      ],
      [this.ARHETYPE_NAMES.ANCHOR]: [
        "passRatio",
        "progressivePasses",
        "ballRetention",
      ],
    };
  }

  analize(players: DefensiveMidfielder[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      timePlayed: getFilters().timePlayed,
    });

    return filtered;
  }

  print(midfielders: DefensiveMidfielder[]) {
    const display = midfielders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePasses,
        passRatio,
        aerialAttempts,
        headersWonRatio,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        keyPasses,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        aerialAttempts,
        headersWonRatio,
        "pass%": passRatio,
        progressivePasses,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        keyPasses,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} def midfielders to watch`);
    printTable(display);
  }
}
