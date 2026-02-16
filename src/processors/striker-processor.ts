import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import {
  calculateArchetypes,
  displayDate,
  formatWage,
  getCohort,
  getColumn,
  printTable,
  sortIntoCohorts,
} from "../utils";
import { applyFilters } from "../roles/_filter";
import { Striker, type IStriker } from "../roles/striker";

export class StrikersProcessor {
  players: Striker[];
  private ARCHETYPE_NAMES = {
    GOALSCORER: "goalscorer",
    PRESSING_FORWARD: "pressing forward",
    CREATOR: "creator",
    TARGET_FORWARD: "target forward",
    ADVANCED_FORWARD: "advanced forward",
  };

  constructor(players: Player[]) {
    const pl = players.filter(Striker.isRole);

    this.players = pl.map((p) => new Striker(p));
  }

  get archetypes(): Record<string, KeyOfType<IStriker, number>[]> {
    return {
      [this.ARCHETYPE_NAMES.GOALSCORER]: ["conversionRatio", "shots", "goals"],
      [this.ARCHETYPE_NAMES.PRESSING_FORWARD]: ["pressuresSuccessful", "tackleRatio"],
      [this.ARCHETYPE_NAMES.CREATOR]: ["xA", "chancesCreated"],
      [this.ARCHETYPE_NAMES.TARGET_FORWARD]: [
        "headersWonRatio",
        "keyHeaders",
        "ballRetention",
      ],
      [this.ARCHETYPE_NAMES.ADVANCED_FORWARD]: ["dribbles", "keyPasses"],
    };
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
      nonEmpty: (d: Striker) => d.aerialAttempts > 0,
    });

    return filtered;
  }

  analyze(strikers: Striker[]) {
    const playersWithArchetype = calculateArchetypes(strikers, this.archetypes);

    return playersWithArchetype;
  }

  print(strikers: Striker[]) {
    const xACohorts = sortIntoCohorts(getColumn(strikers, "xA"));
    const hdrsCohorts = sortIntoCohorts(getColumn(strikers, "headersWonRatio"));
    const dribblesCohorts = sortIntoCohorts(getColumn(strikers, "dribbles"));
    const display = strikers.map((g) => {
      const {
        uid,
        name,
        nat,
        xGOverperformance,
        npxG,
        conversionRatio,
        shots,
        xA,
        keyPasses,
        dribbles,
        pressuresSuccessful,
        aerialAttempts,
        headersWonRatio,
        contractExpires,
        wage,
        goals,
      } = g;
      return {
        uid,
        name,
        nat,
        xGOverperformance,
        npxG,
        conversionRatio,
        keyPasses,
        shots,
        xA: getCohort(xA, xACohorts),
        dribbles: getCohort(dribbles, dribblesCohorts),
        pressuresSuccessful,
        aerialAttempts,
        goals,
        headersWonRatio: getCohort(headersWonRatio, hdrsCohorts),
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There are ${display.length} strikers to watch`);
    printTable(display);
  }
}
