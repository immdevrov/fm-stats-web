import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";

import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "./_filter";
import { IRole, Role } from "./_role";

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

  get archetypes(): Record<string, KeyOfType<IGoalKeeper, number>[]> {
    return {
      [this.ARHETYPE_NAMES.SHOT_STOPPER]: [
        "expectedSavesDiff",
        "savesHeldPercentage",
        "goalsPrevented90",
      ],
      [this.ARHETYPE_NAMES.PASSER]: ["passesAccuracy", "proggressivePasses"],
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
        goalsPrevented90,
        height,
        mistakes,
        savesHeldPercentage,
        contractExpires,
        wage,
        division,
        age,
        expectedSavesDiff,
      } = g;
      return {
        uid,
        name,
        division,
        nat,
        goalsPrevented90,
        height,
        mistakes,
        savesHeldPercentage,
        wage: wage ? formatWage(wage) : null,
        age,
        expectedSavesDiff,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} goalkeepers to watch`);
    printTable(display);
  }
}

export interface IGoalKeeper extends IRole {
  height: number;
  goalsPrevented90: number;
  mistakes: number;
  savesHeldPercentage: number;
  age: number;
  expectedSavesDiff: number;
  passesAccuracy: number;
  proggressivePasses: number;
}
export class GoalKeeper extends Role implements IGoalKeeper {
  readonly height: number;
  readonly goalsPrevented90: number;
  readonly expectedSavesDiff: number;
  readonly age: number;
  readonly mistakes: number;
  readonly savesHeldPercentage: number;
  readonly passesAccuracy: number;
  readonly proggressivePasses: number;

  constructor(player: Player) {
    super(player);

    this.height = player.Height;
    this.goalsPrevented90 = player.xGPPer90;
    this.expectedSavesDiff = player.svPercentage - player.exsvPercentage;
    this.age = player.Age;
    this.mistakes = player.GlMst;
    this.passesAccuracy = player.PasPercentage;
    this.proggressivePasses = player.PrPassesPer90;

    const saves = (player.Svh ?? 0) + (player.Svp ?? 0) + (player.Svt ?? 0);
    this.savesHeldPercentage =
      saves === 0 ? 0 : Math.round((player.Svh / saves + Number.EPSILON) * 100) / 100;
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "GK");
  }
}
