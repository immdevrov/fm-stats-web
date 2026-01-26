import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "../roles/_filter";
import { GoalKeeper, type IGoalkeeper } from "../roles/goalkeeper";

export class GoalKeeperProcessor {
  players: GoalKeeper[];

  private ARHETYPE_NAMES = {
    SHOT_STOPPER: "shot stopper",
    PASSER: "passer",
  };

  constructor(players: Player[]) {
    const pl = players.filter(GoalKeeper.isRole);

    this.players = pl.map((p) => new GoalKeeper(p));
  }

  get archetypes(): Record<string, KeyOfType<IGoalkeeper, number>[]> {
    return {
      [this.ARHETYPE_NAMES.SHOT_STOPPER]: [
        "saveRatioOverExpected",
        "savesHeldRatio",
        "goalsPrevented",
      ],
      [this.ARHETYPE_NAMES.PASSER]: ["passRatio", "progressivePasses"],
    };
  }

  analize(players: GoalKeeper[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filteredPlayers = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      timePlayed: getFilters().timePlayed,
    });
    return filteredPlayers;
  }

  print(goakeepers: GoalKeeper[]) {
    const display = goakeepers.map((g) => {
      const {
        uid,
        name,
        nat,
        goalsPrevented,
        height,
        mistakes,
        savesHeldRatio,
        contractExpires,
        wage,
        division,
        age,
        saveRatioOverExpected,
      } = g;
      return {
        uid,
        name,
        division,
        nat,
        goalsPrevented,
        height,
        mistakes,
        savesHeldRatio,
        wage: wage ? formatWage(wage) : null,
        age,
        saveRatioOverExpected,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} goalkeepers to watch`);
    printTable(display);
  }
}
