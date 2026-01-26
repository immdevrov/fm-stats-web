import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters, type filterMap } from "../roles/_filter";
import {
  Fullback,
  LeftFullback,
  RightFullback,
  type IFullback,
} from "../roles/fullback";

export class FullbackProcessor {
  playersLeft: LeftFullback[];
  playersRight: RightFullback[];

  private ARHETYPE_NAMES = {
    WIDE_DEFENDER: "wide defender",
    WING_BACK: "wing back",
    INVERTED_FB: "inverted fullback",
  };

  constructor(players: Player[]) {
    const pl = players.filter(LeftFullback.isRole);
    const pr = players.filter(RightFullback.isRole);

    this.playersLeft = pl.map((p) => new LeftFullback(p));
    this.playersRight = pr.map((p) => new RightFullback(p));
  }

  get archetypes(): Record<string, KeyOfType<IFullback, number>[]> {
    return {
      [this.ARHETYPE_NAMES.WIDE_DEFENDER]: [
        "possessionWon",
        "tackleRatio",
        "headersWonRatio",
      ],
      [this.ARHETYPE_NAMES.WING_BACK]: [
        "keyPasses",
        "crossRatio",
        "crossesSuccessful",
        "sprints",
        "dribbles",
      ],
    };
  }

  analize(fullbacks: Array<LeftFullback | RightFullback>) {
    const playersWithArhetypeLeft = calculateArchetypes(
      fullbacks.filter((p) => p.side === "left"),
      this.archetypes
    );
    const playersWithArhetypeRight = calculateArchetypes(
      fullbacks.filter((p) => p.side === "right"),
      this.archetypes
    );

    return [playersWithArhetypeLeft, playersWithArhetypeRight].flat();
  }

  filter() {
    const filterMapDef: filterMap<Fullback> = {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    };

    const filteredLeft = applyFilters(this.playersLeft, filterMapDef);
    const filteredRight = applyFilters(this.playersRight, filterMapDef);

    return [filteredLeft, filteredRight].flat();
  }

  print(fullbacks: Array<LeftFullback | RightFullback>) {
    this.realPrint(
      fullbacks.filter((f) => f.side === "left"),
      "left"
    );
    this.realPrint(
      fullbacks.filter((f) => f.side === "right"),
      "right"
    );
  }

  private realPrint(fbList: Fullback[], side: "left" | "right") {
    const display = fbList.map((g) => {
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
        contractExpires,
        wage,
        crossRatio,
        crossesSuccessful,
        pressuresSuccessful,
        xA,
        keyPasses,
        dribbles,
      } = g;
      return {
        uid,
        name,
        nat,
        aerialAttempts,
        "hdrs%": headersWonRatio,
        "pass%": passRatio,
        progressivePasses,
        tackles,
        tackleRatio,
        posDif: (possessionWon - possessionLost).toFixed(2),
        xA,
        keyPasses,
        dribbles,
        "crossRatio%": crossRatio,
        crossAttempts: ((crossesSuccessful / crossRatio) * 100).toFixed(2),
        pressuresSuccessful,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} ${side} defenders to watch`);
    printTable(display);
  }
}
