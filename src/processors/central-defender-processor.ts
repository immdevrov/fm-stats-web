import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { CentralDefender, type ICentralDefender } from "../roles/central-defender";

export class CentralDefenderProcessor {
  players: CentralDefender[];

  private ARCHETYPE_NAMES = {
    AGGRESSOR: "aggressor",
    SPREADER: "spreader",
  };

  constructor(players: Player[]) {
    const pl = players.filter(CentralDefender.isRole);

    this.players = pl.map((p) => new CentralDefender(p));
  }

  get archetypes(): Record<string, KeyOfType<ICentralDefender, number>[]> {
    return {
      [this.ARCHETYPE_NAMES.AGGRESSOR]: ["tackleRatio", "headersWonRatio"],
      [this.ARCHETYPE_NAMES.SPREADER]: ["progressivePasses"],
    };
  }

  analyze(players: CentralDefender[]) {
    const playersWithArchetype = calculateArchetypes(players, this.archetypes);

    return playersWithArchetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    });

    return filtered;
  }

  print(defenders: CentralDefender[]) {
    const display = defenders.map((g) => {
      const {
        uid,
        name,
        nat,
        mistakes,
        progressivePasses,
        passRatio,
        aerialAttempts,
        headersWonRatio,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        mistakes,
        aerialAttempts,
        headersWonRatio,
        "pass%": passRatio,
        progressivePasses,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There are ${display.length} defenders to watch`);
    printTable(display);
  }
}
