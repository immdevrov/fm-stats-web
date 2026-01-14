import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters, filterMap } from "./_filter";
import { Role, IRole } from "./_role";

interface IFullback extends IRole {
  height: number;
  mistakes: number;
  tackleRating: number;
  tacklesPer90: number;
  progressivePassesPer90: number;
  passesPercent: number;
  headersWonRatio: number;
  arealAttempsPer90: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
  successfullPressures90: number;
  openCrossesRatio: number;
  openSucessfullCrosses90: number;
  xA: number;
  keyPasses: number;
  dribbles: number;
  sprints: number;
}

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
        "posessionWonPer90",
        "tackleRating",
        "headersWonRatio",
      ],
      [this.ARHETYPE_NAMES.WING_BACK]: [
        "keyPasses",
        "openCrossesRatio",
        "openSucessfullCrosses90",
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
    const filterMap: filterMap<Fullback> = {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    };

    const filteredLeft = applyFilters(this.playersLeft, filterMap);
    const filteredRight = applyFilters(this.playersRight, filterMap);

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
        progressivePassesPer90: prPass,
        passesPercent,
        arealAttempsPer90: ArealAttps,
        headersWonRatio,
        tacklesPer90: tclks,
        tackleRating: tclsR,
        posessionLostPer90: posLost,
        posessionWonPer90: posWon,
        contractExpires,
        wage,
        openCrossesRatio,
        openSucessfullCrosses90,
        successfullPressures90,
        xA,
        keyPasses,
        dribbles,
      } = g;
      return {
        uid,
        name,
        nat,
        aatts: ArealAttps,
        "hdrs%": headersWonRatio,
        "pass%": passesPercent,
        prPass,
        tclks,
        tclsR,
        posDif: (posWon - posLost).toFixed(2),
        xA,
        kPass: keyPasses,
        drib: dribbles,
        "oCrs%": openCrossesRatio,
        oCrsAtt: ((openSucessfullCrosses90 / openCrossesRatio) * 100).toFixed(2),
        press: successfullPressures90,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} ${side} defenders to watch`);
    printTable(display);
  }
}

export class Fullback extends Role implements IFullback {
  readonly height: number;
  readonly mistakes: number;
  readonly tackleRating: number;
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
  readonly sprints: number;

  constructor(player: Player) {
    super(player);

    this.height = player.Height;
    this.mistakes = player.GlMst;
    this.tackleRating = player.TckR;
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
    this.sprints = player.SprintsPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) =>
        (p.type === "D" || p.type === "WB") &&
        (p.side?.includes("L") || p.side?.includes("R"))
    );
  }
}
class LeftFullback extends Fullback {
  readonly side = "left";
  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "D" && p.side?.includes("L"));
  }
}
class RightFullback extends Fullback {
  readonly side = "right";
  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "D" && p.side?.includes("R"));
  }
}
