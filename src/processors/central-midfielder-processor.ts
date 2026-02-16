import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { CentralMidfielder, type ICentralMidfielder } from "../roles/central-midfielder";

export class CentralMidfielderProcessor {
  players: CentralMidfielder[];

  private ARCHETYPE_NAMES = {
    DESTROYER: "destroyer",
    DEEP_PLAYMAKER: "deep playmaker",
    ADVANCED_PLAYMAKER: "advanced playmaker",
  };

  constructor(players: Player[]) {
    const pl = players.filter(CentralMidfielder.isRole);

    this.players = pl.map((p) => new CentralMidfielder(p));
  }

  get archetypes(): Record<string, KeyOfType<ICentralMidfielder, number>[]> {
    return {
      [this.ARCHETYPE_NAMES.DESTROYER]: ["pressuresSuccessful", "tackleRatio", "possessionWon"],
      [this.ARCHETYPE_NAMES.DEEP_PLAYMAKER]: [
        "ballRetention",
        "progressivePasses",
        "keyPasses",
      ],
      [this.ARCHETYPE_NAMES.ADVANCED_PLAYMAKER]: ["keyPasses", "chancesCreated", "npxG"],
    };
  }

  analyze(players: CentralMidfielder[]) {
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

  print(midfielders: CentralMidfielder[]) {
    const display = midfielders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePasses,
        passRatio,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        headersWonRatio,
        keyPasses,
        dribbles,
        sprints,
        pressuresSuccessful,
        distance,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        "pass%": passRatio,
        progressivePasses,
        tackles,
        tackleRatio,
        possessionLost,
        possessionWon,
        headersWonRatio,
        keyPasses,
        dribbles,
        sprints,
        distance,
        pressuresSuccessful,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There are ${display.length} central midfielders to watch`);
    printTable(display);
  }
}
