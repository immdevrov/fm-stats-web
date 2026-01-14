import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters, filterMap } from "./_filter";
import { Role, IRole } from "./_role";

interface IWinger extends IRole {
  progressivePassesPer90: number;
  passesPercent: number;
  headersWonRatio: number;
  arealAttempsPer90: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
  successfullPressures90: number;
  openCrossesRatio: number;
  openSucessfullCrosses90: number;
  chancesCreated: number;
  xA: number;
  keyPasses: number;
  dribbles: number;
  npXG: number;
  conv: number;
}

export class WingerProcessor {
  playersLeft: LeftWinger[];
  playersRight: RightWinger[];

  private ARHETYPE_NAMES = {
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
      [this.ARHETYPE_NAMES.WINGER]: [
        "chancesCreated",
        "openCrossesRatio",
        "openSucessfullCrosses90",
        "dribbles",
      ],
      [this.ARHETYPE_NAMES.INSIDE]: ["chancesCreated", "dribbles", "conv", "npXG"],
      [this.ARHETYPE_NAMES.WIDE_PLAYMAKER]: ["keyPasses", "chancesCreated", "xA"],
    };
  }

  analize(wingers: Array<LeftWinger | RightWinger>) {
    const playersWithArhetypeLeft = calculateArchetypes(
      wingers.filter((p) => p.side === "left"),
      this.archetypes
    );
    const playersWithArhetypeRight = calculateArchetypes(
      wingers.filter((p) => p.side === "right"),
      this.archetypes
    );

    return [playersWithArhetypeLeft, playersWithArhetypeRight].flat();
  }

  filter() {
    const filterMap: filterMap<Winger> = {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    };

    const filteredLeft = applyFilters(this.playersLeft, filterMap);
    const filteredRight = applyFilters(this.playersRight, filterMap);

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
        progressivePassesPer90: prPass,
        passesPercent,
        arealAttempsPer90: ArealAttps,
        headersWonRatio,
        contractExpires,
        wage,
        openCrossesRatio,
        openSucessfullCrosses90,
        successfullPressures90,
        xA,
        keyPasses,
        dribbles,
        npXG,
        conv,
      } = g;
      return {
        uid,
        name,
        nat,
        aatts: ArealAttps,
        "hdrs%": headersWonRatio,
        "pass%": passesPercent,
        prPass,
        xA,
        kPass: keyPasses,
        drib: dribbles,
        "oCrs%": openCrossesRatio,
        oCrsAtt: ((openSucessfullCrosses90 / openCrossesRatio) * 100).toFixed(2),
        press: successfullPressures90,
        npXG,
        conv,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} ${side} wingers to watch`);
    printTable(display);
  }
}
export class Winger extends Role implements IWinger {
  readonly progressivePassesPer90: number;
  readonly passesPercent: number;
  readonly tacklesPer90: number;
  readonly headersWonRatio: number;
  readonly arealAttempsPer90: number;
  readonly posessionWonPer90: number;
  readonly posessionLostPer90: number;
  readonly successfullPressures90: number;
  readonly openCrossesRatio: number;
  readonly openSucessfullCrosses90: number;
  readonly xA: number;
  readonly keyPasses: number;
  readonly dribbles: number;
  readonly npXG: number;
  readonly conv: number;
  readonly chancesCreated: number;

  constructor(player: Player) {
    super(player);

    this.progressivePassesPer90 = player.PrPassesPer90;
    this.passesPercent = player.PasPercentage;
    this.tacklesPer90 = player.TckPer90;
    this.headersWonRatio = player.HdrPercentage;
    this.arealAttempsPer90 = player.AerAPer90;
    this.posessionWonPer90 = player.PossWonPer90;
    this.posessionLostPer90 = player.PossLostPer90;
    this.successfullPressures90 = player.PresCPer90;
    this.openCrossesRatio = player.OPCrPercentage;
    this.openSucessfullCrosses90 = player.OPCrsCPer90;
    this.xA = player.xAPer90;
    this.keyPasses = player.OPKPPer90;
    this.dribbles = player.DrbPer90;
    this.npXG = player.NPxGPer90;
    this.conv = player.ConvPercentage;
    this.chancesCreated = player.ChCPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) =>
        (p.type === "AM" || p.type === "M") &&
        (p.side?.includes("L") || p.side?.includes("R"))
    );
  }
}

class LeftWinger extends Winger {
  readonly side = "left";
  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "AM" || p.type === "M") && p.side?.includes("L")
    );
  }
}
class RightWinger extends Winger {
  readonly side = "right";
  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "AM" || p.type === "M") && p.side?.includes("R")
    );
  }
}
