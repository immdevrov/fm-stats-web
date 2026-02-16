import { getFilters } from "../filters";
import type { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters, type filterMap } from "../roles/_filter";
import { Winger, LeftWinger, RightWinger, type IWinger } from "../roles/winger";

export class WingerProcessor {
  playersLeft: LeftWinger[];
  playersRight: RightWinger[];

  private ARCHETYPE_NAMES = {
    WINGER: "winger",
    INSIDE: "inside",
    WIDE_PLAYMAKER: "wide playmaker",
  };

  constructor(players: Player[]) {
    const pl = players.filter(LeftWinger.isRole);
    const pr = players.filter(RightWinger.isRole);

    this.playersLeft = pl.map((p) => new LeftWinger(p));
    this.playersRight = pr.map((p) => new RightWinger(p));
  }

  get archetypes(): Record<string, KeyOfType<IWinger, number>[]> {
    return {
      [this.ARCHETYPE_NAMES.WINGER]: [
        "chancesCreated",
        "crossRatio",
        "crossesSuccessful",
        "dribbles",
      ],
      [this.ARCHETYPE_NAMES.INSIDE]: ["chancesCreated", "dribbles", "conversionRatio", "npxG"],
      [this.ARCHETYPE_NAMES.WIDE_PLAYMAKER]: ["keyPasses", "chancesCreated", "xA"],
    };
  }

  analyze(wingers: Array<LeftWinger | RightWinger>) {
    const playersWithArchetypeLeft = calculateArchetypes(
      wingers.filter((p) => p.side === "left"),
      this.archetypes
    );
    const playersWithArchetypeRight = calculateArchetypes(
      wingers.filter((p) => p.side === "right"),
      this.archetypes
    );

    return [playersWithArchetypeLeft, playersWithArchetypeRight].flat();
  }

  filter() {
    const filterMapDef: filterMap<Winger> = {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    };

    const filteredLeft = applyFilters(this.playersLeft, filterMapDef);
    const filteredRight = applyFilters(this.playersRight, filterMapDef);

    return [filteredLeft, filteredRight].flat();
  }

  print(wingers: Array<LeftWinger | RightWinger>) {
    this.realPrint(
      wingers.filter((f) => f.side === "left"),
      "left"
    );
    this.realPrint(
      wingers.filter((f) => f.side === "right"),
      "right"
    );
  }

  private realPrint(fbList: Winger[], side: "left" | "right") {
    const display = fbList.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePasses,
        passRatio,
        aerialAttempts,
        headersWonRatio,
        contractExpires,
        wage,
        crossRatio,
        crossesSuccessful,
        pressuresSuccessful,
        xA,
        keyPasses,
        dribbles,
        npxG,
        conversionRatio,
      } = g;
      return {
        uid,
        name,
        nat,
        aerialAttempts,
        "hdrs%": headersWonRatio,
        "pass%": passRatio,
        progressivePasses,
        xA,
        keyPasses,
        dribbles,
        "crossRatio%": crossRatio,
        crossAttempts: ((crossesSuccessful / crossRatio) * 100).toFixed(2),
        pressuresSuccessful,
        npxG,
        conversionRatio,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There are ${display.length} ${side} wingers to watch`);
    printTable(display);
  }
}
