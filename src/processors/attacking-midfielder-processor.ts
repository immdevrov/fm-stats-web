import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { AttackingMidfielder, type IAttackingMidfielder } from "../roles/attacking-midfielder";

export class AttackingMidfielderProcessor {
  players: AttackingMidfielder[];
  private ARCHETYPE_NAMES = {
    ADVANCED_PLAYMAKER: "advanced playmaker",
  };

  constructor(players: Player[]) {
    const pl = players.filter(AttackingMidfielder.isRole);

    this.players = pl.map((p) => new AttackingMidfielder(p));
  }

  get archetypes(): Record<string, KeyOfType<IAttackingMidfielder, number>[]> {
    return {
      [this.ARCHETYPE_NAMES.ADVANCED_PLAYMAKER]: ["keyPasses", "chancesCreated", "npxG"],
    };
  }

  analyze(players: AttackingMidfielder[]) {
    const playersWithArchetype = calculateArchetypes(players, this.archetypes);

    return playersWithArchetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
      notEmptyFilter: (f: AttackingMidfielder) =>
        f.progressivePasses > 0 && f.conversionRatio > 0,
    });

    return filtered;
  }

  print(midfielders: AttackingMidfielder[]) {
    const display = midfielders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePasses,
        passRatio,
        keyPasses,
        dribbles,
        xA,
        npxG,
        conversionRatio,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        "pass%": passRatio,
        progressivePasses,
        keyPasses,
        dribbles,
        xA,
        npxG,
        conversionRatio,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There are ${display.length} attacking midfielders to watch`);
    printTable(display);
  }
}
