import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { DefensiveMidfielder, type IDefensiveMidfielder } from "../roles/defensive-midfielder";

export class DefensiveMidfielderProcessor {
  players: DefensiveMidfielder[];

  private ARCHETYPE_NAMES = {
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
      [this.ARCHETYPE_NAMES.DESTROYER]: ["pressuresSuccessful", "tackleRatio", "possessionWon"],
      [this.ARCHETYPE_NAMES.DEEP_PLAYMAKER]: [
        "ballRetention",
        "progressivePasses",
        "keyPasses",
      ],
      [this.ARCHETYPE_NAMES.ANCHOR]: [
        "passRatio",
        "progressivePasses",
        "ballRetention",
      ],
    };
  }

  analyze(players: DefensiveMidfielder[]) {
    const playersWithArchetype = calculateArchetypes(players, this.archetypes);

    return playersWithArchetype;
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
    console.log(`There are ${display.length} def midfielders to watch`);
    printTable(display);
  }
}
